# cc-mod-file-explorer

Claude Code 채팅 오른쪽에 **파일 탐색기**를 띄우는 모드(mod)입니다.

- 프로젝트 폴더를 트리로 보면서 폴더를 펼치거나 접을 수 있습니다.
- 파일 옆 `@` 버튼을 누르면 프롬프트에 `@경로`가 바로 들어갑니다. 파일 멘션을 일일이 타이핑할 필요가 없습니다.
- `.md`, `.txt` 파일은 이름을 누르면 탐색기 안에서 내용을 바로 미리 볼 수 있습니다(Peek).

```
┌─ 채팅 ─────────────────────────────┬─ 파일 탐색기 ──────────────┐
│                                    │ my-project/                │
│  > @src/main.ts 이 파일 설명해 줘  │ [ 새로고침 ] [ 모두 접기 ] │
│                                    │ ▾ src/                    @│
│                                    │     main.ts               @│
│                                    │ ◦ README.md               @│
└────────────────────────────────────┴────────────────────────────┘
```

> Claude Code 2.1.289에서 만들고 테스트했습니다. 모드(function hooks) API는 아직 얼리 액세스라 Claude Code 버전에 따라 동작이 달라질 수 있습니다.

## 설치

### 방법 1. 플러그인 마켓플레이스로 설치하기 (추천)

터미널에서 다음 두 줄을 실행합니다.

```bash
claude plugin marketplace add Canine89/cc-mod-file-explorer
claude plugin install file-explorer@cc-mod-file-explorer
```

Claude Code 안에서 설치하려면 프롬프트에 입력합니다.

```
/plugin marketplace add Canine89/cc-mod-file-explorer
/plugin install file-explorer@cc-mod-file-explorer
```

설치한 뒤 Claude Code를 다시 시작하면(또는 `/reload-plugins` 실행) 모드가 켜집니다.

### 방법 2. 소스를 받아서 바로 실행하기

코드를 직접 고쳐 보고 싶다면 이 방법이 편합니다.

```bash
git clone https://github.com/Canine89/cc-mod-file-explorer.git
claude --plugin-dir ./cc-mod-file-explorer
```

`--plugin-dir`로 띄운 세션에서는 파일을 저장하면 모드가 자동으로 다시 로드됩니다.

## 채팅 옆에 2열로 띄우기

탐색기를 **채팅 오른쪽**에 붙이려면 아래 두 가지가 필요합니다. 조건이 안 맞으면 탐색기는 프롬프트 위에 표시되고, 맨 위에 노란 안내 문구가 나옵니다.

1. Claude Code에서 `/tui fullscreen`을 실행해 전체 화면 렌더러로 바꿉니다. 바로 바뀌지 않으면 Claude Code를 다시 시작하세요.
2. 터미널 창 너비를 **110칸 이상**으로 넓힙니다.

이 상태에서 `/files`를 실행하면 탐색기가 오른쪽에 열립니다. 터미널이 144칸 이상이면 세션을 시작할 때 자동으로 열립니다.

## 사용법

| 동작 | 방법 |
| --- | --- |
| 탐색기 열기 | `/files` |
| 폴더 펼치기/접기 | 폴더 이름(`▸ src/`) 누르기 |
| 파일·폴더 멘션 | 줄 오른쪽의 `@` 누르기 → 프롬프트에 `@src/main.ts`가 들어감 |
| 미리 보기(Peek) | `◦` 표시가 붙은 `.md`·`.txt` 파일 이름 누르기 |
| 미리 보기에서 돌아가기 | `← 목록` 버튼(단축키 `b`) |
| 미리 보는 파일 멘션 | `@ 멘션` 버튼(단축키 `m`) |
| 목록 다시 읽기 | `새로고침` 버튼(단축키 `r`) |
| 펼친 폴더 모두 접기 | `모두 접기` 버튼(단축키 `c`) |
| 숨김 파일 보기/끄기 | `숨김 보기` 버튼(단축키 `h`) |

- 탐색기를 클릭하거나 `ctrl+x tab`을 누르면 탐색기에 포커스가 갑니다. 이 상태에서 `Tab`과 방향키로 이동하고, `Enter`로 누르고, 단축키를 쓸 수 있습니다. `Esc`를 누르면 프롬프트로 돌아갑니다.
- Claude가 파일을 만들거나 고치면(Write, Edit, Bash 등) 목록이 자동으로 갱신됩니다.
- 이름에 공백이 있는 경로는 `@"my notes.txt"`처럼 따옴표로 감싸서 멘션합니다.
- 기본적으로 `.`으로 시작하는 항목과 `node_modules`, `__pycache__`는 숨깁니다.
- 한 번에 최대 400개 항목까지 표시합니다. 미리 보기는 256KB 이하 파일만, 내용은 앞부분 2만 자까지만 보여 줍니다.

## 삭제

```bash
claude plugin uninstall file-explorer@cc-mod-file-explorer
claude plugin marketplace remove cc-mod-file-explorer
```

## 폴더 구조

```
cc-mod-file-explorer/
├── .claude-plugin/
│   ├── plugin.json        # 모드(플러그인) 정보
│   └── marketplace.json   # 마켓플레이스 설치용 목록
├── hooks/
│   ├── hooks.json         # 훅 모듈 위치
│   └── register.tsx       # 모드 본체: 패널 그리기, 멘션, 미리 보기
├── types/
│   └── index.d.ts         # 모드가 쓰는 상태 값의 타입
└── tests/
    └── explorer.test.ts   # 동작 테스트
```

## 직접 고쳐 보기

```bash
claude plugin validate .   # 매니페스트와 훅 모듈 검사
claude plugin test .       # tests/*.test.ts 실행
```

미리 볼 수 있는 확장자를 늘리려면 `hooks/register.tsx`의 `PEEK_MARKDOWN`, `PEEK_PLAIN` 정규식을 고치면 됩니다.
