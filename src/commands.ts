/**
 * Command Handlers
 */

import * as vscode from 'vscode';
import { WorktreeDiscoveryService } from './services/worktreeDiscovery';
import { WorktreeFileTrackerService } from './services/worktreeFileTracker';

/**
 * Show the quick pick menu for the status bar
 */
export async function showMenu(): Promise<void> {
  const config = vscode.workspace.getConfiguration('agentWorktreeTrace');
  const enabled = config.get<boolean>('enableFileDecorations', true);

  const items: vscode.QuickPickItem[] = [
    {
      label: enabled ? '$(eye-closed) Disable Tracing' : '$(eye) Enable Tracing',
      description: enabled ? 'Stop scanning and hide decorations' : 'Resume scanning and show decorations'
    },
    { label: '$(refresh) Refresh Now', description: 'Scan worktrees immediately' },
    { label: '$(info) Show Status', description: 'Display tracking summary' },
    { label: '$(list-tree) List Touched Files', description: 'Show all files in output panel' },
    { label: '$(gear) Open Settings', description: 'Configure extension settings' },
    { kind: vscode.QuickPickItemKind.Separator, label: '' },
    { label: '$(trash) Clear All Tracked Files', description: 'Remove all tracking data' }
  ];

  const selected = await vscode.window.showQuickPick(items, {
    placeHolder: 'Agent Worktree Trace'
  });

  if (!selected) return;

  if (selected.label.includes('Disable Tracing') || selected.label.includes('Enable Tracing')) {
    await config.update('enableFileDecorations', !enabled, vscode.ConfigurationTarget.Global);
  } else if (selected.label.includes('Refresh Now')) {
    vscode.commands.executeCommand('agentWorktreeTrace.refresh');
  } else if (selected.label.includes('Show Status')) {
    vscode.commands.executeCommand('agentWorktreeTrace.showStatus');
  } else if (selected.label.includes('List Touched Files')) {
    vscode.commands.executeCommand('agentWorktreeTrace.listFiles');
  } else if (selected.label.includes('Open Settings')) {
    vscode.commands.executeCommand('agentWorktreeTrace.openSettings');
  } else if (selected.label.includes('Clear All Tracked Files')) {
    vscode.commands.executeCommand('agentWorktreeTrace.clear');
  }
}

/**
 * Toggle scanning on/off
 */
export async function toggleScanning(): Promise<void> {
  const config = vscode.workspace.getConfiguration('agentWorktreeTrace');
  const currentValue = config.get<boolean>('enableFileDecorations', true);
  await config.update('enableFileDecorations', !currentValue, vscode.ConfigurationTarget.Global);
}

/**
 * Open extension settings
 */
export function openSettings(): void {
  vscode.commands.executeCommand('workbench.action.openSettings', 'agentWorktreeTrace');
}

/**
 * Show tracking status in an information message
 */
export function showStatus(
  trackerService: WorktreeFileTrackerService | undefined,
  discoveryService: WorktreeDiscoveryService | undefined
): void {
  if (!trackerService || !discoveryService) {
    vscode.window.showWarningMessage('Agent Worktree Trace: Extension not fully initialized');
    return;
  }

  const fileCount = trackerService.getTrackedFileCount();
  const worktreeCount = trackerService.getActiveWorktreeCount();

  const config = vscode.workspace.getConfiguration('agentWorktreeTrace');
  const pattern = config.get<string>('worktreePattern', 'worktree-agent-*');
  const enabled = config.get<boolean>('enableFileDecorations', true);

  const statusMessage = enabled
    ? `Agent Worktree Trace: ${fileCount} files touched by ${worktreeCount} worktrees (pattern: ${pattern})`
    : `Agent Worktree Trace: Decorations disabled`;

  vscode.window.showInformationMessage(statusMessage);
}

/**
 * List all touched files grouped by worktree in an output channel
 */
export function listTouchedFiles(trackerService: WorktreeFileTrackerService | undefined): void {
  if (!trackerService) {
    vscode.window.showWarningMessage('Agent Worktree Trace: Extension not fully initialized');
    return;
  }

  const allFiles = trackerService.getAllTrackedFiles();

  if (allFiles.size === 0) {
    vscode.window.showInformationMessage('Agent Worktree Trace: No touched files tracked');
    return;
  }

  // Group files by worktree
  const filesByWorktree = new Map<string, string[]>();

  for (const [relativePath, trackedFiles] of allFiles) {
    for (const file of trackedFiles) {
      const worktreeName = file.worktreeName;
      if (!filesByWorktree.has(worktreeName)) {
        filesByWorktree.set(worktreeName, []);
      }

      let suffix = '';
      if (file.hasUncommittedOnTop) {
        suffix = ' (committed + uncommitted)';
      } else if (file.uncommitted) {
        suffix = ' (uncommitted)';
      }

      filesByWorktree.get(worktreeName)!.push(`${relativePath}${suffix}`);
    }
  }

  // Create output channel and display
  const outputChannel = vscode.window.createOutputChannel('Agent Worktree Trace');
  outputChannel.clear();
  outputChannel.appendLine('=== Touched Files by Worktree ===\n');

  for (const [worktreeName, files] of filesByWorktree) {
    outputChannel.appendLine(`${worktreeName} (${files.length} files)`);
    for (const file of files.sort()) {
      outputChannel.appendLine(` - ${file}`);
    }
    outputChannel.appendLine('');
  }

  outputChannel.appendLine(`Total: ${allFiles.size} unique files across ${filesByWorktree.size} worktrees`);
  outputChannel.show();
}
