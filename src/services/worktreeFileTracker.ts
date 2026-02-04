// Worktree File Tracker Service
// Scans worktrees using git diff to detect changed files, maintains state

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Worktree, TrackedFile, TrackedFilesState } from '../types';
import { parseGitDiffOutput } from '../utils/gitDiffParser';
import { getChangedPaths } from '../utils/fileAggregation';

const execAsync = promisify(exec);

const STATE_FILE = 'changed-files.json';
const STATE_VERSION = '1.0';

/**
 * Service for tracking files changed in worktrees.
 * Uses git diff to detect changes, persists state to JSON file in VS Code storage
 */
export class WorktreeFileTrackerService {
  private workspaceRoot: string;
  private storagePath: string;
  private trackedFiles: Map<string, TrackedFile[]> = new Map();
  private _onStateChanged: vscode.EventEmitter<Set<string>> = new vscode.EventEmitter<Set<string>>();
  private invalidBranchWarningShown: string | null = null; // Track which branch we warned about
  private scanningPaused: boolean = false; // Pause scanning when branch is invalid

  /** Event fired when tracked files change. Passes set of changed file paths (empty = all changed) */
  readonly onStateChanged: vscode.Event<Set<string>> = this._onStateChanged.event;

  constructor(workspaceRoot: string, storagePath: string) {
    this.workspaceRoot = workspaceRoot;
    this.storagePath = storagePath;
  }

  /**
   * Reset the scanning paused state (call when config changes)
   */
  resetScanningState(): void {
    this.scanningPaused = false;
    this.invalidBranchWarningShown = null;
  }

  /**
   * Get the path to the state file (stored in VS Code's hidden storage)
   */
  private getStateFilePath(): string {
    return path.join(this.storagePath, STATE_FILE);
  }

  /**
   * Load state from disk
   */
  async loadState(): Promise<void> {
    const stateFilePath = this.getStateFilePath();

    try {
      if (fs.existsSync(stateFilePath)) {
        const content = await fs.promises.readFile(stateFilePath, 'utf-8');
        const state = JSON.parse(content) as TrackedFilesState;

        // Validate version
        if (state.version === STATE_VERSION && state.files) {
          this.trackedFiles = new Map(Object.entries(state.files));
          console.log(`[Agent Worktree Trace] Loaded ${this.trackedFiles.size} tracked file entries from state`);
        }
      }
    } catch (error) {
      console.warn('[Agent Worktree Trace] Failed to load state:', error);
      this.trackedFiles = new Map();
    }
  }

  /**
   * Save state to disk
   */
  async saveState(): Promise<void> {
    const stateFilePath = this.getStateFilePath();
    const stateDir = path.dirname(stateFilePath);

    try {
      // Ensure storage directory exists
      if (!fs.existsSync(stateDir)) {
        await fs.promises.mkdir(stateDir, { recursive: true });
      }

      const state: TrackedFilesState = {
        version: STATE_VERSION,
        lastUpdated: new Date().toISOString(),
        files: Object.fromEntries(this.trackedFiles)
      };

      await fs.promises.writeFile(stateFilePath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (error) {
      console.error('[Agent Worktree Trace] Failed to save state:', error);
    }
  }

  /**
   * Get the main branch name for this repository (main or master)
   */
  private async getMainBranch(): Promise<string> {
    try {
      // Try to get the default branch from git config
      const { stdout } = await execAsync(
        'git symbolic-ref refs/remotes/origin/HEAD',
        { cwd: this.workspaceRoot }
      );
      const branch = stdout.trim().replace(/^refs\/remotes\/origin\//, '');
      if (branch) {
        return branch;
      }
    } catch {
      // Ignore errors and fall back to 'main'
    }

    // Check if 'main' exists, otherwise use 'master'
    try {
      await execAsync('git rev-parse --verify main', { cwd: this.workspaceRoot });
      return 'main';
    } catch {
      return 'master';
    }
  }

  /**
   * Get the currently checked out branch in the main workspace
   */
  private async getCurrentBranch(): Promise<string> {
    try {
      const { stdout } = await execAsync(
        'git rev-parse --abbrev-ref HEAD',
        { cwd: this.workspaceRoot }
      );
      return stdout.trim();
    } catch {
      // Fall back to main branch if we can't determine current
      return this.getMainBranch();
    }
  }

  /**
   * Check if a branch exists in the repository
   */
  private async branchExists(branchName: string): Promise<boolean> {
    try {
      await execAsync(
        `git rev-parse --verify "${branchName}"`,
        { cwd: this.workspaceRoot }
      );
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the branch to compare agent worktree changes against based on config.
   * Returns null if the configured branch is invalid.
   */
  private async getComparisonBranch(): Promise<string | null> {
    const config = vscode.workspace.getConfiguration('agentWorktreeTrace');
    const comparisonBranch = config.get<string>('comparisonBranch', 'current');

    let resolvedBranch: string;

    if (comparisonBranch === 'current' || comparisonBranch === '') {
      // Compare against whatever branch is currently checked out
      resolvedBranch = await this.getCurrentBranch();
    } else if (comparisonBranch === 'main') {
      // Compare against detected main branch (main or master)
      resolvedBranch = await this.getMainBranch();
    } else {
      // User specified a specific branch name - validate it exists
      resolvedBranch = comparisonBranch;
    }

    // Validate the branch exists
    const exists = await this.branchExists(resolvedBranch);
    if (!exists) {
      // Pause scanning and show warning once per invalid branch
      this.scanningPaused = true;
      if (this.invalidBranchWarningShown !== resolvedBranch) {
        this.invalidBranchWarningShown = resolvedBranch;
        vscode.window.showWarningMessage(
          `Agent Worktree Trace: Branch "${resolvedBranch}" not found. ` +
          `Scanning paused. Please update the "Comparison Branch" setting.`,
          'Open Settings'
        ).then(selection => {
          if (selection === 'Open Settings') {
            vscode.commands.executeCommand(
              'workbench.action.openSettings',
              'agentWorktreeTrace.comparisonBranch'
            );
          }
        });
      }
      return null;
    }

    // Branch is valid, clear any previous warning/paused state
    this.scanningPaused = false;
    this.invalidBranchWarningShown = null;
    return resolvedBranch;
  }

  /**
   * Scan a single worktree for changed files vs main branch
   */
  async scanWorktree(
    worktreePath: string,
    worktreeName: string,
    branch: string
  ): Promise<TrackedFile[]> {
    const allFiles: TrackedFile[] = [];
    const comparisonBranch = await this.getComparisonBranch();

    // If comparison branch is invalid, skip scanning
    if (comparisonBranch === null) {
      return allFiles;
    }

    try {
      // Get committed changes: diff between comparison branch and HEAD of worktree
      const { stdout: committedDiff } = await execAsync(
        `git diff --name-status "${comparisonBranch}"...HEAD`,
        { cwd: worktreePath }
      );

      const committedFiles = parseGitDiffOutput(
        committedDiff,
        worktreeName,
        branch,
        false
      );
      allFiles.push(...committedFiles);

      // Check if user wants to track uncommitted changes
      const config = vscode.workspace.getConfiguration('agentWorktreeTrace');
      const trackUncommitted = config.get<boolean>('trackUncommittedChanges', true);

      if (trackUncommitted) {
        // Get uncommitted changes (staged + unstaged)
        const { stdout: uncommittedDiff } = await execAsync(
          'git diff --name-status HEAD',
          { cwd: worktreePath }
        );

        const uncommittedFiles = parseGitDiffOutput(
          uncommittedDiff,
          worktreeName,
          branch,
          true
        );

        // Also check for staged files
        const { stdout: stagedDiff } = await execAsync(
          'git diff --name-status --cached',
          { cwd: worktreePath }
        );

        const stagedFiles = parseGitDiffOutput(
          stagedDiff,
          worktreeName,
          branch,
          true
        );

        // Get untracked files (others - excludes standard)
        const { stdout: untrackedOutput } = await execAsync(
          'git ls-files --others --exclude-standard',
          { cwd: worktreePath }
        );

        const untrackedFiles: TrackedFile[] = untrackedOutput
          .trim()
          .split(/\r?\n/)
          .filter(l => l)
          .map(filePath => ({
            relativePath: filePath,
            worktreeName,
            branch,
            changeType: 'added' as const,
            uncommitted: true
          }));

        // Merge uncommitted files, marking files that have both committed and uncommitted changes
        const committedPathsMap = new Map(allFiles.map(f => [f.relativePath, f]));
        const seenUncommittedPaths = new Set<string>();

        for (const file of [...uncommittedFiles, ...stagedFiles, ...untrackedFiles]) {
          if (seenUncommittedPaths.has(file.relativePath)) {
            continue; // Already processed this uncommitted file
          }
          seenUncommittedPaths.add(file.relativePath);

          const existingCommitted = committedPathsMap.get(file.relativePath);
          if (existingCommitted) {
            // File has both committed AND uncommitted changes - mark it
            existingCommitted.hasUncommittedOnTop = true;
          } else {
            // File only has uncommitted changes
            allFiles.push(file);
          }
        }
      }
    } catch (error) {
      console.warn(`[Agent Worktree Trace] Failed to scan worktree ${worktreeName}:`, error);
    }

    return allFiles;
  }

  /**
   * Scan all active worktrees and update tracked files
   */
  async scanAllWorktrees(worktrees: Worktree[]): Promise<void> {
    // Check if scanning is paused due to invalid branch config
    if (this.scanningPaused) {
      return;
    }

    // Check if decorations are enabled
    const config = vscode.workspace.getConfiguration('agentWorktreeTrace');
    const enabled = config.get<boolean>('enableFileDecorations', true);

    if (!enabled) {
      return;
    }

    // Filter to only non-main worktrees
    const agentWorktrees = worktrees.filter(wt => !wt.isMainWorktree);

    // Build new tracked files map
    const newTrackedFiles = new Map<string, TrackedFile[]>();

    for (const worktree of agentWorktrees) {
      const worktreeName = path.basename(worktree.path);
      const files = await this.scanWorktree(
        worktree.path,
        worktreeName,
        worktree.branch
      );

      // Group files by relative path
      for (const file of files) {
        const existing = newTrackedFiles.get(file.relativePath) || [];

        // Check if we already have an entry for this worktree
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

        newTrackedFiles.set(file.relativePath, existing);
      }
    }

    // Determine which files actually changed
    const changedPaths = getChangedPaths(this.trackedFiles, newTrackedFiles);

    // Update state
    this.trackedFiles = newTrackedFiles;
    await this.saveState();

    // Only notify if something changed
    if (changedPaths.size > 0) {
      this._onStateChanged.fire(changedPaths);
    }
  }

  /**
   * Get all worktrees that have changed a specific file
   */
  getWorktreesForFile(relativePath: string): TrackedFile[] {
    return this.trackedFiles.get(relativePath) || [];
  }

  /**
   * Get all tracked files grouped by relative path
   */
  getAllTrackedFiles(): Map<string, TrackedFile[]> {
    return new Map(this.trackedFiles);
  }

  /**
   * Get total count of tracked files
   */
  getTrackedFileCount(): number {
    return this.trackedFiles.size;
  }

  /**
   * Get count of unique worktrees that have changed files
   */
  getActiveWorktreeCount(): number {
    const worktrees = new Set<string>();
    for (const files of this.trackedFiles.values()) {
      for (const file of files) {
        worktrees.add(file.worktreeName);
      }
    }
    return worktrees.size;
  }

  /**
   * Clear tracked files for a specific worktree
   */
  clearWorktreeFiles(worktreeName: string): void {
    const changedPaths = new Set<string>();

    // Remove entries for this worktree from all files
    for (const [relativePath, files] of this.trackedFiles.entries()) {
      const filtered = files.filter(f => f.worktreeName !== worktreeName);

      if (filtered.length === 0) {
        this.trackedFiles.delete(relativePath);
        changedPaths.add(relativePath);
      } else if (filtered.length !== files.length) {
        this.trackedFiles.set(relativePath, filtered);
        changedPaths.add(relativePath);
      }
    }

    // Save and notify
    this.saveState();
    if (changedPaths.size > 0) {
      this._onStateChanged.fire(changedPaths);
    }
  }

  /**
   * Clear all tracked files
   */
  clearAllFiles(): void {
    const changedPaths = new Set(this.trackedFiles.keys());
    this.trackedFiles.clear();
    this.saveState();
    this._onStateChanged.fire(changedPaths);
  }

  /**
   * Batch check if files have been modified by the user in the main workspace
   * Returns a Set of relative paths that have been user-modified
   */
  async getUserModifiedFiles(): Promise<Set<string>> {
    try {
      // const mainBranch = await this.getMainBranch();
      const { stdout } = await execAsync(
        `git diff --name-only HEAD`,
        { cwd: this.workspaceRoot }
      );
      return new Set(stdout.trim().split(/\r?\n/).filter(line => line.length > 0));
    } catch {
      return new Set();
    }
  }

  /**
   * Get the workspace root path
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this._onStateChanged.dispose();
  }
}

/**
 * Create a WorktreeFileTrackerService instance
 */
export function createWorktreeFileTracker(
  workspaceRoot: string,
  storagePath: string
): WorktreeFileTrackerService {
  return new WorktreeFileTrackerService(workspaceRoot, storagePath);
}
