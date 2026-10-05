/** 펼쳐진 폴더들의 작업 디렉터리 기준 상대 경로 */
export type ExpandedDirs = string[]

/** 패널 안에서 미리 보고 있는 파일의 상대 경로, 없으면 null */
export type PeekPath = string | null

declare module 'claude-code' {
  interface PluginState {
    'file-explorer': {
      expanded: ExpandedDirs
      showHidden: boolean
      tick: number
      peek: PeekPath
    }
  }
}
