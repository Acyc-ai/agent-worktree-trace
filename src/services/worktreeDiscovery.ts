// Worktree Discovery Service

import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { Worktree } from '../types';
import { parseWorktreeList, filterWorktreesByPattern } from '../utils/worktreeParser';

const execFileAsync = promisify(execFile);

/**
 * Function used to execute git. Mirrors the promisified `execFile` signature:
 * (file, args, options) => Promise<{ stdout, stderr }>.
 *
 * Using `execFile` (rather than `exec`) means git arguments are passed as a
 * literal argv array and are NOT interpreted by a shell. This eliminates
 * shell-injection risk from user-controlled strings such as branch names.
 */
export type ExecFileFn = (
  file: string,
  args: string[],
  options: { cwd: string }
) => Promise<{ stdout: string; stderr: string }>;

/**
 * Service for discovering git worktrees in a repository.
 * Parses `git worktree list --porcelain` output and filters by configured pattern.
 */
export class WorktreeDiscoveryService {
  private workspaceRoot: string;
  private execFn: ExecFileFn;

  constructor(workspaceRoot: string, execFn?: ExecFileFn) {
    this.workspaceRoot = workspaceRoot;
    this.execFn = execFn ?? (execFileAsync as unknown as ExecFileFn);
  }

  /**
   * Discover all worktrees that match the configured pattern
   */
  async discoverWorktrees(): Promise<Worktree[]> {
    try {
      const { stdout } = await this.execFn('git', ['worktree', 'list', '--porcelain'], {
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
