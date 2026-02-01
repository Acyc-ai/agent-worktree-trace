import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { TrackedFile } from '../../types';
import { generateBadge, generateTooltip, shouldDecorate } from '../../utils/badgeGenerator';

suite('WorktreeFileDecoration', () => {
  let configStub: sinon.SinonStub;

  setup(() => {
    configStub = sinon.stub(vscode.workspace, 'getConfiguration');
    configStub.returns({
      get: (key: string, defaultValue: unknown) => {
        if (key === 'enableFileDecorations') return true;
        return defaultValue;
      }
    } as unknown as vscode.WorkspaceConfiguration);
  });

  teardown(() => {
    sinon.restore();
  });

  suite('generateBadge', () => {
    test('returns "W" for single agent, no special conditions', () => {
      const worktrees: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified' }
      ];

      const badge = generateBadge(worktrees, false);

      assert.strictEqual(badge, 'W');
    });

    test('returns "W3" for three agents', () => {
      const worktrees: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified' },
        { relativePath: 'src/file.ts', worktreeName: 'agent-2', branch: 'b2', changeType: 'modified' },
        { relativePath: 'src/file.ts', worktreeName: 'agent-3', branch: 'b3', changeType: 'modified' }
      ];

      const badge = generateBadge(worktrees, false);

      assert.strictEqual(badge, 'W3');
    });

    test('adds "*" suffix for uncommitted changes', () => {
      const worktrees: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified', uncommitted: true }
      ];

      const badge = generateBadge(worktrees, false);

      assert.strictEqual(badge, 'W*');
    });

    test('adds "!" prefix when user modified', () => {
      const worktrees: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified' }
      ];

      const badge = generateBadge(worktrees, true);

      assert.strictEqual(badge, '!W');
    });

    test('combines all indicators correctly', () => {
      const worktrees: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified' },
        { relativePath: 'src/file.ts', worktreeName: 'agent-2', branch: 'b2', changeType: 'modified' },
        { relativePath: 'src/file.ts', worktreeName: 'agent-3', branch: 'b3', changeType: 'modified', uncommitted: true }
      ];

      const badge = generateBadge(worktrees, true);

      assert.strictEqual(badge, '!W');
    });

    test('returns undefined for empty worktrees', () => {
      const badge = generateBadge([], false);

      assert.strictEqual(badge, undefined);
    });

    test('only shows uncommitted if at least one is uncommitted', () => {
      const worktrees: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified', uncommitted: false },
        { relativePath: 'src/file.ts', worktreeName: 'agent-2', branch: 'b2', changeType: 'modified', uncommitted: true }
      ];

      const badge = generateBadge(worktrees, false);

      assert.strictEqual(badge, 'W2');
    });
  });

  suite('generateTooltip', () => {
    test('lists single worktree name', () => {
      const worktrees: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'worktree-agent-1', branch: 'b1', changeType: 'modified' }
      ];

      const tooltip = generateTooltip(worktrees, false);

      assert.strictEqual(tooltip, 'Touched by: worktree-agent-1');
    });

    test('lists multiple worktree names separated by commas', () => {
      const worktrees: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified' },
        { relativePath: 'src/file.ts', worktreeName: 'agent-2', branch: 'b2', changeType: 'modified' }
      ];

      const tooltip = generateTooltip(worktrees, false);

      assert.strictEqual(tooltip, 'Touched by: agent-1, agent-2');
    });

    test('adds uncommitted indicator per worktree', () => {
      const worktrees: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified' },
        { relativePath: 'src/file.ts', worktreeName: 'agent-2', branch: 'b2', changeType: 'modified', uncommitted: true }
      ];

      const tooltip = generateTooltip(worktrees, false);

      assert.strictEqual(tooltip, 'Touched by: agent-1, agent-2 (uncommitted)');
    });

    test('adds local changes prefix when user modified', () => {
      const worktrees: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified' }
      ];

      const tooltip = generateTooltip(worktrees, true);

      assert.strictEqual(tooltip, '[!local changes] Touched by: agent-1');
    });

    test('shows committed + uncommitted status', () => {
      const worktrees: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified', hasUncommittedOnTop: true }
      ];

      const tooltip = generateTooltip(worktrees, false);

      assert.strictEqual(tooltip, 'Touched by: agent-1 (committed + uncommitted)');
    });
  });

  suite('shouldDecorate', () => {
    test('returns true for tracked file in workspace', () => {
      const result = shouldDecorate('file', 'src/file.ts', '/workspace/src/file.ts', true, true);

      assert.strictEqual(result, true);
    });

    test('returns false for non-file scheme', () => {
      const result = shouldDecorate('git', 'src/file.ts', '/workspace/src/file.ts', true, true);

      assert.strictEqual(result, false);
    });

    test('returns false when decorations disabled', () => {
      const result = shouldDecorate('file', 'src/file.ts', '/workspace/src/file.ts', false, true);

      assert.strictEqual(result, false);
    });

    test('returns false for file outside workspace', () => {
      const result = shouldDecorate('file', '/other/path/file.ts', '/other/path/file.ts', true, true);

      assert.strictEqual(result, false);
    });

    test('returns false for untracked file', () => {
      const result = shouldDecorate('file', 'src/untracked.ts', '/workspace/src/untracked.ts', true, false);

      assert.strictEqual(result, false);
    });
  });
});
