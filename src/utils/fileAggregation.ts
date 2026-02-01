// File Aggregation Utils

import { TrackedFile } from '../types';

/**
 * Aggregate files from multiple worktrees into a single map.
 * Groups files by relative path, keeping one entry per worktree.
 */
export function aggregateFiles(fileGroups: TrackedFile[][]): Map<string, TrackedFile[]> {
  const trackedFiles = new Map<string, TrackedFile[]>();

  for (const files of fileGroups) {
    for (const file of files) {
      const existing = trackedFiles.get(file.relativePath) || [];
      const existingIndex = existing.findIndex(
        f => f.worktreeName === file.worktreeName
      );

      if (existingIndex >= 0) {
        // Update existing entry (prefer committed over uncommitted)
        if (!file.uncommitted) {
          existing[existingIndex] = file;
        }
      } else {
        existing.push(file);
      }

      trackedFiles.set(file.relativePath, existing);
    }
  }

  return trackedFiles;
}

/**
 * Remove all entries for a specific worktree from the map.
 */
export function clearWorktreeFromMap(
  trackedFiles: Map<string, TrackedFile[]>,
  worktreeName: string
): Map<string, TrackedFile[]> {
  const result = new Map(trackedFiles);

  for (const [relativePath, files] of result.entries()) {
    const filtered = files.filter(f => f.worktreeName !== worktreeName);

    if (filtered.length === 0) {
      result.delete(relativePath);
    } else if (filtered.length !== files.length) {
      result.set(relativePath, filtered);
    }
  }

  return result;
}

/**
 * Compare old and new state to find changed file paths
 */
export function getChangedPaths(
  oldState: Map<string, TrackedFile[]>,
  newState: Map<string, TrackedFile[]>
): Set<string> {
  const changed = new Set<string>();

  // Check for new or modified files
  for (const [filePath, newFiles] of newState) {
    const oldFiles = oldState.get(filePath);
    if (!oldFiles || !trackedFilesEqual(oldFiles, newFiles)) {
      changed.add(filePath);
    }
  }

  // Check for removed files
  for (const filePath of oldState.keys()) {
    if (!newState.has(filePath)) {
      changed.add(filePath);
    }
  }

  return changed;
}

/**
 * Compare two TrackedFile arrays for equality
 */
export function trackedFilesEqual(a: TrackedFile[], b: TrackedFile[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].worktreeName !== b[i].worktreeName ||
        a[i].changeType !== b[i].changeType ||
        a[i].uncommitted !== b[i].uncommitted ||
        a[i].hasUncommittedOnTop !== b[i].hasUncommittedOnTop) {
      return false;
    }
  }
  return true;
}
