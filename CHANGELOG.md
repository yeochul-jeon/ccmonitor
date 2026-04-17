# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-04-17

### Fixed
- **Context % over 100% (sometimes 200%+) for Opus 4.7 sessions.** `getContextLimit` was hard-coded to recognize only Opus 4.5 / 4.6 as 1M-context models, so Opus 4.7 silently fell through to the generic `opus` branch (200K) and produced inflated percentages on long sessions (e.g. an 800K-token context displayed as 400%). The lookup now uses a regex that absorbs every Opus 4.x where x ≥ 5 — including future 4.8, 4.9, 4.10+ — and also recognizes the explicit `[1m]` runtime variant marker.

## [1.1.0] - 2026-04-17

### Added
- **Reasoning effort indicator (`Effort:`) in the title bar.** Shows the current Claude Code reasoning level (`low` / `medium` / `high` / `max`) color-coded by intensity (`max`=magenta, `high`=red, `medium`=yellow, `low`=gray, unknown=cyan). The value is resolved from the same three-layer settings cascade Claude Code uses — project `.claude/settings.local.json` → project `.claude/settings.json` → user `~/.claude/settings.json` — so the monitor never disagrees with the live session when a project overrides the global default.

### Changed
- The persisted internal effort value `xhigh` is now displayed as `max` in the title bar to match the user-facing label that `/effort max` accepts as input. The underlying stored value is preserved as-is in `~/.claude/settings.json`; only the display layer is mapped.

## [1.0.0]

Initial public release. See [git history](https://github.com/tobyilee/ccmonitor/commits/main) for the prior change set, including:

- Real-time TUI dashboard for Claude Code sessions (auto-refresh every 2s)
- Tools / Subagents / Skills / Teams / Tasks / Memory / File Activity panels
- Last Prompt panel with CJK-aware word wrap
- Active sessions counter with cross-project visibility (`Sess:N (+other, projects)`)
- Files-edited counter derived from `~/.claude/file-history/`
- Memory panel summarizing auto-memory categories and recent topics
- Context-window indicator with yellow/red warning thresholds
- Session switcher (press `n`) for cycling across live Claude Code sessions
- Standalone binary via `bun build --compile`; global install via `bun run install:global`
- 24-bit truecolor title bar with deterministic cross-theme rendering
- Git branch in path line read directly from `.git/HEAD` (no subprocess)
