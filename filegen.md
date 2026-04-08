# Claude Code: ~/.claude 파일 생성 분석

> 이 문서는 Claude Code CLI가 `~/.claude/` 디렉토리 하위에 생성하는 모든 파일과 디렉토리를 분석한 결과입니다.
> 기본 경로: `~/.claude` (환경변수 `CLAUDE_CONFIG_DIR`로 오버라이드 가능)
>
> **검증 날짜**: 2026-04-07 (실제 `~/.claude/` 디렉토리와 소스코드 비교 완료)

## 0. 실제 파일 비교 결과 (소스 분석 vs 실제 디스크)

### 소스 분석에서 누락되었으나 실제 존재하는 항목

| 실제 경로 | 내용 | 생성 주체 |
|-----------|------|-----------|
| `.session-stats.json` | 세션별 통계 데이터 (소스의 `stats-cache.json`과 별도) | 런타임 |
| `security_warnings_state_<sessionId>.json` | 세션별 보안 경고 표시 상태 추적 | 보안 경고 시스템 |
| `CLAUDE.md.backup.<timestamp>` | CLAUDE.md 수정 전 백업 (최상위 레벨, `backups/`와 별도) | CLAUDE.md 편집 시 |
| `statusline-command.sh` | 터미널 상태줄 표시 스크립트 (일반 셸용) | 상태줄 설정 시 |
| `statusline-p10k.sh` | Powerlevel10k 상태줄 표시 스크립트 | 상태줄 설정 시 |
| `channels/discord/` | Discord 채널 접근 설정 | Discord 플러그인 |
| `channels/telegram/approved/` | Telegram 채널 페어링/접근 설정 | Telegram 플러그인 |
| `chrome/chrome-native-host/` | Chrome 네이티브 메시지 호스트 바이너리 | Chrome 연동 설치 시 |
| `hud/omc-hud.mjs` | HUD (Heads-Up Display) 렌더링 모듈 | OMC 플러그인 |
| `hud/backup/` | HUD 설정 백업 | OMC 플러그인 |
| `ide/<pid>.lock` | IDE 프로세스 연동 락 (PID 기반) | IDE 확장 연결 시 |
| `sessions/<pid>.json` | 활성 세션 프로세스 레지스트리 | 세션 시작 시 |
| `shell-snapshots/snapshot-*.sh` | 셸 환경 변수 스냅샷 (복구용) | 세션 시작 시 |
| `tasks/<sessionId>/` | 세션별 태스크/TODO 데이터 | TaskCreate 도구 사용 시 |
| `transcripts/ses_*.jsonl` | 원격(CCR) 세션 트랜스크립트 | 원격 세션 실행 시 |
| `teams/<name>/inboxes/` | 팀 메시지 인박스 (SendMessage 수신) | 팀 에이전트 통신 시 |

### 조건부 생성 파일 (소스에 있으나 모든 환경에 존재하지 않음)

| 파일 | 조건 |
|------|------|
| `.claude.json` / `.claude-oauth.json` | Keychain 사용 불가 시에만 생성 |
| `.credentials.json` | macOS Keychain 없는 환경에서만 |
| `*.lock` (update, mcp-refresh, computer-use) | 해당 작업 진행 중에만 일시적 존재 |
| `managed-settings.json`, `managed-mcp.json` | 엔터프라이즈/MDM 환경에서만 |
| `keybindings.json` | 사용자 커스터마이즈 시에만 |
| `image-cache/`, `uploads/`, `plans/`, `agents/`, `commands/` | 해당 기능 최초 사용 시 생성 |

### 이름 불일치
| filegen.md | 실제 | 비고 |
|-----------|------|------|
| `session-environments/` | `session-env/` | 실제 디렉토리명이 더 짧음 |
| `stats-cache.json` | `.session-stats.json` | 파일명이 다름 (dot prefix + 다른 이름) |

---

## 1. 글로벌 설정 파일

### 1.1 `.claude.json` / `.claude-oauth.json`
- **경로**: `~/.claude/.claude.json` 또는 `~/.claude/.claude-oauth.json`
- **형식**: JSON
- **생성 시점**: 최초 실행 시 (`recordFirstStartTime()`)
- **갱신 시점**: 설정 변경, 계정 업데이트, 캐시 갱신 시
- **쓰기 함수**: `saveGlobalConfig()` (src/utils/config.ts)
- **읽기 함수**: `getGlobalConfig()` (src/utils/config.ts)
- **원자적 쓰기**: temp 파일 + rename 패턴
- **주요 필드**:
  ```
  {
    firstStartTime: string,          // ISO timestamp, 최초 실행 시각
    oauthAccount: {...},             // OAuth 계정 정보
    accountInfo: {...},              // 구독 정보
    hasCompletedOnboarding: boolean, // 온보딩 완료 여부
    autoUpdates: boolean,            // 자동 업데이트 설정
    theme: string,                   // UI 테마
    preferredModel: string,          // 선호 모델
    lastReleaseNotesSeen: string,    // 마지막 본 릴리스 노트 버전
    changelogLastFetched: number,    // 체인지로그 마지막 가져온 시각
    customApiKeyResponses: {...},    // API 키 승인 목록
    projects: {                      // 프로젝트별 설정
      "<sanitized-path>": {
        allowedTools: [...],
        deniedTools: [...],
        history: [...],
        hasTrustDialogAccepted: boolean
      }
    }
  }
  ```

### 1.2 `settings.json`
- **경로**: `~/.claude/settings.json`
- **형식**: JSON
- **생성 시점**: 사용자가 설정을 변경할 때 (또는 `claude config` 명령)
- **목적**: 사용자 전역 설정 (API 키, 환경변수, 권한 규칙, 플러그인 설정)
- **읽기 함수**: `getSettingsFilePathForSource('userSettings')` (src/utils/settings/settings.ts)
- **Cowork 모드**: `cowork_settings.json` (환경변수 `CLAUDE_CODE_USE_COWORK_PLUGINS` 사용 시)

### 1.3 `managed-settings.json`
- **경로**: `~/.claude/managed-settings.json`
- **형식**: JSON
- **생성 시점**: 관리자가 조직 정책으로 배포
- **목적**: 엔터프라이즈 관리 설정 (사용자가 편집 불가)
- **추가 drop-in**: `~/.claude/managed-settings.d/*.json` (알파벳 순 병합)

### 1.4 `managed-mcp.json`
- **경로**: `~/.claude/managed-mcp.json`
- **형식**: JSON (`McpJsonConfig` 스키마)
- **생성 시점**: 관리자 정책 배포 시
- **목적**: 엔터프라이즈 관리 MCP 서버 설정

### 1.5 `keybindings.json`
- **경로**: `~/.claude/keybindings.json`
- **형식**: JSON
- **생성 시점**: 사용자가 키바인딩을 커스터마이즈할 때
- **목적**: 사용자 정의 키보드 단축키
- **읽기 함수**: `loadUserBindings()` (src/keybindings/loadUserBindings.ts)

---

## 2. 인증 및 자격증명

### 2.1 OAuth 토큰
- **1차 저장소**: macOS Keychain (서비스명: `getMacOsKeychainStorageServiceName()`)
- **폴백 파일**: `~/.claude/.claude-oauth.json` 내 `oauthAccount` 필드
- **환경변수 오버라이드**:
  - `CLAUDE_CODE_OAUTH_TOKEN` (직접 토큰 전달)
  - `CLAUDE_CODE_OAUTH_TOKEN_FILE_DESCRIPTOR` (FD를 통한 전달)
- **소스**: src/utils/auth.ts, src/utils/secureStorage/

### 2.2 API 키
- **1차 저장소**: macOS Keychain
- **설정 폴백**: `settings.json`의 `apiKeyHelper` 명령
- **환경변수**: `ANTHROPIC_API_KEY`
- **소스**: src/utils/auth.ts:214-348

---

## 3. 프로젝트 데이터 (`~/.claude/projects/`)

### 3.1 디렉토리 구조
```
~/.claude/projects/
  <sanitized-cwd>/              # 프로젝트별 디렉토리 (경로를 sanitize)
    <sessionId>.jsonl            # 세션 트랜스크립트
    <sessionId>/
      subagents/
        agent-<agentId>.jsonl    # 서브에이전트 트랜스크립트
        agent-<agentId>.meta.json # 서브에이전트 메타데이터
      remote-agents/
        remote-agent-<taskId>.meta.json  # 원격 에이전트 메타
    memory/                      # 자동 메모리
      MEMORY.md                  # 메모리 인덱스 (최대 200줄/25KB)
      MEMORY.md.bak              # 메모리 백업 (잘림 전)
      *.md                       # 토픽별 메모리 파일
      team/                      # 팀 메모리 (TEAMMEM 기능)
      logs/YYYY/MM/YYYY-MM-DD.md # 일별 어시스턴트 로그
```

### 3.2 세션 트랜스크립트 (`<sessionId>.jsonl`)
- **형식**: JSONL (한 줄에 하나의 JSON 엔트리)
- **생성 시점**: 세션 시작 시
- **갱신 시점**: 매 메시지(사용자/어시스턴트), 도구 사용, 메타데이터 업데이트 시
- **쓰기 함수**: `appendEntryToFile()` (src/utils/sessionStorage.ts)
- **쓰기 방식**: 버퍼링 후 100ms마다 플러시, append-only
- **파일 권한**: `0o600` (소유자만 읽기/쓰기)
- **내용**: 대화 메시지, 도구 호출/결과, 파일 히스토리 스냅샷, 어트리뷰션 스냅샷

### 3.3 서브에이전트 메타데이터 (`agent-<id>.meta.json`)
- **형식**: JSON (`AgentMetadata`)
- **생성 시점**: 서브에이전트 실행 시
- **내용**: `{ agentType, worktreePath, description }`

### 3.4 자동 메모리 (`memory/`)
- **경로 결정 함수**: `getAutoMemPath()` (src/memdir/paths.ts:223-235)
- **경로 결정 우선순위**:
  1. `CLAUDE_COWORK_MEMORY_PATH_OVERRIDE` 환경변수
  2. `settings.json`의 `autoMemoryDirectory`
  3. `~/.claude/projects/<sanitized-git-root>/memory/`
- **`MEMORY.md` 생성**: 에이전트가 FileWriteTool로 작성
- **디렉토리 보장**: `ensureMemoryDirExists()` (프롬프트 빌드 시점)
- **보안 검증**: `validateMemoryPath()` — 위험한 경로 차단, UNC 경로 거부

---

## 4. 파일 히스토리 (`~/.claude/file-history/`)

### 4.1 파일 백업
- **경로**: `~/.claude/file-history/<sessionId>/<sanitized-file-path>`
- **생성 시점**: 파일 편집 전 (`FileEditTool`, `FileWriteTool` 실행 전)
- **목적**: Undo 기능 지원 — 편집 전 파일 상태를 스냅샷으로 저장
- **소스**: src/utils/fileHistory.ts:734-955

---

## 5. 캐시 파일

### 5.1 통계 캐시 (`stats-cache.json`)
- **경로**: `~/.claude/stats-cache.json`
- **형식**: JSON (`PersistedStatsCache` v3)
- **생성 시점**: 세션 종료 시 / 주기적 저장
- **원자적 쓰기**: `.tmp` 파일 → rename
- **잠금**: 인메모리 lock (`withStatsCacheLock()`)
- **내용**: 일별 활동, 모델별 토큰 사용량, 세션 집계

### 5.2 릴리스 노트 캐시 (`cache/changelog.md`)
- **경로**: `~/.claude/cache/changelog.md`
- **형식**: Markdown
- **생성 시점**: 릴리스 노트 확인 시 원격 fetch 후 캐시
- **소스**: src/utils/releaseNotes.ts:38

### 5.3 이미지 캐시 (`image-cache/`)
- **경로**: `~/.claude/image-cache/<sessionId>/`
- **생성 시점**: 이미지 첨부/처리 시
- **목적**: 세션 중 사용된 이미지 임시 저장
- **소스**: src/utils/imageStore.ts

### 5.4 붙여넣기 캐시 (`paste-cache/`)
- **경로**: `~/.claude/paste-cache/`
- **생성 시점**: 대용량 텍스트 붙여넣기 시
- **목적**: 큰 입력 데이터의 임시 저장
- **소스**: src/utils/pasteStore.ts

### 5.5 시스템 캐시 (OS별 경로)
- **macOS**: `~/Library/Caches/claude-cli/`
- **Linux**: `${XDG_CACHE_HOME}/claude-cli/`
- **Windows**: `%APPDATA%/claude-cli/`
- **하위 디렉토리**:
  - `errors/` — 에러 로그
  - `messages/` — 메시지 캐시
  - `mcp-logs-<sanitized-server-name>/` — MCP 서버별 로그
- **소스**: src/utils/cachePaths.ts:25-38

---

## 6. 플러그인 (`~/.claude/plugins/`)

### 6.1 디렉토리 구조
```
~/.claude/plugins/                    # 기본 (또는 cowork_plugins/)
  cache/<marketplace>/<plugin>/<ver>/ # 플러그인 설치 캐시
  data/<sanitized-pluginId>/          # 영속 플러그인 데이터 (업데이트 시 유지)
  known_marketplaces.json             # 알려진 마켓플레이스 목록
  marketplaces/<name>/...             # 마켓플레이스별 데이터
```
- **환경변수 오버라이드**: `CLAUDE_CODE_PLUGIN_CACHE_DIR`
- **시드 레이어**: `CLAUDE_CODE_PLUGIN_SEED_DIR` (읽기 전용 기본 플러그인)
- **소스**: src/utils/plugins/pluginDirectories.ts:53-178

---

## 7. 스크래치패드 (`scratchpad`)

- **경로**: 세션별 임시 디렉토리 (프로젝트 디렉토리 외부)
- **생성 시점**: 세션 시작 시 (`isScratchpadEnabled()` 확인)
- **목적**: Claude가 임시 파일을 자유롭게 쓸 수 있는 격리된 디렉토리
- **권한**: 권한 프롬프트 없이 자유 접근
- **소스**: src/utils/permissions/filesystem.ts, src/constants/prompts.ts:794-818

---

## 8. 플랜 (`~/.claude/plans/`)

- **경로**: `~/.claude/plans/<slug>.md` (기본) 또는 `settings.plansDirectory`
- **형식**: Markdown
- **생성 시점**: `/plan` 명령 또는 Plan 모드 진입 시
- **내용**: 작업 계획서 (단계별 구조)
- **소스**: src/utils/plans.ts

---

## 9. Asciicast 녹화

- **경로**: `~/.claude/projects/<sanitized-cwd>/<sessionId>.cast`
- **형식**: Asciicast v2 (JSONL — 헤더 + 이벤트)
- **생성 시점**: 녹화 모드 활성화 시 (`installAsciicastRecorder()`)
- **내용**: 터미널 출력 이벤트의 시간순 기록
- **소스**: src/utils/asciicast.ts

---

## 10. 예약 작업 (`scheduled_tasks.json`)

- **경로**: `<project>/.claude/scheduled_tasks.json`
- **형식**: JSON (`CronTask[]`)
- **생성 시점**: `/schedule` 또는 `CronCreateTool`로 작업 등록 시
- **잠금**: PID 기반 리스 락 (`cronTasksLock.ts`)
- **내용**:
  ```json
  [{
    "id": "uuid",
    "cron": "0 9 * * *",
    "prompt": "작업 설명",
    "createdAt": 1234567890,
    "recurring": true
  }]
  ```
- **소스**: src/utils/cronTasks.ts, src/utils/cronTasksLock.ts

---

## 11. 자동 업데이트

### 11.1 업데이트 락 파일 (`.update.lock`)
- **경로**: `~/.claude/.update.lock`
- **형식**: PID (프로세스 ID)
- **생성 시점**: 자동 업데이트 시작 시
- **만료**: 5분 stale-lock 타임아웃
- **소스**: src/utils/autoUpdater.ts:168-170

---

## 12. CLAUDE.md 설정 파일

### 12.1 글로벌 CLAUDE.md
- **경로**: `~/.claude/CLAUDE.md`
- **형식**: Markdown
- **생성 시점**: 사용자가 직접 생성/편집
- **목적**: 모든 프로젝트에 적용되는 사용자 개인 지시사항

### 12.2 글로벌 rules
- **경로**: `~/.claude/rules/*.md`
- **형식**: Markdown
- **목적**: 글로벌 규칙 파일 (CLAUDE.md와 함께 로드)

### 12.3 프로젝트 CLAUDE.md
- **경로**: `<project>/.claude/CLAUDE.md`, `<project>/CLAUDE.md`
- **추가 규칙**: `<project>/.claude/rules/*.md`
- **소스**: src/utils/claudemd.ts

---

## 13. 출력 스타일 (`output-styles/`)

- **글로벌**: `~/.claude/output-styles/*.md`
- **프로젝트**: `<project>/.claude/output-styles/*.md`
- **형식**: Markdown (프론트매터 포함)
- **생성 시점**: 사용자가 커스텀 출력 스타일을 정의할 때
- **소스**: src/outputStyles/loadOutputStylesDir.ts

---

## 14. Magic Docs

- **경로**: `~/.claude/magic-docs/prompt.md`
- **형식**: Markdown
- **생성 시점**: 사용자가 커스텀 Magic Docs 프롬프트를 작성할 때
- **목적**: 문서 검색 에이전트의 커스텀 프롬프트
- **소스**: src/services/MagicDocs/prompts.ts:68

---

## 15. 에이전트 메모리 (`agent-memory/`)

- **글로벌**: `~/.claude/agent-memory/<agentType>/`
- **프로젝트**: `<project>/.claude/agent-memory/<agentType>/`
- **로컬**: `<project>/.claude/agent-memory-local/<agentType>/`
- **스코프 결정**: `settings.json`의 `agentMemoryScope` (`'user'` | `'project'` | `'local'`)
- **소스**: src/entrypoints/sdk/coreSchemas.ts:1166

---

## 16. 팀 디렉토리 (`teams/`)

- **경로**: `~/.claude/teams/`
- **목적**: 팀별 데이터 저장 (`TEAMMEM` 기능 게이트)
- **하위 구조**: `~/.claude/teams/<teamName>/permissions/` (권한 동기화)
- **소스**: src/utils/envUtils.ts:17, src/utils/swarm/permissionSync.ts:110

---

## 17. 세션 환경 (`session-environments/`)

- **경로**: `~/.claude/session-environments/`
- **목적**: 세션별 환경 정보 저장
- **소스**: src/utils/sessionEnvironment.ts:17

---

## 전체 디렉토리 트리 요약

```
~/.claude/
  .claude.json (.claude-oauth.json)   # 글로벌 설정 + 인증
  settings.json                        # 사용자 설정
  managed-settings.json                # 관리자 정책 설정
  managed-settings.d/*.json            # 관리자 정책 drop-in
  managed-mcp.json                     # 관리자 MCP 설정
  keybindings.json                     # 키보드 단축키
  stats-cache.json                     # 통계 캐시
  .update.lock                         # 자동 업데이트 락
  CLAUDE.md                            # 글로벌 사용자 지시사항
  rules/*.md                           # 글로벌 규칙
  cache/
    changelog.md                       # 릴리스 노트 캐시
  projects/
    <sanitized-cwd>/
      <sessionId>.jsonl                # 대화 트랜스크립트
      <sessionId>.cast                 # Asciicast 녹화
      <sessionId>/
        subagents/                     # 서브에이전트 데이터
        remote-agents/                 # 원격 에이전트 데이터
      memory/
        MEMORY.md                      # 메모리 인덱스
        *.md                           # 토픽별 메모리
        team/                          # 팀 메모리
        logs/                          # 일별 로그
  file-history/
    <sessionId>/                       # 편집 전 파일 백업 (Undo)
  image-cache/
    <sessionId>/                       # 이미지 임시 캐시
  paste-cache/                         # 붙여넣기 임시 캐시
  plans/
    <slug>.md                          # 작업 계획서
  plugins/
    cache/                             # 플러그인 설치 캐시
    data/                              # 플러그인 영속 데이터
    known_marketplaces.json            # 마켓플레이스 목록
  teams/
    <teamName>/permissions/            # 팀 권한 동기화
  output-styles/*.md                   # 커스텀 출력 스타일
  magic-docs/prompt.md                 # Magic Docs 커스텀 프롬프트
  agent-memory/<agentType>/            # 글로벌 에이전트 메모리
  session-environments/                # 세션 환경 정보
```

---

## 파일 권한 및 보안

| 패턴 | 권한 | 설명 |
|------|------|------|
| 설정/트랜스크립트 파일 | `0o600` | 소유자만 읽기/쓰기 |
| 디렉토리 | `0o700` | 소유자만 접근 |
| 원자적 쓰기 | temp + rename | 파일 손상 방지 |
| 메모리 경로 검증 | `validateMemoryPath()` | 위험 경로 차단 |
| 자격증명 | Keychain 우선 | 파일 폴백은 최후 수단 |

---

## 환경변수 오버라이드 정리

| 환경변수 | 기본값 | 목적 |
|---------|--------|------|
| `CLAUDE_CONFIG_DIR` | `~/.claude` | 전체 설정 디렉토리 변경 |
| `CLAUDE_CODE_DISABLE_AUTO_MEMORY` | (비활성) | 자동 메모리 비활성화 |
| `CLAUDE_CODE_REMOTE_MEMORY_DIR` | `~/.claude` | 원격 세션 메모리 경로 |
| `CLAUDE_COWORK_MEMORY_PATH_OVERRIDE` | (없음) | Cowork 메모리 경로 완전 오버라이드 |
| `CLAUDE_CODE_PLUGIN_CACHE_DIR` | `~/.claude/plugins` | 플러그인 캐시 디렉토리 |
| `CLAUDE_CODE_PLUGIN_SEED_DIR` | (없음) | 읽기전용 플러그인 시드 레이어 |
| `CLAUDE_CODE_USE_COWORK_PLUGINS` | `false` | Cowork 플러그인 디렉토리 사용 |
| `CLAUDE_CODE_OAUTH_TOKEN` | (없음) | OAuth 토큰 직접 전달 |

---

## 18. 추가 발견 파일 (2차 분석)

### 18.1 자격증명 파일 (`.credentials.json`)
- **경로**: `~/.claude/.credentials.json`
- **형식**: JSON (`SecureStorageData`)
- **권한**: `0o600`
- **생성 시점**: Keychain 사용 불가 시 폴백으로 OAuth 토큰 저장
- **내용**: `{ mcpOAuth: Record<string, TokenData> }`
- **소스**: src/utils/secureStorage/ (plainTextStorage)

### 18.2 명령어 히스토리 (`history.jsonl`)
- **경로**: `~/.claude/history.jsonl`
- **형식**: JSONL
- **생성 시점**: 매 명령어 실행 시 (append-only)
- **내용**: `{ sessionId, timestamp, display, project }`
- **용도**: Up-arrow 히스토리, Ctrl+R 검색
- **소스**: src/history.ts

### 18.3 설정 백업 (`backups/`)
- **경로**: `~/.claude/backups/<filename>.backup.<timestamp>` 또는 `<filename>.corrupted.<timestamp>`
- **생성 시점**: 설정 파일 손상 감지 시
- **목적**: 손상된 설정 파일의 복구용 백업
- **소스**: src/utils/config.ts

### 18.4 MCP 인증 캐시 (`mcp-needs-auth-cache.json`)
- **경로**: `~/.claude/mcp-needs-auth-cache.json`
- **형식**: JSON
- **생성 시점**: MCP 서버 인증 확인 시
- **목적**: 인증이 필요한 MCP 서버 목록 캐시

### 18.5 MCP 토큰 리프레시 락 (`mcp-refresh-<key>.lock`)
- **경로**: `~/.claude/mcp-refresh-<sanitizedKey>.lock`
- **생성 시점**: MCP OAuth 토큰 갱신 시
- **목적**: 동시 토큰 갱신 방지 락

### 18.6 Computer Use 락 (`computer-use.lock`)
- **경로**: `~/.claude/computer-use.lock`
- **생성 시점**: Computer Use 도구 활성화 시
- **목적**: Computer Use 단일 실행 보장

### 18.7 플러그인 레지스트리
- **경로**: `~/.claude/plugins/installed_plugins.json` (v1), `installed_plugins_v2.json` (v2)
- **형식**: JSON (`Record<pluginId, PluginRegistryEntry>`)
- **생성 시점**: 플러그인 설치/업데이트 시
- **목적**: 설치된 플러그인 목록 관리

### 18.8 성능 프로파일링 (`startup-perf/`)
- **경로**: `~/.claude/startup-perf/<sessionId>.txt`
- **형식**: 텍스트
- **생성 시점**: 성능 프로파일링 활성화 시
- **목적**: 시작 시간 측정 데이터

### 18.9 텔레메트리 (`telemetry/`)
- **경로**: `~/.claude/telemetry/`
- **생성 시점**: 분석 이벤트 로깅 시
- **목적**: 사용 통계 및 텔레메트리 데이터

### 18.10 사용량 데이터 (`usage-data/`)
- **경로**: `~/.claude/usage-data/`
- **생성 시점**: 사용량 기록 시
- **목적**: API 호출 사용량 통계

### 18.11 업로드 파일 (`uploads/`)
- **경로**: `~/.claude/uploads/<sessionId>/`
- **생성 시점**: 파일 첨부 시
- **목적**: 세션에 첨부된 파일의 임시 저장

### 18.12 로컬 설치 (`local/`)
- **경로**: `~/.claude/local/`
- **생성 시점**: `npm install` 기반 로컬 설치 시
- **목적**: Claude Code의 로컬 npm 설치본
- **참조**: `~/.claude/local/claude` (실행 파일 심볼릭 링크)

### 18.13 Chrome 디버그 (`debug/chrome-native-host.txt`)
- **경로**: `~/.claude/debug/chrome-native-host.txt`
- **생성 시점**: Claude in Chrome 활성화 시
- **목적**: Chrome 네이티브 호스트 디버그 출력

### 18.14 Bridge 포인터 (`bridge-pointer.json`)
- **경로**: `~/.claude/projects/<sanitized-cwd>/bridge-pointer.json`
- **형식**: JSON
- **생성 시점**: 원격 세션(CCR) 설정 시
- **목적**: 원격 브릿지 세션 연결 정보

### 18.15 글로벌 스킬 및 에이전트
- **스킬**: `~/.claude/skills/` — 사용자 전역 커스텀 스킬
- **에이전트**: `~/.claude/agents/` — 사용자 전역 커스텀 에이전트
- **커맨드**: `~/.claude/commands/` — 사용자 전역 슬래시 커맨드

---

## 전체 락 파일 정리

| 락 파일 | 용도 | 타임아웃 |
|---------|------|---------|
| `.update.lock` | 자동 업데이트 동시 실행 방지 | 5분 |
| `mcp-refresh-<key>.lock` | MCP OAuth 토큰 동시 갱신 방지 | 재시도 로직 |
| `computer-use.lock` | Computer Use 단일 실행 보장 | - |
| `scheduled_tasks.lock` | 크론 스케줄러 동시 실행 방지 | PID 기반 |
| 플러그인 `.lock` | 플러그인 설치/삭제 동시 실행 방지 | - |

---

## 전체 디렉토리 트리 (보강판)

```
~/.claude/
  .claude.json / .claude-oauth.json    # 글로벌 설정 + 인증
  .credentials.json                    # 자격증명 폴백 (0o600)
  settings.json                        # 사용자 설정
  managed-settings.json                # 관리자 정책 설정
  managed-settings.d/*.json            # 관리자 정책 drop-in
  managed-mcp.json                     # 관리자 MCP 설정
  keybindings.json                     # 키보드 단축키
  stats-cache.json                     # 통계 캐시
  history.jsonl                        # 명령어 히스토리
  mcp-needs-auth-cache.json            # MCP 인증 캐시
  .update.lock                         # 자동 업데이트 락
  computer-use.lock                    # Computer Use 락
  mcp-refresh-*.lock                   # MCP 토큰 갱신 락
  CLAUDE.md                            # 글로벌 사용자 지시사항
  rules/*.md                           # 글로벌 규칙
  skills/                              # 글로벌 커스텀 스킬
  agents/                              # 글로벌 커스텀 에이전트
  commands/                            # 글로벌 슬래시 커맨드
  output-styles/*.md                   # 커스텀 출력 스타일
  magic-docs/prompt.md                 # Magic Docs 프롬프트
  agent-memory/<agentType>/            # 글로벌 에이전트 메모리
  session-environments/                # 세션 환경 정보
  backups/                             # 설정 백업/복구
  cache/
    changelog.md                       # 릴리스 노트 캐시
  local/                               # 로컬 npm 설치
  debug/
    chrome-native-host.txt             # Chrome 디버그
  startup-perf/
    <sessionId>.txt                    # 시작 성능 프로파일
  telemetry/                           # 텔레메트리 데이터
  usage-data/                          # 사용량 통계
  uploads/
    <sessionId>/                       # 첨부 파일 임시 저장
  projects/
    <sanitized-cwd>/
      <sessionId>.jsonl                # 대화 트랜스크립트
      <sessionId>.cast                 # Asciicast 녹화
      bridge-pointer.json              # 원격 세션 포인터
      <sessionId>/
        subagents/                     # 서브에이전트 데이터
          agent-<id>.jsonl
          agent-<id>.meta.json
        remote-agents/                 # 원격 에이전트 데이터
          remote-agent-<taskId>.meta.json
      memory/
        MEMORY.md                      # 메모리 인덱스 (200줄/25KB)
        MEMORY.md.bak                  # 메모리 백업
        *.md                           # 토픽별 메모리
        team/                          # 팀 메모리
        logs/YYYY/MM/YYYY-MM-DD.md     # 일별 로그
  file-history/
    <sessionId>/                       # 편집 전 파일 백업 (Undo)
  image-cache/
    <sessionId>/                       # 이미지 임시 캐시
  paste-cache/                         # 붙여넣기 임시 캐시
  plans/
    <slug>.md                          # 작업 계획서
  plugins/
    cache/                             # 플러그인 설치 캐시
    data/<pluginId>/                   # 플러그인 영속 데이터
    installed_plugins.json             # 플러그인 레지스트리 v1
    installed_plugins_v2.json          # 플러그인 레지스트리 v2
    known_marketplaces.json            # 마켓플레이스 목록
  teams/
    <teamName>/
      config.json                      # 팀 설정
      permissions/
        pending/<requestId>.json       # 대기 중 권한 요청
        resolved/<requestId>.json      # 처리된 권한 요청
```
