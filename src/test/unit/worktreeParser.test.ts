// Fast unit tests for the pure worktree porcelain parser and glob helpers.
// Host-independent: must not import `vscode`.

import * as assert from 'assert';
import {
  parseWorktreeList,
  globToRegex,
  filterWorktreesByPattern,
} from '../../utils/worktreeParser';

describe('worktreeParser (unit)', () => {
  describe('parseWorktreeList', () => {
    it('parses a single worktree and flags it as main', () => {
      const output = `worktree /home/user/project
HEAD abc123def456
branch refs/heads/main
`;
      const result = parseWorktreeList(output, '/home/user/project');

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].path, '/home/user/project');
      assert.strictEqual(result[0].branch, 'main');
      assert.strictEqual(result[0].isMainWorktree, true);
    });

    it('parses multiple worktrees with stripped branch refs', () => {
      const output = `worktree /home/user/project
HEAD abc123
branch refs/heads/main

worktree /home/user/worktree-agent-1
HEAD def456
branch refs/heads/feature/task-1

worktree /home/user/worktree-agent-2
HEAD ghi789
branch refs/heads/feature/task-2
`;
      const result = parseWorktreeList(output, '/home/user/project');

      assert.strictEqual(result.length, 3);
      assert.strictEqual(result[0].isMainWorktree, true);
      assert.strictEqual(result[1].branch, 'feature/task-1');
      assert.strictEqual(result[1].isMainWorktree, false);
      assert.strictEqual(result[2].branch, 'feature/task-2');
    });

    it('treats a bare repository as the main worktree', () => {
      const output = `worktree /home/user/project.git
bare

worktree /home/user/worktree-agent-1
HEAD def456
branch refs/heads/feature/task-1
`;
      const result = parseWorktreeList(output, '/other/path');

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].isMainWorktree, true);
      assert.strictEqual(result[1].isMainWorktree, false);
    });

    it('returns no worktrees for empty output', () => {
      assert.strictEqual(parseWorktreeList('', '/home/user/project').length, 0);
    });

    it('falls back to HEAD branch for detached HEAD', () => {
      const output = `worktree /home/user/worktree-agent-1
HEAD abc123
detached
`;
      const result = parseWorktreeList(output, '/home/user/project');

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].branch, 'HEAD');
    });
  });

  describe('globToRegex', () => {
    it('converts * to a multi-character wildcard', () => {
      const regex = globToRegex('worktree-agent-*');
      assert.ok(regex.test('worktree-agent-1'));
      assert.ok(regex.test('worktree-agent-foo'));
      assert.ok(!regex.test('other-worktree'));
    });

    it('converts ? to a single-character wildcard', () => {
      const regex = globToRegex('agent-?');
      assert.ok(regex.test('agent-1'));
      assert.ok(!regex.test('agent-12'));
    });

    it('treats . as a literal dot', () => {
      const regex = globToRegex('agent.work');
      assert.ok(regex.test('agent.work'));
      assert.ok(!regex.test('agentXwork'));
    });

    it('escapes other regex metacharacters literally', () => {
      assert.ok(globToRegex('agent+work').test('agent+work'));
      assert.ok(!globToRegex('agent+work').test('agentwork'));
      assert.ok(globToRegex('agent(1)').test('agent(1)'));
      assert.ok(!globToRegex('agent(1)').test('agent1'));
      assert.ok(globToRegex('agent[ab]').test('agent[ab]'));
      assert.ok(!globToRegex('agent[ab]').test('agenta'));
    });
  });

  describe('filterWorktreesByPattern', () => {
    it('keeps only non-main worktrees matching the pattern', () => {
      const worktrees = [
        { path: '/home/user/project', branch: 'main', isMainWorktree: true },
        { path: '/home/user/worktree-agent-1', branch: 'feature/1', isMainWorktree: false },
        { path: '/home/user/worktree-agent-2', branch: 'feature/2', isMainWorktree: false },
        { path: '/home/user/other-worktree', branch: 'other', isMainWorktree: false },
      ];

      const result = filterWorktreesByPattern(worktrees, 'worktree-agent-*');

      assert.strictEqual(result.length, 2);
      assert.ok(result.every((wt) => wt.path.includes('worktree-agent-')));
    });

    it('always excludes the main worktree even if it matches', () => {
      const worktrees = [
        { path: '/home/user/worktree-agent-main', branch: 'main', isMainWorktree: true },
        { path: '/home/user/worktree-agent-1', branch: 'feature/1', isMainWorktree: false },
      ];

      const result = filterWorktreesByPattern(worktrees, 'worktree-agent-*');

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].path, '/home/user/worktree-agent-1');
    });

    it('returns an empty array when nothing matches', () => {
      const worktrees = [
        { path: '/home/user/project', branch: 'main', isMainWorktree: true },
        { path: '/home/user/other-worktree', branch: 'other', isMainWorktree: false },
      ];

      assert.strictEqual(filterWorktreesByPattern(worktrees, 'worktree-agent-*').length, 0);
    });
  });
});
