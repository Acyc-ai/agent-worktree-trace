// Worktree Parser Utilities

import * as path from 'path';
import { Worktree } from '../types';

/**
 * Parse the porcelain output from `git worktree list --porcelain`
 */
export function parseWorktreeList(output: string, workspaceRoot: string): Worktree[] {
  const worktrees: Worktree[] = [];
  const blocks = output.trim().split(/\r?\n\r?\n/);

  for (const block of blocks) {
    if (!block.trim()) continue;

    const lines = block.split(/\r?\n/);
    let worktreePath = '';
    let branch = '';
    let isMainWorktree = false;

    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        worktreePath = line.substring(9);
      } else if (line.startsWith('branch ')) {
        branch = line.substring(7).replace('refs/heads/', '');
      } else if (line === 'bare') {
        isMainWorktree = true;
      }
    }

    if (!worktreePath) continue;

    // Check if this is the main worktree (same as workspace root)
    if (path.resolve(worktreePath) === path.resolve(workspaceRoot)) {
      isMainWorktree = true;
    }

    worktrees.push({
      path: worktreePath,
      branch: branch || 'HEAD',
      isMainWorktree,
    });
  }

  return worktrees;
}

/**
 * Convert a glob pattern to a RegExp.
 *
 * Regex metacharacters in the literal portions of the glob (e.g. `.`, `+`,
 * `(`, `)`, `[`, `]`, `{`, `}`, `^`, `$`, `|`, `\`) are escaped so they are
 * matched literally. Only the glob wildcards `*` and `?` retain their special
 * meaning, mapping to `.*` and `.` respectively.
 */
export function globToRegex(pattern: string): RegExp {
  // Escape every regex metacharacter, then re-enable the glob wildcards.
  // `*` and `?` are escaped to `\*` and `\?` by the first step, so we target
  // those escaped sequences when translating to regex wildcards.
  const regexPattern = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\\\*/g, '.*')
    .replace(/\\\?/g, '.');
  return new RegExp(`^${regexPattern}$`);
}

/**
 * Filter worktrees by the given pattern
 */
export function filterWorktreesByPattern(worktrees: Worktree[], pattern: string): Worktree[] {
  const regex = globToRegex(pattern);

  return worktrees.filter(wt => {
    // Always exclude the main worktree
    if (wt.isMainWorktree) return false;

    // Match directory name against pattern
    const dirName = path.basename(wt.path);
    return regex.test(dirName);
  });
}
