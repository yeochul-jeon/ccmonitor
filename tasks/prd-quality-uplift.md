# PRD: Code Quality Uplift — Lift C-grade Dimensions to B

**Status:** Draft
**Date:** 2026-04-17
**Source report:** `quality-20260417.md`
**Owner:** ccmonitor maintainer
**Estimated effort:** 4-6 focused sessions, sequenced as 5 phases

---

## 1. Introduction / Overview

The most recent code quality audit (`quality-20260417.md`) graded the ccmonitor codebase **54/100 (D overall)**. Five quality dimensions scored at C+ or below and need to reach the **B threshold (75+)**:

| Dimension | Current | Target | Gap |
|---|---|---|---|
| Maintainability | 62 (C+) | 75+ (B) | +13 |
| Extensibility | 38 (F) | 75+ (B) | +37 |
| Testability | 22 (F) | 75+ (B) | +53 |
| Test Quality | 1 (F) | 70+ (B-) | +69 |
| Performance | 62 (C+) | 75+ (B) | +13 |

Already-B dimensions (Readability 84, Consistency 78, Security 78, Dependency Mgmt 88) **must not regress**.

The plan exploits a single high-leverage refactor — extracting a pure `parseTranscriptPure(content, …)` function from `parseTranscript` — that simultaneously moves four of the five dimensions. Subsequent phases address the remaining gaps with mechanical, reviewable changes.

---

## 2. Goals

- **G1.** Lift Testability from 22 (F) → 75+ (B) by introducing dependency injection seams for the file system, clock, and process boundaries.
- **G2.** Lift Test Quality from 1 (F) → 70+ (B-) by adding a Bun test suite covering the 5 highest-value test targets identified in the audit.
- **G3.** Lift Maintainability from 62 (C+) → 75+ (B) by splitting the two god-functions (`processEntry` 165 LOC, `render` 300 LOC) and de-duplicating the loader pattern.
- **G4.** Lift Extensibility from 38 (F) → 75+ (B) by introducing a `Section[]` array in the renderer, a loader registry in the parser, and an environment-overridable `CLAUDE_DIR`.
- **G5.** Lift Performance from 62 (C+) → 75+ (B) by adding mtime-based transcript caching, converting sync I/O to parallel async, precompiling regex, and fixing the O(n²) task lookup.
- **G6.** Preserve all currently-B dimensions and zero runtime behavior changes for the user (same TUI output, same keybindings, same CLI args).

---

## 3. User Stories

The "user" throughout is the ccmonitor maintainer/contributor.

### Phase 1 — Foundation (unblocks the rest)

#### US-001: Add `tsconfig.json` and `@types/bun` to clear LSP errors
**Description:** As a contributor, I want my IDE to type-check the project correctly so I see real errors instead of 29 false positives about missing `process`/`fs`/`path`.

**Acceptance Criteria:**
- [ ] `tsconfig.json` exists at project root with `"types": ["bun"]`, `strict: true`, `noUncheckedIndexedAccess: true`
- [ ] `@types/bun` added to `devDependencies` via `bun add -d @types/bun`
- [ ] Running `bunx tsc --noEmit` produces 0 errors
- [ ] `bun run start` and `bun run build` still succeed
- [ ] `package.json` adds `"typecheck": "tsc --noEmit"` script

#### US-002: Add Bun test runner with 3 starter tests
**Description:** As a contributor, I want a working test command so I can run `bun test` and see green output before adding more tests.

**Acceptance Criteria:**
- [ ] `package.json` adds `"test": "bun test"` and `"test:watch": "bun test --watch"` scripts
- [ ] `src/parser.test.ts` exists with 3 passing tests for `extractRealUserPrompt`:
  - plain text input returns the input unchanged
  - `<command-args>foo</command-args>` extracts `foo`
  - hook-status preamble (`hook success: …`) is stripped
- [ ] `bun test` exits with code 0
- [ ] Typecheck passes

### Phase 2 — Refactor for testability (high-leverage)

#### US-003: Extract `parseTranscriptPure` from `parseTranscript`
**Description:** As a contributor, I want the line-by-line transcript parsing isolated from the seven disk-touching loaders so I can unit-test parsing without a real `~/.claude` tree.

**Acceptance Criteria:**
- [ ] New exported function `parseTranscriptPure(content: string, sessionId: string, projectDir: string, transcriptFile: string): SessionState` exists in `src/parser.ts`
- [ ] `parseTranscriptPure` performs ONLY the JSONL → `SessionState` work — no `readFileSync`, no `existsSync`, no `Date.now`, no `process.kill`
- [ ] New function `enrichSessionState(state: SessionState): void` orchestrates the 7 loaders (`loadSubagents`, `loadTeams`, `loadTasks`, `loadSkillHookState`, `readGitBranch`, `loadEditedFilesCount`, `loadActiveSessions`, `loadMemoryInfo`, `loadEffortLevel`)
- [ ] Existing `parseTranscript(transcriptFile, sessionId)` becomes a thin orchestrator: `readFileSync` → `parseTranscriptPure` → `enrichSessionState` → return
- [ ] `bun run start` produces visually identical output to the previous build
- [ ] Typecheck + existing tests pass

#### US-004: Export `displayWidth`, `wordWrap`, `processEntry`
**Description:** As a contributor, I want the pure helpers in `ui.ts` and `parser.ts` exported so I can write table-driven tests against them.

**Acceptance Criteria:**
- [ ] `displayWidth`, `wordWrap`, `stripAnsi`, `pad`, `rpad`, `formatDuration`, `formatTokens`, `formatTime`, `getContextLimit` exported from `src/ui.ts`
- [ ] `processEntry`, `cwdToProjectDirName`, `projectDirToRealCwd` already-exported or newly-exported from `src/parser.ts`
- [ ] No runtime behavior change (purely additive exports)
- [ ] Typecheck passes

#### US-005: Test suite for the 5 priority targets
**Description:** As a maintainer, I want regression protection on the 5 highest-risk pure functions identified in the audit.

**Acceptance Criteria:**
- [ ] `src/parser.test.ts` covers:
  - `extractRealUserPrompt` — at least 8 cases (each documented branch: command-args, command-name, 6 wrapper tags, hook-status filter, skill preamble filter, plain text)
  - `cwdToProjectDirName` ↔ `projectDirToRealCwd` round-trip — at least 6 cases including paths with `_`, multiple `/`, trailing slash; failing cases (lossy `_`) are documented as `expect.todo()` or asserted with explicit expected lossy behavior
  - `processEntry` state machine — at least 5 synthetic-`TranscriptEntry` cases asserting token aggregation, model tracking, slash-command vs Skill-tool dual paths, end_turn promotion
- [ ] `src/ui.test.ts` covers:
  - `displayWidth` — boundary codepoints (U+1100, U+115F, U+2E80, U+FF60, BMP emoji, surrogate-pair emoji, ASCII, combining mark, ANSI-wrapped string)
  - `wordWrap` — long-token char-break path, leading-whitespace skip, hard `\n` preservation, CJK width accounting
- [ ] **≥ 30 total assertions** across both files
- [ ] `bun test` passes; `bun test --coverage` reports ≥ 50% line coverage on `src/parser.ts` and `src/ui.ts` combined
- [ ] Typecheck passes

### Phase 3 — Decompose god-functions

#### US-006: Split `processEntry` into per-type handlers
**Description:** As a contributor, I want the 165-line `processEntry` cascade split so each handler is independently readable and testable.

**Acceptance Criteria:**
- [ ] `processEntry` body reduced to ≤ 30 lines (dispatch only)
- [ ] At least 5 helper functions extracted, each ≤ 40 lines: e.g. `handleAssistantMessage`, `handleToolUse`, `handleSlashCommand`, `handleSkillTag`, `handleTaskUpdate`
- [ ] Variable shadowing (`existing` declared twice) at `parser.ts:519, 531` resolved
- [ ] All US-005 tests still pass — output is byte-identical for the same input
- [ ] Cyclomatic complexity of the longest function in `parser.ts` drops to ≤ 10 (measure: count of `if`/`for`/`switch`/`&&`/`||` + 1)

#### US-007: Replace `render()` body with a `Section[]` array
**Description:** As a contributor, I want adding a new render block (e.g. "MCP Servers") to mean appending to a `Section[]` array, not editing the middle of a 300-line function.

**Acceptance Criteria:**
- [ ] New interface `interface Section { title: string; render(state: SessionState, width: number): string; }` exported from `src/ui.ts`
- [ ] At least 6 of the 8 box sections (Tools, Subagents, Skill, Teams, Tasks, Memory, File Activity) implemented as `Section` objects in a `const SECTIONS: Section[] = [...]` array
- [ ] `render()` body reduced to ≤ 80 lines: header + `for (const s of SECTIONS) out += s.render(state, width)` + footer
- [ ] Visually identical TUI output to prior build (manual side-by-side check, screenshot in PR description)
- [ ] At least one `Section.render` function has a unit test asserting it produces expected ANSI for a sample state

### Phase 4 — Performance

#### US-008: mtime-based transcript cache
**Description:** As a user, I want the 2-second refresh tick to skip re-parsing the transcript when nothing has changed, so my CPU stays cool on long-running sessions.

**Acceptance Criteria:**
- [ ] `parseTranscript` returns a cached `SessionState` when `statSync(transcriptFile).mtimeMs` equals the last-seen mtime
- [ ] Cache stores `(transcriptFile, mtimeMs, byteOffset, lastState)` — incremental tail OPTIONAL but mtime guard REQUIRED
- [ ] Manual verification: idle session for 10 seconds shows ≤ 1 transcript read in `strace`/`fs.opens` log
- [ ] Behavior on file rotation (mtime ↓ or file shrunk): cache invalidated, full re-read
- [ ] Tests: at least 2 unit tests asserting cache-hit and cache-miss paths

#### US-009: Parallelize async loaders
**Description:** As a user, I want refresh ticks to not block on sequential `*Sync` calls.

**Acceptance Criteria:**
- [ ] At least 4 loaders converted to `async`: `loadSubagents`, `loadTeams`, `loadTasks`, `loadActiveSessions`
- [ ] `enrichSessionState` runs converted loaders in parallel via `await Promise.all([...])`
- [ ] Sync loaders (`readGitBranch`, `loadEffortLevel`) may stay sync if conversion adds complexity for marginal gain — document the call
- [ ] No regression in TUI behavior; refresh tick latency manually verified equal-or-better
- [ ] Typecheck + tests pass

#### US-010: Quick-win perf fixes
**Description:** Three bounded fixes that the audit called out individually.

**Acceptance Criteria:**
- [ ] Wrapper-tag regexes precompiled at module scope in `parser.ts` (was `new RegExp(...)` per call inside `extractRealUserPrompt`)
- [ ] `tasks.find(t => t.id === entry.taskId)` at `parser.ts:572` replaced with a `Map<string, Task>` lookup; same change for `loadTasks` at `parser.ts:671`
- [ ] Dead state field `recentFiles` removed from `types.ts:134` and `parser.ts:87`
- [ ] Tests still pass; no behavior change observable in the TUI

### Phase 5 — Maintainability sweep

#### US-011: De-duplicate the 7 loader pattern
**Description:** As a contributor, I want the `existsSync(...) ? try { JSON.parse(readFileSync(...)) } catch {}` pattern factored into a helper.

**Acceptance Criteria:**
- [ ] New helper `safeReadJson<T>(path: string, fallback: T): T` exported from `src/parser.ts`
- [ ] At least 4 loaders refactored to use it (`loadEffortLevel`, `loadEditedFilesCount`, `loadSkillHookState`, `loadActiveSessions` — pick any 4)
- [ ] Net LOC removed from `src/parser.ts` ≥ 30 lines
- [ ] Tests still pass

#### US-012: Make `CLAUDE_DIR` overridable
**Description:** As a contributor, I want to point ccmonitor at a fixture directory in tests by setting an env var, rather than monkey-patching `homedir()`.

**Acceptance Criteria:**
- [ ] `CLAUDE_DIR` resolved as `process.env.CLAUDE_HOME ?? join(homedir(), '.claude')` in BOTH `src/parser.ts` and `src/index.ts`
- [ ] README mentions the `CLAUDE_HOME` env var in a "Configuration" section
- [ ] At least one integration test uses `CLAUDE_HOME` to point at a fixture and exercises `parseTranscript` end-to-end on a synthetic JSONL file

#### US-013: Extract magic numbers to named constants
**Description:** As a contributor, I want `30_000` (subagent-idle), `MAX_CHARS`, color thresholds, and slice limits named at file top.

**Acceptance Criteria:**
- [ ] Top of `src/parser.ts` exports/declares: `SUBAGENT_IDLE_MS = 30_000`, `SKILL_HOOK_STALE_MS = 5 * 60 * 1000`
- [ ] Top of `src/ui.ts` declares: `CONTEXT_RED_THRESHOLD = 85`, `CONTEXT_YELLOW_THRESHOLD = 70`, `MAX_PROMPT_CHARS`, `HISTORY_TAIL = 8`, `TASK_TAIL = 6`, `MEMORY_TAIL = 5`
- [ ] CJK width table extracted to `const CJK_RANGES: ReadonlyArray<readonly [number, number]> = [...]`
- [ ] Tests still pass

---

## 4. Functional Requirements

Numbered for traceability. Every requirement maps to at least one user story.

### Type system & build
1. The project SHALL include a `tsconfig.json` declaring `"types": ["bun"]`, `strict: true`, `noUncheckedIndexedAccess: true`. _(US-001)_
2. The project SHALL include `@types/bun` in `devDependencies`. _(US-001)_
3. `bunx tsc --noEmit` SHALL exit with code 0. _(US-001)_

### Test infrastructure
4. The project SHALL include `bun test` and `bun test --watch` scripts in `package.json`. _(US-002)_
5. `bun test` SHALL exit with code 0 with at least 30 assertions across at least 2 test files. _(US-002, US-005)_
6. Test files SHALL be co-located with their subjects (`src/parser.test.ts`, `src/ui.test.ts`). _(US-002)_

### Parser refactor
7. A function `parseTranscriptPure(content, sessionId, projectDir, transcriptFile): SessionState` SHALL exist, perform NO disk I/O, and be exported from `src/parser.ts`. _(US-003)_
8. Pure functions `cwdToProjectDirName`, `projectDirToRealCwd`, `extractRealUserPrompt`, `processEntry` SHALL be exported. _(US-004)_
9. `processEntry` SHALL have ≤ 30 lines after extraction; helpers SHALL each have ≤ 40 lines. _(US-006)_

### Renderer refactor
10. `src/ui.ts` SHALL export `interface Section { title: string; render(state, width): string }`. _(US-007)_
11. At least 6 of the 8 box sections SHALL be implemented as `Section` objects in a module-level `SECTIONS: Section[]` array. _(US-007)_
12. `render()` body SHALL be ≤ 80 lines after refactor. _(US-007)_
13. `displayWidth`, `wordWrap`, formatters SHALL be exported. _(US-004)_

### Performance
14. `parseTranscript` SHALL skip re-parsing when transcript mtime is unchanged since the last call. _(US-008)_
15. At least 4 disk loaders SHALL be `async` and run via `Promise.all` in `enrichSessionState`. _(US-009)_
16. Wrapper-tag regexes SHALL be compiled once at module scope. _(US-010)_
17. The per-line `tasks.find(...)` lookup SHALL be replaced with a `Map<string, Task>`. _(US-010)_

### Configuration & cleanup
18. `CLAUDE_DIR` SHALL resolve as `process.env.CLAUDE_HOME ?? join(homedir(), '.claude')`. _(US-012)_
19. The `recentFiles` field SHALL be removed from `SessionState`. _(US-010)_
20. A `safeReadJson<T>(path, fallback)` helper SHALL replace the loader-pattern duplication in at least 4 sites. _(US-011)_
21. Magic numbers (`30_000`, `5*60*1000`, color thresholds, slice limits) SHALL be replaced with named constants at file tops. _(US-013)_

### Behavior preservation (cross-cutting)
22. After every phase, `bun run start` SHALL produce visually identical TUI output for the same `~/.claude` state.
23. After every phase, the keybindings (`q`, `r`, `n`) SHALL behave identically.
24. After every phase, `bun run build` SHALL succeed and the resulting `dist/ccmonitor` binary SHALL run.

---

## 5. Non-Goals (Out of Scope)

- **NG-1.** Adding new user-facing features (e.g. cost panel, MCP-server status). The plan is a quality refactor, not a feature push.
- **NG-2.** Changing the TUI visual design, color scheme, or layout. Output must remain byte-identical.
- **NG-3.** Changing CLI arg parsing, keybindings, or hook script behavior.
- **NG-4.** Removing chokidar in favor of native `fs.watch`. Identified as plausible in the audit but out of scope here — would be a separate PRD.
- **NG-5.** Eliminating the path-traversal risk on `sessionId` (audit Issue #4). Security work is tracked separately; this PRD targets only the C-or-below dimensions.
- **NG-6.** Eliminating the `cwdToProjectDirName` ↔ `projectDirToRealCwd` lossy `_` round-trip. US-005 documents the behavior with a test; the underlying fix needs a separate design discussion (store original cwd in side-channel? change escape character?).
- **NG-7.** Adopting a non-Bun test framework (vitest/jest). Bun's built-in `bun:test` is the choice — zero deps, matches project ethos.
- **NG-8.** Reaching A-grade (90+) on any dimension. The contract is "C or below → B (75+)". Stop at B.
- **NG-9.** End-to-end tests that spawn a real terminal or assert pixel-exact output. Unit-level coverage of pure functions and snapshot tests on `Section.render` are sufficient.
- **NG-10.** Cross-platform Windows support. ccmonitor is macOS/Linux-targeted today; that does not change.

---

## 6. Design Considerations

### Phasing rationale
Phase 1 (US-001, US-002) is a 30-minute prerequisite that unblocks everything: without `tsconfig.json` the IDE shows 29 false errors and any contributor would assume the project is broken; without `bun test` running, the test stories cannot be verified.

Phase 2 (US-003–005) is the **single most leveraged change in the entire plan**: extracting `parseTranscriptPure` simultaneously moves Testability F→C, Test Quality F→C, Performance C+→B (via the cache that US-008 then adds on top), and Extensibility F→C (the loader registry pattern that US-011 then formalizes). If the maintainer can only afford 2 sessions, Phases 1+2 alone reach roughly C+ across all dimensions.

Phases 3-5 are mechanical sweeps; they can run in any order after Phase 2 lands.

### Visual fidelity
The TUI is the user-visible product. After each PR, the maintainer SHOULD capture a side-by-side terminal screenshot of the `before` and `after` state and attach it to the PR description. Diff-based assertion is impractical (color codes, dynamic content) — manual visual review is the contract.

### Section refactor (US-007) — minimal interface
Resist the urge to design a plugin system. The interface is:

```ts
interface Section {
  title: string;
  render(state: SessionState, width: number): string;
}
```

No registration API, no lifecycle hooks, no priority/order field — order is just array index. If a future PRD needs a plugin system, this interface extends cleanly.

### Test data fixtures
Place synthetic JSONL fixtures under `src/__fixtures__/` (kebab-case filenames). Each fixture is a small, hand-curated transcript demonstrating one specific shape (e.g. `assistant-with-skill-tool.jsonl`, `slash-command-with-args.jsonl`). Fixtures are committed; they are documentation as much as test input.

---

## 7. Technical Considerations

### Dependencies
- **Add:** `@types/bun` (devDependency only — does not bloat the runtime binary).
- **No runtime deps added.** chokidar stays at `^4.0.0`.

### Bun version
Pin to `"engines": { "bun": ">=1.1.0" }` in `package.json` as part of US-001. 1.1+ provides `Bun.file` async API used in US-009.

### Compatibility
- The CLI is a personal/private tool (`"private": true`). No public API contract — refactors are free to rename internal symbols. Exports added in US-004 are purely additive.
- The `dist/ccmonitor` binary contract (binary name, CLI args, stdin/stdout behavior) is unchanged.

### Risk register
| Risk | Likelihood | Mitigation |
|---|---|---|
| TUI visual regression after `Section[]` refactor | Medium | Manual side-by-side screenshot in every PR; keep `render()` shell minimal |
| Cache invalidation bug in US-008 (stale state shown) | Medium | Cache keyed on `mtimeMs + size`; invalidate aggressively on any anomaly; add 2 unit tests for cache-miss paths |
| Async loader race conditions in US-009 | Low | All loaders mutate disjoint fields of `SessionState`; `Promise.all` is the only joining primitive — no shared accumulators |
| `processEntry` split changes behavior | Medium | US-005 tests must be written BEFORE US-006 split; that's why Phase 2 precedes Phase 3 |
| Test coverage target unmet | Low | Audit identified 5 high-value targets; 30 assertions across them is achievable |

### Sequencing constraint
**US-005 must complete before US-006.** Splitting `processEntry` without tests in place is exactly the change pattern the audit flagged as risky.

### Tooling commands the maintainer will run
```bash
bun add -d @types/bun         # US-001
bun run typecheck             # US-001 (added by this PRD)
bun test                      # US-002+
bun test --watch              # development
bun test --coverage           # US-005 verification
bun run build                 # US-001/per-phase verification
```

---

## 8. Success Metrics

The plan is "done" when re-running the quality audit produces this scorecard:

| Dimension | Before | After (target) | Verification |
|---|---|---|---|
| Maintainability | 62 (C+) | **75+ (B)** | `parser.ts` ≤ 600 LOC; `processEntry` ≤ 30 LOC; 4+ loaders use `safeReadJson` |
| Extensibility | 38 (F) | **75+ (B)** | `Section[]` exists; `CLAUDE_HOME` env override works; loaders extracted from `parseTranscript` |
| Testability | 22 (F) | **75+ (B)** | `parseTranscriptPure` exists & is pure; `displayWidth`/`wordWrap`/`processEntry` exported; FS injectable via `CLAUDE_HOME` |
| Test Quality | 1 (F) | **70+ (B-)** | ≥ 30 assertions; ≥ 50% line coverage on `parser.ts`+`ui.ts`; all 5 priority targets covered |
| Performance | 62 (C+) | **75+ (B)** | mtime cache present; idle 10 s = 0 reparses; ≥ 4 async loaders parallelized; regex precompiled; tasks lookup is `Map` |

**Non-regression assertions** (must remain ≥ current scores):
- Readability ≥ 84
- Consistency ≥ 78
- Security ≥ 78
- Dependency Mgmt ≥ 88

**Behavioral assertion:**
- `bun run start` produces visually identical TUI output before and after the entire plan, against the same `~/.claude` state.
- `bun run build` produces a working binary.

**Quantitative checkpoints:**
- LSP errors: 29 → 0
- Test files: 0 → ≥ 2
- Test assertions: 0 → ≥ 30
- LOC of `processEntry`: 165 → ≤ 30
- LOC of `render()`: 300 → ≤ 80
- Files > 700 LOC: 1 → 0

---

## 9. Open Questions

1. **Cache strategy for US-008** — Is a simple "mtime equal → reuse last state" guard sufficient, or do we want full incremental tail-from-byte-offset parsing on the first iteration? Recommendation: ship mtime-only first (10× simpler), revisit incremental tail in a follow-up PRD if profiling still flags `parseTranscript`.
2. **Coverage threshold enforcement** — Should `bun test --coverage` be wired into a CI step that fails below 50%? There's currently no CI; this PRD does not add one. Decision deferred.
3. **`projectDirToRealCwd` lossy `_` behavior** — US-005 asks the maintainer to either document the lossy behavior with a passing test or mark it `expect.todo()`. The "correct" fix (e.g. store original cwd in `~/.claude/sessions/<pid>.json`) is out of scope here.
4. **`Section[]` ordering** — Should section order be hard-coded in the array literal, or driven by user config (e.g. `~/.claude/.omc/ccmonitor.json`)? Recommendation: hard-coded for this PRD; user config is a separate feature.
5. **Async migration scope** — Does converting only 4 loaders to async leave a "mixed sync/async" smell? Recommendation: yes, accept the smell — converting `readGitBranch` and `loadEffortLevel` adds complexity (file is small, stays in OS cache, sync is fine) and the audit's perf concern is dominated by the transcript read, not these loaders.

---

## Appendix A — Mapping to audit issues

| Audit Issue | Severity | Addressed by |
|---|---|---|
| #1 Zero test coverage | Critical | US-002, US-005, FR-4, FR-5 |
| #2 Full transcript reparse every 2 s | High | US-008, FR-14 |
| #3 god-functions `processEntry` & `render` | High | US-006, US-007, FR-9, FR-12 |
| #4 Path-traversal & `_` asymmetry | High | **NG-5, NG-6** (out of scope; tracked separately) |
| #5 No `tsconfig.json` → 29 LSP errors | Medium | US-001, FR-1, FR-2, FR-3 |
| #6 Sync I/O blocks event loop | Medium | US-009, FR-15 |
| #7 Dead `recentFiles` field | Low | US-010, FR-19 |
| #8 Missing `engines` field | Low | US-001 (added in tsconfig story) |
