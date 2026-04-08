#!/usr/bin/env bash
# PostToolUse hook for Skill tool — writes completion state to a JSON file
# that the monitor can watch for real-time skill completion detection.
#
# Receives PostToolUseHookInput JSON on stdin from Claude Code.
# Writes to .omc/state/last-skill-complete.json

set -euo pipefail

STATE_DIR="${HOME}/.claude/.omc/state"
OUTPUT="${STATE_DIR}/last-skill-complete.json"

mkdir -p "$STATE_DIR"

# Read hook input from stdin, extract skill name and timestamp
INPUT=$(cat)

# Use node for reliable JSON parsing (available in Claude Code environment)
node -e "
const input = JSON.parse(process.argv[1]);
const toolInput = input.tool_input || {};
const result = {
  skill: toolInput.skill || 'unknown',
  args: toolInput.args || null,
  completedAt: new Date().toISOString(),
  sessionId: input.session_id || null
};
process.stdout.write(JSON.stringify(result, null, 2));
" "$INPUT" > "$OUTPUT"
