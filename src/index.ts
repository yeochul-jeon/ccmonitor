#!/usr/bin/env bun
/**
 * Claude Code Monitor - TUI app for monitoring ~/.claude session activity.
 *
 * Watches project data files, tracks tool usage, skills, subagents, and teams.
 *
 * Usage:
 *   bun run monitor/src/index.ts [sessionId]
 */

import { watch } from 'chokidar';
import { homedir } from 'os';
import { join } from 'path';
import { findLatestSession, parseTranscript } from './parser.js';
import { render, cleanup } from './ui.js';
import type { SessionState } from './types.js';

const CLAUDE_DIR = join(homedir(), '.claude');
const REFRESH_INTERVAL = 2000;
const PROJECT_CWD = process.cwd();

// File events ring buffer
const MAX_FILE_EVENTS = 50;
const fileEvents: Array<{ path: string; time: Date; event: string }> = [];

function addFileEvent(path: string, event: string): void {
  fileEvents.push({ path, time: new Date(), event });
  if (fileEvents.length > MAX_FILE_EVENTS) {
    fileEvents.shift();
  }
}

// State
let state: SessionState | null = null;
let running = true;

function refreshState(): void {
  const sessionId = process.argv[2];

  if (sessionId && state) {
    // Refresh existing session
    state = parseTranscript(state.sessionId, state.projectDir, state.transcriptFile);
  } else if (sessionId) {
    // Find session by ID in projects
    const { readdirSync, existsSync, statSync } = require('fs') as typeof import('fs');
    const projectsDir = join(CLAUDE_DIR, 'projects');
    if (existsSync(projectsDir)) {
      for (const dir of readdirSync(projectsDir)) {
        const fullDir = join(projectsDir, dir);
        if (!statSync(fullDir).isDirectory()) continue;
        const transcriptFile = join(fullDir, `${sessionId}.jsonl`);
        if (existsSync(transcriptFile)) {
          state = parseTranscript(sessionId, fullDir, transcriptFile);
          break;
        }
      }
    }
  } else {
    // Find latest session for the current project
    state = findLatestSession(PROJECT_CWD);
  }
}

// Setup file watcher
const watcher = watch(
  [
    join(CLAUDE_DIR, 'projects', '**', '*.jsonl'),
    join(CLAUDE_DIR, 'projects', '**', '*.json'),
    join(CLAUDE_DIR, 'tasks', '**', '*.json'),
    join(CLAUDE_DIR, 'teams', '**', '*'),
    join(CLAUDE_DIR, 'sessions', '*.json'),
    join(CLAUDE_DIR, 'file-history', '**', '*'),
    join(CLAUDE_DIR, '.omc', 'state', 'last-skill-complete.json'),
  ],
  {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
  },
);

watcher
  .on('add', (path: string) => addFileEvent(path, 'add'))
  .on('change', (path: string) => addFileEvent(path, 'change'))
  .on('unlink', (path: string) => addFileEvent(path, 'unlink'));

// Setup keyboard input
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (key: string) => {
    if (key === 'q' || key === '\x03') {
      // q or Ctrl+C
      running = false;
      cleanup();
      watcher.close();
      process.exit(0);
    }
    if (key === 'r') {
      refreshState();
      render(state, fileEvents);
    }
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  running = false;
  cleanup();
  watcher.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  running = false;
  cleanup();
  watcher.close();
  process.exit(0);
});

// Main loop — recursive setTimeout is more reliable than setInterval in Bun
console.log('Starting Claude Code Monitor...');
refreshState();
render(state, fileEvents);

function tick(): void {
  if (!running) return;
  refreshState();
  render(state, fileEvents);
  setTimeout(tick, REFRESH_INTERVAL);
}
setTimeout(tick, REFRESH_INTERVAL);
