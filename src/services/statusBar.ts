// Status Bar Service

import * as vscode from 'vscode';

export class StatusBarService {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      'agentWorktreeTrace.statusBar',
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'agentWorktreeTrace.showMenu';
    this.statusBarItem.name = 'Agent Worktree Trace';
  }

  /**
   * Update the status bar text and tooltip based on current config
   */
  update(): void {
    const config = vscode.workspace.getConfiguration('agentWorktreeTrace');
    const enabled = config.get<boolean>('enableFileDecorations', true);

    if (enabled) {
      const intervalSeconds = config.get<number>('scanIntervalSeconds', 60);
      this.statusBarItem.text = `Ⓐ wrktree trace: ${intervalSeconds}s`;
      this.statusBarItem.tooltip = 'Worktree tracing is active. Click for options.';
    } else {
      this.statusBarItem.text = '○ wrktree trace: Off';
      this.statusBarItem.tooltip = 'Worktree tracing is disabled. Click for options.';
    }
  }

  /**
   * Show the status bar item
   */
  show(): void {
    this.statusBarItem.show();
  }

  /**
   * Get the disposable for cleanup
   */
  getDisposable(): vscode.Disposable {
    return this.statusBarItem;
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}

/**
 * Create a StatusBarService instance
 */
export function createStatusBarService(): StatusBarService {
  return new StatusBarService();
}
