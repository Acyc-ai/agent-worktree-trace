// Fast unit tests for the pure badge / tooltip / decoration helpers.
// Host-independent: must not import `vscode` (unlike the integration suite,
// which stubs vscode.workspace.getConfiguration unnecessarily for these).

import * as assert from 'assert';
import { TrackedFile } from '../../types';
import { generateBadge, generateTooltip, shouldDecorate } from '../../utils/badgeGenerator';

const wt = (over: Partial<TrackedFile> = {}): TrackedFile => ({
  relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified', ...over,
});

describe('badgeGenerator (unit)', () => {
  describe('generateBadge', () => {
    it('returns "W" for a single committed agent', () => {
      assert.strictEqual(generateBadge([wt()], false), 'W');
    });

    it('returns "W3" for three agents', () => {
      assert.strictEqual(
        generateBadge([wt({ worktreeName: 'a' }), wt({ worktreeName: 'b' }), wt({ worktreeName: 'c' })], false),
        'W3'
      );
    });

    it('returns "W*" for a single agent with uncommitted changes', () => {
      assert.strictEqual(generateBadge([wt({ uncommitted: true })], false), 'W*');
    });

    it('returns "W*" when the single agent has committed + uncommitted on top', () => {
      assert.strictEqual(generateBadge([wt({ hasUncommittedOnTop: true })], false), 'W*');
    });

    it('returns "!W" when the user also modified the file (highest priority)', () => {
      assert.strictEqual(generateBadge([wt()], true), '!W');
    });

    it('prioritises the user-modified prefix over count and uncommitted', () => {
      const worktrees = [wt({ worktreeName: 'a' }), wt({ worktreeName: 'b' }), wt({ worktreeName: 'c', uncommitted: true })];
      assert.strictEqual(generateBadge(worktrees, true), '!W');
    });

    it('returns undefined for no worktrees', () => {
      assert.strictEqual(generateBadge([], false), undefined);
    });

    it('shows the count (not "*") when multiple agents and only some are uncommitted', () => {
      assert.strictEqual(
        generateBadge([wt({ worktreeName: 'a', uncommitted: false }), wt({ worktreeName: 'b', uncommitted: true })], false),
        'W2'
      );
    });
  });

  describe('generateTooltip', () => {
    it('lists a single worktree name', () => {
      assert.strictEqual(generateTooltip([wt({ worktreeName: 'worktree-agent-1' })], false), 'Changed by: worktree-agent-1');
    });

    it('joins multiple worktree names with commas', () => {
      assert.strictEqual(
        generateTooltip([wt({ worktreeName: 'agent-1' }), wt({ worktreeName: 'agent-2' })], false),
        'Changed by: agent-1, agent-2'
      );
    });

    it('annotates uncommitted worktrees', () => {
      assert.strictEqual(
        generateTooltip([wt({ worktreeName: 'agent-1' }), wt({ worktreeName: 'agent-2', uncommitted: true })], false),
        'Changed by: agent-1, agent-2 (uncommitted)'
      );
    });

    it('annotates committed + uncommitted worktrees', () => {
      assert.strictEqual(
        generateTooltip([wt({ worktreeName: 'agent-1', hasUncommittedOnTop: true })], false),
        'Changed by: agent-1 (committed + uncommitted)'
      );
    });

    it('prepends the local-changes prefix when the user modified the file', () => {
      assert.strictEqual(generateTooltip([wt({ worktreeName: 'agent-1' })], true), '[!local changes] Changed by: agent-1');
    });
  });

  describe('shouldDecorate', () => {
    it('returns true for a tracked file inside the workspace', () => {
      assert.strictEqual(shouldDecorate('file', 'src/file.ts', '/workspace/src/file.ts', true, true), true);
    });

    it('returns false for a non-file scheme', () => {
      assert.strictEqual(shouldDecorate('git', 'src/file.ts', '/workspace/src/file.ts', true, true), false);
    });

    it('returns false when decorations are disabled', () => {
      assert.strictEqual(shouldDecorate('file', 'src/file.ts', '/workspace/src/file.ts', false, true), false);
    });

    it('returns false for a file outside the workspace (relativePath === fsPath)', () => {
      assert.strictEqual(shouldDecorate('file', '/other/path/file.ts', '/other/path/file.ts', true, true), false);
    });

    it('returns false when there are no tracked files', () => {
      assert.strictEqual(shouldDecorate('file', 'src/untracked.ts', '/workspace/src/untracked.ts', true, false), false);
    });
  });
});
