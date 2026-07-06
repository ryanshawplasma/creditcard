#!/usr/bin/env node
/**
 * autopush — hands-free "commit + push on every change" with a safety net.
 *
 *   npm run push        → type-check, then commit + push once, right now.
 *   npm run autopush    → watch the project; a few seconds after you stop
 *                          editing, type-check and (only if it compiles)
 *                          auto-commit + push. Render then auto-deploys.
 *
 * The type-check guard means a half-finished edit never gets pushed or
 * deployed. No extra dependencies — uses Node's built-in fs.watch.
 *
 * Tune the idle delay with AUTOPUSH_DEBOUNCE (ms), e.g.
 *   AUTOPUSH_DEBOUNCE=30000 npm run autopush
 */
import { watch } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ONCE = process.argv.includes('--once');
const DEBOUNCE_MS = Number(process.env.AUTOPUSH_DEBOUNCE ?? 15000);

const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;

function log(msg) {
  console.log(`${dim(new Date().toLocaleTimeString())} ${msg}`);
}
function sh(cmd) {
  return execSync(cmd, { cwd: root, stdio: 'pipe' }).toString().trim();
}

let running = false;
let pending = false;
let timer = null;

function pushNow() {
  if (running) {
    pending = true;
    return;
  }
  running = true;
  try {
    if (!sh('git status --porcelain')) {
      log('Nothing to push — working tree clean.');
      return;
    }

    log('Type-checking before push…');
    try {
      execSync('npx tsc --noEmit', { cwd: root, stdio: 'pipe' });
    } catch {
      log(yellow('⚠ Type errors — holding off. Will retry after your next save.'));
      return;
    }

    const stamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
    sh('git add -A');
    sh(`git commit -m "chore: autopush ${stamp}"`);
    log('Pushing to GitHub…');
    sh('git push');
    log(green('✓ Pushed. Render will auto-deploy in ~1–2 min.'));
  } catch (err) {
    log(red(`✗ ${String(err.message).split('\n')[0]}`));
  } finally {
    running = false;
    if (pending) {
      pending = false;
      schedule();
    }
  }
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(pushNow, DEBOUNCE_MS);
}

function onChange(_event, filename) {
  const name = filename ? String(filename) : '';
  if (name.includes('node_modules') || name.includes('.git') || name.startsWith('dist')) return;
  schedule();
}

if (ONCE) {
  pushNow();
} else {
  log(`Watching for changes — auto-push ${DEBOUNCE_MS / 1000}s after you stop editing. Press Ctrl+C to stop.`);
  try {
    watch(path.join(root, 'src'), { recursive: true }, onChange);
    watch(root, { recursive: false }, onChange);
  } catch (err) {
    log(red(`Could not start file watcher: ${err.message}`));
    process.exit(1);
  }
}
