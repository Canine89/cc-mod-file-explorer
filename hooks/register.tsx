import { atom, read, update } from 'claude-code'
import type { EngineInterface, FsEntry, Register } from 'claude-code'

import type { ExpandedDirs, PeekPath } from '../types'

const PANE = 'file-explorer'
const TITLE = '파일 탐색기'
const MAX_ROWS = 400
// 채팅 옆에 붙을 때 원하는 너비, 그리고 엔진이 옆에 붙여 주는 최소 터미널 너비
const DOCK_COLUMNS = 40
const MIN_DOCK_WIDTH = 110
const HIDDEN = new Set(['node_modules', '__pycache__'])
// 파일을 바꿀 수 있는 도구가 끝나면 트리를 다시 읽는다
const MUTATING = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash'])

const expanded = atom({ plugin: 'file-explorer', key: 'expanded' } as const, [] as ExpandedDirs)
const showHidden = atom({ plugin: 'file-explorer', key: 'showHidden' } as const, false)
const tick = atom({ plugin: 'file-explorer', key: 'tick' } as const, 0)
const peek = atom({ plugin: 'file-explorer', key: 'peek' } as const, null as PeekPath)

// 이름을 누르면 패널 안에서 바로 미리 볼 수 있는 파일
const PEEK_MARKDOWN = /\.(md|markdown|mdx)$/i
const PEEK_PLAIN = /\.txt$/i
const PEEK_MAX_BYTES = 256 * 1024
const PEEK_MAX_CHARS = 20_000

type Row = { path: string; name: string; depth: number; isDir: boolean; size: number }

const canPeek = (row: Row) =>
  !row.isDir && row.size <= PEEK_MAX_BYTES && (PEEK_MARKDOWN.test(row.name) || PEEK_PLAIN.test(row.name))

const isVisible = (entry: FsEntry, withHidden: boolean) =>
  withHidden || !(entry.name.startsWith('.') || HIDDEN.has(entry.name))

const byKindThenName = (a: FsEntry, b: FsEntry) =>
  a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'dir' ? -1 : 1

const joinPath = (dir: string, name: string) => (dir === '.' ? name : `${dir}/${name}`)

// 공백이 있는 경로는 @"..." 형태로 감싼다
const mentionOf = (target: { path: string; isDir: boolean }) => {
  const path = target.isDir ? `${target.path}/` : target.path

  return /\s/.test(path) ? `@"${path}"` : `@${path}`
}

const fit = (text: string, width: number) =>
  text.length <= width ? text : `${text.slice(0, Math.max(1, width - 1))}…`

async function collectRows($: EngineInterface, root: string, open: Set<string>, withHidden: boolean) {
  const rows: Row[] = []

  const walk = async (dir: string, depth: number) => {
    let entries: FsEntry[]
    try {
      entries = await $.fs.list(dir === '.' ? root : `${root}/${dir}`)
    } catch {
      return
    }
    const visible = entries.filter(entry => isVisible(entry, withHidden)).sort(byKindThenName)
    for (const entry of visible) {
      if (rows.length >= MAX_ROWS) return
      const path = joinPath(dir, entry.name)
      const isDir = entry.kind === 'dir'
      rows.push({ path, name: entry.name, depth, isDir, size: entry.size })
      if (isDir && open.has(path)) await walk(path, depth + 1)
    }
  }

  await walk('.', 0)

  return rows
}

async function mention($: EngineInterface, row: { path: string; isDir: boolean }) {
  const box = await $.prompt.read()
  const before = box.text.slice(0, box.cursor)
  const lead = before.length > 0 && !/\s$/.test(before) ? ' ' : ''
  const filled = await $.prompt.fill({ text: `${lead}${mentionOf(row)} `, mode: 'insert' })
  if (!filled.isFilled) $.ui.toast(`멘션하지 못했습니다 (${filled.refusal ?? '프롬프트 없음'})`)
}

const toggle = (path: string) =>
  (list: ExpandedDirs) => (list.includes(path) ? list.filter(p => p !== path) : [...list, path])

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'files',
      description: '오른쪽에 파일 탐색기 패널을 엽니다',
    })
    void $.ui.open({ id: PANE, title: TITLE, columns: DOCK_COLUMNS })

    return next(e)
  })

  on('command.run', { command: 'files' }, async ($, e) => {
    const opened = await $.ui.open({ id: PANE, title: TITLE, columns: DOCK_COLUMNS })
    if (!opened.isPlaced) return { text: '파일 탐색기를 열지 못했습니다.' }
    if (!e.presentation.isFullscreen) {
      return { text: `파일 탐색기를 프롬프트 위에 열었습니다. 채팅 오른쪽에 2열로 두려면 /tui fullscreen으로 바꾼 뒤 /files를 다시 실행하세요.` }
    }
    if (e.presentation.columns < MIN_DOCK_WIDTH) {
      return { text: `터미널이 ${e.presentation.columns}칸이라 오른쪽에 붙지 못했습니다. ${MIN_DOCK_WIDTH}칸 이상으로 넓혀 주세요.` }
    }

    return { text: '파일 탐색기를 오른쪽에 열었습니다.' }
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (MUTATING.has(String(e.tool))) await update($, tick, n => n + 1)

    return ran
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button, Markdown, Code } = $.ui.resolve(e)
    await read($, tick)
    const cwd = await $.session.cwd()
    const width = Math.max(12, e.props.bodyColumns)
    const peeking = await read($, peek)

    if (peeking !== null) {
      let text: string | undefined
      try {
        text = await $.fs.read(`${cwd}/${peeking}`)
      } catch {
        text = undefined
      }
      const isCut = text !== undefined && text.length > PEEK_MAX_CHARS
      const shown = text === undefined ? '' : isCut ? text.slice(0, PEEK_MAX_CHARS) : text

      return (
        <Box flexDirection="column" width={width}>
          <Box flexDirection="row" gap={1}>
            <Button key="back" label="← 목록" hotkey="b" autoFocus onPress={() => update($, peek, () => null)} />
            <Button key="peek-at" label="@ 멘션" hotkey="m" onPress={() => mention($, { path: peeking, isDir: false })} />
          </Box>
          <Text bold wrap="truncate-start">
            {peeking}
          </Text>
          <Text dimColor>{'─'.repeat(width)}</Text>
          {text === undefined && <Text color="red">파일을 읽지 못했습니다.</Text>}
          {text !== undefined && shown.trim() === '' && <Text dimColor>(빈 파일)</Text>}
          {shown.trim() !== '' &&
            (PEEK_MARKDOWN.test(peeking) ? (
              <Markdown key="peek-body" text={shown} />
            ) : (
              <Code source={shown} wrap="wrap" />
            ))}
          {isCut && <Text dimColor>… 앞부분 {PEEK_MAX_CHARS.toLocaleString()}자만 표시합니다</Text>}
        </Box>
      )
    }

    const open = new Set(await read($, expanded))
    const withHidden = await read($, showHidden)
    const rootName = cwd.split(/[\\/]/).filter(Boolean).pop() ?? cwd
    const rows = await collectRows($, cwd, open, withHidden)

    return (
      <Box flexDirection="column" width={width}>
        {e.props.placement === 'inline' && (
          <Text color="yellow" wrap="wrap">
            {e.viewport?.isFullscreen === false
              ? '오른쪽 2열로 보려면 /tui fullscreen을 실행하세요'
              : `오른쪽 2열로 보려면 터미널을 ${MIN_DOCK_WIDTH}칸 이상으로 넓히세요`}
          </Text>
        )}
        <Text bold wrap="truncate-end">
          {rootName}/
        </Text>
        <Box flexDirection="row" gap={1} marginBottom={1}>
          <Button key="refresh" label="새로고침" hotkey="r" onPress={() => update($, tick, n => n + 1)} />
          <Button key="collapse" label="모두 접기" hotkey="c" onPress={() => update($, expanded, () => [])} />
          <Button
            key="hidden"
            label={withHidden ? '숨김 끄기' : '숨김 보기'}
            hotkey="h"
            onPress={() => update($, showHidden, v => !v)}
          />
        </Box>
        <Text dimColor wrap="wrap">
          .md·.txt 이름을 누르면 미리보기, @ 버튼은 멘션
        </Text>
        {rows.length === 0 && <Text dimColor>비어 있는 폴더입니다.</Text>}
        {rows.map(row => {
          const indent = '  '.repeat(row.depth)
          const marker = row.isDir ? (open.has(row.path) ? '▾ ' : '▸ ') : canPeek(row) ? '◦ ' : '  '
          const label = fit(row.isDir ? `${row.name}/` : row.name, width - indent.length - 6)

          return (
            <Box key={`row:${row.path}`} flexDirection="row" width={width}>
              <Text dimColor>{indent}</Text>
              {row.isDir ? (
                <Button
                  key={`open:${row.path}`}
                  label={`${marker}${label}`}
                  plain
                  onPress={() => update($, expanded, toggle(row.path))}
                />
              ) : (
                <Button
                  key={`file:${row.path}`}
                  label={`${marker}${label}`}
                  plain
                  dimColor={row.name.startsWith('.')}
                  onPress={() => (canPeek(row) ? update($, peek, () => row.path) : mention($, row))}
                />
              )}
              <Box flexGrow={1} />
              <Button key={`at:${row.path}`} label="@" plain dimColor onPress={() => mention($, row)} />
            </Box>
          )
        })}
        {rows.length >= MAX_ROWS && <Text dimColor>… {MAX_ROWS}개까지만 표시합니다</Text>}
      </Box>
    )
  })
}
