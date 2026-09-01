#!/usr/bin/env node
// run-sh.mjs — run a POSIX shell script from an npm script, on any platform.
//
// npm on Windows runs lifecycle scripts through cmd.exe, where `sh` is usually absent and
// `bash` resolves to C:\Windows\System32\bash.exe — the WSL launcher, which sees a different
// filesystem. This launcher finds a real POSIX shell (preferring the one Git for Windows
// bundles) and execs the script through it, propagating the exit code.
//
//   node scripts/run-sh.mjs scripts/check-no-mocks.sh [args...]

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The repo path may contain spaces, so decode the module URL properly rather than
// slicing import.meta.url by hand.
const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const [scriptPath, ...scriptArgs] = process.argv.slice(2);

if (!scriptPath) {
  console.error('run-sh: usage: node scripts/run-sh.mjs <script.sh> [args...]');
  process.exit(2);
}

function findShell() {
  if (process.env.DRISHTI_SHELL) return process.env.DRISHTI_SHELL;
  if (process.platform !== 'win32') return '/bin/sh';

  const candidates = [];

  // Git for Windows ships a full POSIX toolchain. Locate it from git on PATH:
  // `git --exec-path` -> <root>/mingw64/libexec/git-core
  const execPath = spawnSync('git', ['--exec-path'], { encoding: 'utf8' });
  if (execPath.status === 0 && execPath.stdout) {
    const gitRoot = path.resolve(execPath.stdout.trim(), '..', '..', '..');
    candidates.push(path.join(gitRoot, 'usr', 'bin', 'sh.exe'));
    candidates.push(path.join(gitRoot, 'bin', 'bash.exe'));
  }

  candidates.push(
    'C:\\Program Files\\Git\\usr\\bin\\sh.exe',
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\usr\\bin\\sh.exe'
  );

  return candidates.find((c) => existsSync(c)) ?? null;
}

const shell = findShell();

if (!shell) {
  console.error(
    'run-sh: no POSIX shell found.\n' +
      '  Install Git for Windows, or set DRISHTI_SHELL to a shell executable.\n' +
      `  You can also run the script directly:  sh ${scriptPath}`
  );
  process.exit(2);
}

// Git's sh.exe accepts Windows paths; pass the script relative to the repo root so its own
// `cd $(dirname $0)/..` resolves the same way it does when invoked from a terminal.
// cmd.exe's PATH does not include Git's POSIX toolchain, so the script would launch but
// find no `grep`, `dirname` or `mktemp`. Prepend the shell's own bin directories, which is
// what Git Bash does for itself.
function shellEnv() {
  if (process.platform !== 'win32') return process.env;

  const shellDir = path.dirname(shell);
  const extra = [shellDir, path.resolve(shellDir, '..', '..', 'usr', 'bin')].filter(
    (d) => existsSync(d)
  );

  return { ...process.env, PATH: [...new Set(extra)].join(path.delimiter) + path.delimiter + process.env.PATH };
}

const result = spawnSync(shell, [scriptPath, ...scriptArgs], {
  stdio: 'inherit',
  cwd: REPO_ROOT,
  env: shellEnv()
});

if (result.error) {
  console.error(`run-sh: failed to launch ${shell}: ${result.error.message}`);
  process.exit(2);
}

process.exit(result.status ?? 2);
