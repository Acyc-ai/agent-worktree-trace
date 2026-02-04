// Worktree File Decoration Provider
// Visual indicators on files changed by worktrees


import * as vscode from 'vscode';
import { WorktreeFileTrackerService } from './worktreeFileTracker';
import { generateBadge, generateTooltip, shouldDecorate } from '../utils/badgeGenerator';

/**
 * FileDecorationProvider - shows badges on changed worktrees
 *
 * Examples:
 * | Badge | Meaning |
 * |-------|---------|
 * | `W` | 1 agent has changed this file |
 * | `W*` | 1 agent has changed and not committed |
 * | `W3` | More than one agent has changed this file (3 in this case) |
 * | `!W` | 1 or more agents, and you, have changed this file |
 */
export class WorktreeFileDecorationProvider implements vscode.FileDecorationProvider {
  private tracker: WorktreeFileTrackerService;
  private _onDidChangeFileDecorations: vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>;
  private userModifiedFiles: Set<string> = new Set();

  readonly onDidChangeFileDecorations: vscode.Event<vscode.Uri | vscode.Uri[] | undefined>;

  constructor(tracker: WorktreeFileTrackerService) {
    this.tracker = tracker;
    this._onDidChangeFileDecorations = new vscode.EventEmitter<vscode.Uri | vscode.Uri[] | undefined>();
    this.onDidChangeFileDecorations = this._onDidChangeFileDecorations.event;

    // Listen for state changes from the tracker
    tracker.onStateChanged((changedPaths) => {
      // Refresh user modified files cache and fire decoration update for changed files
      this.refreshUserModifiedFiles(changedPaths);
    });

    // Initial load of user modified files (fire undefined for initial full refresh)
    this.refreshUserModifiedFiles(new Set());
  }

  /**
   * Refresh the cache of user-modified files and fire decoration updates
   * @param changedPaths - Paths that changed in tracker state (empty = check all for user modifications)
   */
  private async refreshUserModifiedFiles(changedPaths: Set<string>): Promise<void> {
    const oldUserModified = this.userModifiedFiles;
    this.userModifiedFiles = await this.tracker.getUserModifiedFiles();

    // Find paths where user-modified status changed
    // TODO: This can be simplified, it's a Set...
    const userModifiedChanged = new Set<string>();
    for (const path of this.userModifiedFiles) {
      if (!oldUserModified.has(path)) {
        userModifiedChanged.add(path);
      }
    }
    for (const path of oldUserModified) {
      if (!this.userModifiedFiles.has(path)) {
        userModifiedChanged.add(path);
      }
    }

    // Combine tracker changes with user-modified changes
    const allChangedPaths = new Set([...changedPaths, ...userModifiedChanged]);

    // If no specific changes, this is initial load - refresh all
    if (allChangedPaths.size === 0 && changedPaths.size === 0) {
      this._onDidChangeFileDecorations.fire(undefined);
      return;
    }

    // Only fire for specific URIs that changed
    if (allChangedPaths.size > 0) {
      const workspaceRoot = this.tracker.getWorkspaceRoot();
      const uris = Array.from(allChangedPaths).map(
        relativePath => vscode.Uri.file(`${workspaceRoot}/${relativePath}`)
      );
      this._onDidChangeFileDecorations.fire(uris);
    }
  }

  /**
   * Provide decoration for a file if it has been changed by agents
   */
  provideFileDecoration(
    uri: vscode.Uri,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.FileDecoration> {
    // Check if decorations are enabled
    const config = vscode.workspace.getConfiguration('agentWorktreeTrace');
    const enabled = config.get<boolean>('enableFileDecorations', true);

    // Get relative path from workspace
    const relativePath = vscode.workspace.asRelativePath(uri, false);

    // Get worktrees that have changed this file
    const worktrees = this.tracker.getWorktreesForFile(relativePath);

    // Check eligibility
    if (!shouldDecorate(uri.scheme, relativePath, uri.fsPath, enabled, worktrees.length > 0)) {
      return undefined;
    }

    // Check if user has also modified this file in the main workspace
    const showLocalEditWarning = config.get<boolean>('showLocalEditWarning', true);
    const userModified = showLocalEditWarning && this.userModifiedFiles.has(relativePath);

    // Generate badge and tooltip using utilities
    const badge = generateBadge(worktrees, userModified);
    const tooltip = generateTooltip(worktrees, userModified);

    return new vscode.FileDecoration(
      badge,
      tooltip,
      new vscode.ThemeColor('agentWorktreeTrace.changedFile')
    );
  }

  /**
   * Force refresh all decorations
   */
  refresh(): void {
    this._onDidChangeFileDecorations.fire(undefined);
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this._onDidChangeFileDecorations.dispose();
  }
}

/**
 * Create a WorktreeFileDecorationProvider instance
 */
export function createWorktreeFileDecorationProvider(
  tracker: WorktreeFileTrackerService
): WorktreeFileDecorationProvider {
  return new WorktreeFileDecorationProvider(tracker);
}
