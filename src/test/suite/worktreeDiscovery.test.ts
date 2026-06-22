import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { WorktreeDiscoveryService } from '../../services/worktreeDiscovery';
import { parseWorktreeList, filterWorktreesByPattern, globToRegex } from '../../utils/worktreeParser';

suite('WorktreeDiscovery', () => {
  let configStub: sinon.SinonStub;

  setup(() => {
    // Mock VS Code configuration
    configStub = sinon.stub(vscode.workspace, 'getConfiguration');
    configStub.returns({
      get: (key: string, defaultValue: unknown) => {
        if (key === 'worktreePattern') return 'worktree-agent-*';
        return defaultValue;
      }
    } as unknown as vscode.WorkspaceConfiguration);
  });

  teardown(() => {
    sinon.restore();
  });

  suite('parseWorktreeList', () => {
    test('parses single worktree correctly', () => {
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

    test('parses multiple worktrees correctly', () => {
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

    test('identifies bare repository as main worktree', () => {
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

    test('handles empty output', () => {
      const result = parseWorktreeList('', '/home/user/project');
      assert.strictEqual(result.length, 0);
    });

    test('handles detached HEAD (no branch)', () => {
      const output = `worktree /home/user/worktree-agent-1
HEAD abc123
detached
`;
      const result = parseWorktreeList(output, '/home/user/project');

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].branch, 'HEAD');
    });
  });

  suite('globToRegex', () => {
    test('converts * wildcard to .*', () => {
      const regex = globToRegex('worktree-agent-*');
      assert.ok(regex.test('worktree-agent-1'));
      assert.ok(regex.test('worktree-agent-foo'));
      assert.ok(!regex.test('other-worktree'));
    });

    test('converts ? wildcard to single character match', () => {
      const regex = globToRegex('agent-?');
      assert.ok(regex.test('agent-1'));
      assert.ok(regex.test('agent-a'));
      assert.ok(!regex.test('agent-12'));
    });

    test('treats . as a literal dot, not regex any-char', () => {
      const regex = globToRegex('agent.work');
      assert.ok(regex.test('agent.work'));
      assert.ok(!regex.test('agentXwork'));
    });

    test('escapes other regex metacharacters literally', () => {
      // + should match a literal plus, not "one or more"
      const plusRegex = globToRegex('agent+work');
      assert.ok(plusRegex.test('agent+work'));
      assert.ok(!plusRegex.test('agentwork'));
      assert.ok(!plusRegex.test('agenttwork'));

      // Parentheses are literal
      const parenRegex = globToRegex('agent(1)');
      assert.ok(parenRegex.test('agent(1)'));
      assert.ok(!parenRegex.test('agent1'));

      // Square brackets are literal, not a character class
      const bracketRegex = globToRegex('agent[ab]');
      assert.ok(bracketRegex.test('agent[ab]'));
      assert.ok(!bracketRegex.test('agenta'));
      assert.ok(!bracketRegex.test('agentb'));

      // Anchors and alternation are literal
      const anchorRegex = globToRegex('a^b$c|d');
      assert.ok(anchorRegex.test('a^b$c|d'));
      assert.ok(!anchorRegex.test('ac'));
    });

    test('preserves wildcard behaviour alongside escaped literals', () => {
      // Standard pattern with a literal hyphen still works
      const standard = globToRegex('worktree-agent-*');
      assert.ok(standard.test('worktree-agent-3'));
      assert.ok(standard.test('worktree-agent-foo'));
      assert.ok(!standard.test('other-agent-3'));

      // Mix of literal dot and wildcards
      const mixed = globToRegex('agent.v?-*');
      assert.ok(mixed.test('agent.v1-feature'));
      assert.ok(!mixed.test('agentXv1-feature'));
      assert.ok(!mixed.test('agent.v12-feature'));
    });
  });

  suite('filterWorktreesByPattern', () => {
    test('filters worktrees matching pattern', () => {
      const worktrees = [
        { path: '/home/user/project', branch: 'main', isMainWorktree: true },
        { path: '/home/user/worktree-agent-1', branch: 'feature/1', isMainWorktree: false },
        { path: '/home/user/worktree-agent-2', branch: 'feature/2', isMainWorktree: false },
        { path: '/home/user/other-worktree', branch: 'other', isMainWorktree: false },
      ];

      const result = filterWorktreesByPattern(worktrees, 'worktree-agent-*');

      assert.strictEqual(result.length, 2);
      assert.ok(result.every(wt => wt.path.includes('worktree-agent-')));
    });

    test('excludes main worktree from results', () => {
      const worktrees = [
        { path: '/home/user/worktree-agent-main', branch: 'main', isMainWorktree: true },
        { path: '/home/user/worktree-agent-1', branch: 'feature/1', isMainWorktree: false },
      ];

      const result = filterWorktreesByPattern(worktrees, 'worktree-agent-*');

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].path, '/home/user/worktree-agent-1');
    });

    test('supports single character wildcard', () => {
      const worktrees = [
        { path: '/home/user/agent-a', branch: 'a', isMainWorktree: false },
        { path: '/home/user/agent-b', branch: 'b', isMainWorktree: false },
        { path: '/home/user/agent-ab', branch: 'ab', isMainWorktree: false },
      ];

      const result = filterWorktreesByPattern(worktrees, 'agent-?');

      assert.strictEqual(result.length, 2);
      assert.ok(result.every(wt => wt.path.match(/agent-[ab]$/)));
    });

    test('returns empty array when no matches', () => {
      const worktrees = [
        { path: '/home/user/project', branch: 'main', isMainWorktree: true },
        { path: '/home/user/other-worktree', branch: 'other', isMainWorktree: false },
      ];

      const result = filterWorktreesByPattern(worktrees, 'worktree-agent-*');

      assert.strictEqual(result.length, 0);
    });
  });

  suite('discoverWorktrees', () => {
    test('discovers and filters worktrees matching pattern', async () => {
      const mockExec = sinon.stub().resolves({
        stdout: `worktree /home/user/project
HEAD abc123
branch refs/heads/main

worktree /home/user/worktree-agent-1
HEAD def456
branch refs/heads/feature-1

worktree /home/user/other-worktree
HEAD ghi789
branch refs/heads/other
`,
        stderr: ''
      });

      const service = new WorktreeDiscoveryService('/home/user/project', mockExec as never);
      const result = await service.discoverWorktrees();

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].path, '/home/user/worktree-agent-1');
      assert.strictEqual(result[0].branch, 'feature-1');
      assert.strictEqual(result[0].isMainWorktree, false);
    });

    test('returns empty array on git failure', async () => {
      const mockExec = sinon.stub().rejects(new Error('git not found'));
      // Suppress console.error output during this test (expected)
      const errorStub = sinon.stub(console, 'error');

      const service = new WorktreeDiscoveryService('/home/user/project', mockExec as never);
      const result = await service.discoverWorktrees();

      errorStub.restore();
      assert.deepStrictEqual(result, []);
    });
  });
});
