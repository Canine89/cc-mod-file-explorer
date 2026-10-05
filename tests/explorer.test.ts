import { expect, test } from 'claude-code/testing'
import type { FsEntry } from 'claude-code'

const entry = (name: string, kind: 'file' | 'dir'): FsEntry => ({ name, kind, size: 0, mtimeMs: 0, isLink: false })

const TREE: Record<string, FsEntry[]> = {
  '/work/demo': [entry('README.md', 'file'), entry('src', 'dir'), entry('.git', 'dir'), entry('my notes.txt', 'file')],
  '/work/demo/src': [entry('main.ts', 'file')],
}

const FILES: Record<string, string> = {
  '/work/demo/README.md': '# 안녕\n\n미리보기 본문',
}

const PANE = {
  plugin: 'file-explorer',
  component: 'Pane',
  requestId: 'file-explorer',
  props: {
    title: '파일 탐색기',
    isFocused: true,
    bodyColumns: 40,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

test('트리를 그리고, 폴더를 펼치고, @ 버튼으로 멘션한다', async ($, on) => {
  const filled: string[] = []
  on('fs.list', async (_$, e) => ({ value: TREE[e.path] ?? [] }))
  on('session.cwd', async () => ({ value: '/work/demo' }))
  on('prompt.read', async () => ({ value: { text: 'look at', cursor: 7 } }))
  on('prompt.fill', async (_$, e) => {
    filled.push(e.text)
    return { isFilled: true, text: e.text }
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    filled.length = 0
    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ type: 'Text', text: 'demo/' }))).toBeDefined()
    expect(await ui.find({ key: 'file:README.md' })).toBeDefined()
    expect(await ui.find({ key: 'open:.git' })).toBeUndefined()
    expect(await ui.find({ key: 'file:src/main.ts' })).toBeUndefined()

    await ui.press({ key: 'open:src' })
    expect(await ui.find({ key: 'file:src/main.ts' })).toBeDefined()

    await ui.press({ key: 'at:src/main.ts' })
    await ui.press({ key: 'at:my notes.txt' })
    await ui.press({ key: 'at:src' })
    expect(filled).toEqual([' @src/main.ts ', ' @"my notes.txt" ', ' @src/ '])

    await ui.press({ key: 'hidden' })
    expect(await ui.find({ key: 'open:.git' })).toBeDefined()
    await ui.press({ key: 'hidden' })

    await ui.press({ key: 'collapse' })
    expect(await ui.find({ key: 'file:src/main.ts' })).toBeUndefined()
    await ui.unmount()
  }
})

test('프롬프트 위(inline)에 놓이면 2열로 바꾸는 방법을 알려준다', async ($, on) => {
  on('fs.list', async () => ({ value: [] }))
  on('session.cwd', async () => ({ value: '/work/demo' }))

  for (const surface of ['terminal', 'desktop'] as const) {
    const inline = await $.ui.mount({
      ...PANE,
      surface,
      props: { ...PANE.props, placement: 'inline' },
      viewport: { columns: 100, rows: 40, isFullscreen: false },
    })
    expect(await inline.find({ type: 'Text', text: /tui fullscreen/ })).toBeDefined()
    await inline.unmount()

    const docked = await $.ui.mount({ ...PANE, surface })
    expect(await docked.find({ type: 'Text', text: /tui fullscreen/ })).toBeUndefined()
    await docked.unmount()
  }
})

test('md 파일 이름을 누르면 패널 안에서 미리 보고, 목록으로 돌아온다', async ($, on) => {
  const filled: string[] = []
  on('fs.list', async (_$, e) => ({ value: TREE[e.path] ?? [] }))
  on('fs.read', async (_$, e) => {
    const text = FILES[e.path]
    return text === undefined ? { deny: 'ENOENT' } : { value: text }
  })
  on('session.cwd', async () => ({ value: '/work/demo' }))
  on('prompt.read', async () => ({ value: { text: '', cursor: 0 } }))
  on('prompt.fill', async (_$, e) => {
    filled.push(e.text)
    return { isFilled: true, text: e.text }
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    filled.length = 0
    const ui = await $.ui.mount({ ...PANE, surface })

    await ui.press({ key: 'file:README.md' })
    expect((await ui.find({ key: 'peek-body' }))?.text).toContain('미리보기 본문')
    expect(await ui.find({ key: 'file:README.md' })).toBeUndefined()
    expect(filled).toEqual([])

    await ui.press({ key: 'peek-at' })
    expect(filled).toEqual(['@README.md '])

    await ui.press({ key: 'back' })
    expect(await ui.find({ key: 'peek-body' })).toBeUndefined()
    expect(await ui.find({ key: 'file:README.md' })).toBeDefined()

    await ui.press({ key: 'open:src' })
    await ui.press({ key: 'file:src/main.ts' })
    expect(await ui.find({ key: 'peek-body' })).toBeUndefined()
    expect(filled).toEqual(['@README.md ', '@src/main.ts '])
    await ui.press({ key: 'collapse' })
    await ui.unmount()
  }
})
