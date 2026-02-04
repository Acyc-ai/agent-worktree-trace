// Badge Generator Utils

import { TrackedFile } from '../types';

/**
 * Generate a badge string for file decorations.
 * Limited to 2 characters by VS Code API.
 *
 * Priority (highest to lowest):
 * - "!W" = User has also modified this file (potential conflict)
 * - "WN" = N agents have changed this file (N > 1, potential merge conflicts)
 * - "W*" = 1 agent changed, has uncommitted changes
 * - "W"  = 1 agent changed, all work committed
 */
export function generateBadge(
  worktrees: TrackedFile[],
  userModified: boolean
): string | undefined {
  const count = worktrees.length;

  // No agents changed - no badge
  if (count === 0) {
    return undefined;
  }

  // Priority 1: User also modified (highest priority - potential conflict)
  if (userModified) {
    return '!W';
  }

  // Priority 2: Multiple agents changed (show count for merge conflict awareness)
  if (count > 1) {
    return `W${count}`;
  }

  // Priority 3: Single agent with uncommitted changes
  const hasUncommitted = worktrees.some(w => w.uncommitted || w.hasUncommittedOnTop);
  if (hasUncommitted) {
    return 'W*';
  }

  // Priority 4: Single agent, all committed (base case)
  return 'W';
}

/**
 * Generate a tooltip string for file decorations.
 * Lists worktree names with their uncommitted status.
 */
export function generateTooltip(
  worktrees: TrackedFile[],
  userModified: boolean
): string {
  const tooltipParts = worktrees.map(w => {
    let suffix = '';
    if (w.hasUncommittedOnTop) {
      suffix = ' (committed + uncommitted)';
    } else if (w.uncommitted) {
      suffix = ' (uncommitted)';
    }
    return `${w.worktreeName}${suffix}`;
  });

  let tooltip = `Changed by: ${tooltipParts.join(', ')}`;
  if (userModified) {
    tooltip = `[!local changes] ${tooltip}`;
  }

  return tooltip;
}

/**
 * Determine if a file should receive a decoration.
 */
export function shouldDecorate(
  scheme: string,
  relativePath: string,
  fsPath: string,
  decorationsEnabled: boolean,
  hasTrackedFiles: boolean
): boolean {
  // Only process file scheme
  if (scheme !== 'file') return false;

  // Check config
  if (!decorationsEnabled) return false;

  // Skip if outside workspace (relativePath equals fsPath)
  if (relativePath === fsPath) return false;

  // Need at least one tracked worktree
  return hasTrackedFiles;
}
