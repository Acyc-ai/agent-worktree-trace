// Worktree Discovery Service

import * as vscode from 'vscode';
import { exec } from 'child_process';
import { promisify } from 'util';
import { Worktree } from '../types';
import { parseWorktreeList, filterWorktreesByPattern } from '../utils/worktreeParser';

const execAsync = promisify(exec);

type ExecFn = typeof execAsync;

/**
 * Service for discovering git worktrees in a repository.
 * Parses `git worktree list --porcelain` output and filters by configured pattern.
 */
export class WorktreeDiscoveryService {
  private workspaceRoot: string;
  private execFn: ExecFn;

  constructor(workspaceRoot: string, execFn?: ExecFn) {
    this.workspaceRoot = workspaceRoot;
    this.execFn = execFn ?? execAsync;
  }

  /**
   * Discover all worktrees that match the configured pattern
   */
  async discoverWorktrees(): Promise<Worktree[]> {
    try {
      const { stdout } = await this.execFn('git worktree list --porcelain', {
        cwd: this.workspaceRoot,
      });

      const allWorktrees = parseWorktreeList(stdout, this.workspaceRoot);
      const config = vscode.workspace.getConfiguration('agentWorktreeTrace');
      const pattern = config.get<string>('worktreePattern', 'worktree-agent-*');
      return filterWorktreesByPattern(allWorktrees, pattern);
    } catch (error) {
      console.error('Failed to discover worktrees:', error);
      return [];
    }
  }

  /**
   * Get the workspace root path
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot;
  }
}

/**
 * Create a WorktreeDiscoveryService instance
 */
export function createWorktreeDiscoveryService(workspaceRoot: string): WorktreeDiscoveryService {
  return new WorktreeDiscoveryService(workspaceRoot);
}
