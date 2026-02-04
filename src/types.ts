/**
 * Represents a git worktree discovered via `git worktree list`
 */
export interface Worktree {
  /** Absolute path to the worktree directory */
  path: string;
  /** Branch name checked out in this worktree */
  branch: string;
  /** True if this is the main/primary worktree */
  isMainWorktree: boolean;
}

/**
 * Represents a file that has been changed by an agent in a worktree
 */
export interface TrackedFile {
  /** Path relative to workspace root */
  relativePath: string;
  /** Name of the worktree directory (basename) */
  worktreeName: string;
  /** Branch name in the worktree */
  branch: string;
  /** Type of change made to the file */
  changeType: 'added' | 'modified' | 'deleted';
  /** True if the change is not yet committed (uncommitted-only changes) */
  uncommitted?: boolean;
  /** True if the file has committed changes AND additional uncommitted changes on top */
  hasUncommittedOnTop?: boolean;
}

/**
 * State file format for persistence
 */
export interface TrackedFilesState {
  /** Schema version for migration support */
  version: string;
  /** ISO timestamp of last update */
  lastUpdated: string;
  /** Map of relative path to array of TrackedFile entries */
  files: Record<string, TrackedFile[]>;
}
