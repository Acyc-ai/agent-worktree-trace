// Agent Worktree Trace - VS Code Ext.
// Track and decorate files changed in git worktrees (by AI Agents) - for VSCode 

import * as vscode from 'vscode';
import { WorktreeDiscoveryService, createWorktreeDiscoveryService } from './services/worktreeDiscovery';
import { WorktreeFileTrackerService, createWorktreeFileTracker } from './services/worktreeFileTracker';
import { WorktreeFileDecorationProvider, createWorktreeFileDecorationProvider } from './services/worktreeFileDecoration';
import { StatusBarService, createStatusBarService } from './services/statusBar';
import * as commands from './commands';

let discoveryService: WorktreeDiscoveryService | undefined;
let trackerService: WorktreeFileTrackerService | undefined;
let decorationProvider: WorktreeFileDecorationProvider | undefined;
let statusBarService: StatusBarService | undefined;
let scanInterval: NodeJS.Timeout | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('[Agent Worktree Trace] Extension activating...');

  // Get workspace root
  const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!workspaceRoot) {
    console.log('[Agent Worktree Trace] No workspace folder found, extension inactive');
    return;
  }

  // Use VS Code's hidden storage for state (not visible in user's project)
  const storageUri = context.storageUri;
  if (!storageUri) {
    console.log('[Agent Worktree Trace] No storage URI available, extension inactive');
    return;
  }

  // Initialize services
  discoveryService = createWorktreeDiscoveryService(workspaceRoot);
  trackerService = createWorktreeFileTracker(workspaceRoot, storageUri.fsPath);
  decorationProvider = createWorktreeFileDecorationProvider(trackerService);
  statusBarService = createStatusBarService();

  // Register file decoration provider
  context.subscriptions.push(
    vscode.window.registerFileDecorationProvider(decorationProvider)
  );

  // Setup status bar
  context.subscriptions.push(statusBarService.getDisposable());
  statusBarService.update();
  statusBarService.show();

  // Load state and perform initial scan
  await trackerService.loadState();
  await scanWorktrees();
  decorationProvider.refresh();

  // Register commands
  registerCommands(context);

  // Start periodic refresh (only if decorations are enabled)
  const config = vscode.workspace.getConfiguration('agentWorktreeTrace');
  if (config.get<boolean>('enableFileDecorations', true)) {
    startPeriodicRefresh();
  }

  // Listen for configuration changes
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async e => {
      if (e.affectsConfiguration('agentWorktreeTrace')) {
        await handleConfigChange(e);
      }
    })
  );

  // Clean up on deactivation
  context.subscriptions.push({
    dispose: () => {
      stopPeriodicRefresh();
      discoveryService = undefined;
      trackerService?.dispose();
      trackerService = undefined;
      decorationProvider?.dispose();
      decorationProvider = undefined;
      statusBarService = undefined;
    }
  });

  console.log('[Agent Worktree Trace] Extension activated');
}

export function deactivate(): void {
  stopPeriodicRefresh();
  console.log('[Agent Worktree Trace] Extension deactivated');
}

/**
 * Register all extension commands
 */
function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('agentWorktreeTrace.showMenu', commands.showMenu),
    vscode.commands.registerCommand('agentWorktreeTrace.toggleScanning', commands.toggleScanning),
    vscode.commands.registerCommand('agentWorktreeTrace.openSettings', commands.openSettings),
    vscode.commands.registerCommand('agentWorktreeTrace.refresh', async () => {
      await scanWorktrees();
      vscode.window.showInformationMessage('Agent Worktree Trace: Refreshed file tracking');
    }),
    vscode.commands.registerCommand('agentWorktreeTrace.clear', () => {
      trackerService?.clearAllFiles();
      vscode.window.showInformationMessage('Agent Worktree Trace: Cleared all tracked files');
    }),
    vscode.commands.registerCommand('agentWorktreeTrace.showStatus', () => {
      commands.showStatus(trackerService, discoveryService);
    }),
    vscode.commands.registerCommand('agentWorktreeTrace.listFiles', () => {
      commands.listChangedFiles(trackerService);
    })
  );
}

/**
 * Handle configuration changes
 */
async function handleConfigChange(e: vscode.ConfigurationChangeEvent): Promise<void> {
  const config = vscode.workspace.getConfiguration('agentWorktreeTrace');
  const enabled = config.get<boolean>('enableFileDecorations', true);

  // Update status bar
  statusBarService?.update();

  // If decorations were toggled, start/stop scanning and refresh decorations
  if (e.affectsConfiguration('agentWorktreeTrace.enableFileDecorations')) {
    if (enabled) {
      startPeriodicRefresh();
    } else {
      stopPeriodicRefresh();
    }
    decorationProvider?.refresh();
  }

  // If interval changed and scanning is enabled, restart with new interval
  if (e.affectsConfiguration('agentWorktreeTrace.scanIntervalSeconds') && enabled) {
    stopPeriodicRefresh();
    startPeriodicRefresh();
  }

  // If comparison branch changed, reset scanning state and trigger a scan
  if (e.affectsConfiguration('agentWorktreeTrace.comparisonBranch')) {
    trackerService?.resetScanningState();
    await scanWorktrees();
    decorationProvider?.refresh();
  }
}

/**
 * Scan all matching worktrees and update tracked files
 */
async function scanWorktrees(): Promise<void> {
  if (!discoveryService || !trackerService) return;

  try {
    const worktrees = await discoveryService.discoverWorktrees();
    await trackerService.scanAllWorktrees(worktrees);
    console.log(`[Agent Worktree Trace] Scanned ${worktrees.length} worktrees`);
  } catch (error) {
    console.error('[Agent Worktree Trace] Failed to scan worktrees:', error);
  }
}

/**
 * Start periodic worktree scanning
 */
function startPeriodicRefresh(): void {
  const config = vscode.workspace.getConfiguration('agentWorktreeTrace');
  const intervalSeconds = config.get<number>('scanIntervalSeconds', 60);

  scanInterval = setInterval(async () => {
    if (vscode.window.state.focused) {
      await scanWorktrees();
    }
  }, intervalSeconds * 1000);

  console.log(`[Agent Worktree Trace] Started periodic refresh (every ${intervalSeconds}s)`);
}

/**
 * Stop periodic worktree scanning
 */
function stopPeriodicRefresh(): void {
  if (scanInterval) {
    clearInterval(scanInterval);
    scanInterval = undefined;
  }
}
