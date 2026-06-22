import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import * as os from 'os';
import { TrackedFile, Worktree } from '../../types';
import { parseGitDiffOutput } from '../../utils/gitDiffParser';
import { aggregateFiles, clearWorktreeFromMap } from '../../utils/fileAggregation';
import { WorktreeFileTrackerService } from '../../services/worktreeFileTracker';

suite('WorktreeFileTracker', () => {
  let configStub: sinon.SinonStub;

  setup(() => {
    configStub = sinon.stub(vscode.workspace, 'getConfiguration');
    configStub.returns({
      get: (key: string, defaultValue: unknown) => {
        if (key === 'enableFileDecorations') return true;
        if (key === 'trackUncommittedChanges') return false;
        return defaultValue;
      }
    } as unknown as vscode.WorkspaceConfiguration);
  });

  teardown(() => {
    sinon.restore();
  });

  suite('parseGitDiffOutput', () => {
    test('parses added files correctly', () => {
      const output = 'A\tsrc/newfile.ts\n';
      const result = parseGitDiffOutput(output, 'worktree-agent-1', 'feature/test', false);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].relativePath, 'src/newfile.ts');
      assert.strictEqual(result[0].changeType, 'added');
      assert.strictEqual(result[0].worktreeName, 'worktree-agent-1');
      assert.strictEqual(result[0].branch, 'feature/test');
      assert.strictEqual(result[0].uncommitted, undefined);
    });

    test('parses modified files correctly', () => {
      const output = 'M\tsrc/existing.ts\n';
      const result = parseGitDiffOutput(output, 'worktree-agent-1', 'feature/test', false);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].changeType, 'modified');
    });

    test('parses deleted files correctly', () => {
      const output = 'D\tsrc/removed.ts\n';
      const result = parseGitDiffOutput(output, 'worktree-agent-1', 'feature/test', false);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].changeType, 'deleted');
    });

    test('parses renamed files as modified', () => {
      const output = 'R\tsrc/renamed.ts\n';
      const result = parseGitDiffOutput(output, 'worktree-agent-1', 'feature/test', false);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].changeType, 'modified');
    });

    test('parses renamed entries with score and two paths, using destination path', () => {
      const output = 'R100\tsrc/old.ts\tsrc/new.ts\n';
      const result = parseGitDiffOutput(output, 'worktree-agent-1', 'feature/test', false);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].relativePath, 'src/new.ts');
      assert.strictEqual(result[0].changeType, 'modified');
    });

    test('parses copied entries with score and two paths, using destination path', () => {
      const output = 'C75\tsrc/old.ts\tsrc/copy.ts\n';
      const result = parseGitDiffOutput(output, 'worktree-agent-1', 'feature/test', false);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].relativePath, 'src/copy.ts');
      assert.strictEqual(result[0].changeType, 'modified');
    });

    test('parses rename/copy destination paths containing spaces', () => {
      const output = 'R96\told name.ts\tnew name.ts\n';
      const result = parseGitDiffOutput(output, 'worktree-agent-1', 'feature/test', false);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].relativePath, 'new name.ts');
      assert.strictEqual(result[0].changeType, 'modified');
    });

    test('parses mixed A/M/D and rename/copy output together', () => {
      const output = [
        'A\tsrc/new.ts',
        'M\tsrc/changed.ts',
        'D\tsrc/removed.ts',
        'R100\tsrc/from.ts\tsrc/to.ts',
        'C50\tsrc/src.ts\tsrc/dest.ts'
      ].join('\n') + '\n';
      const result = parseGitDiffOutput(output, 'worktree-agent-1', 'feature/test', false);

      assert.strictEqual(result.length, 5);
      assert.strictEqual(result[0].changeType, 'added');
      assert.strictEqual(result[1].changeType, 'modified');
      assert.strictEqual(result[2].changeType, 'deleted');
      assert.strictEqual(result[3].relativePath, 'src/to.ts');
      assert.strictEqual(result[3].changeType, 'modified');
      assert.strictEqual(result[4].relativePath, 'src/dest.ts');
      assert.strictEqual(result[4].changeType, 'modified');
    });

    test('parses multiple files correctly', () => {
      const output = `A\tsrc/new1.ts
M\tsrc/changed.ts
D\tsrc/removed.ts
A\tsrc/new2.ts
`;
      const result = parseGitDiffOutput(output, 'worktree-agent-1', 'feature/test', false);

      assert.strictEqual(result.length, 4);
      assert.strictEqual(result[0].changeType, 'added');
      assert.strictEqual(result[1].changeType, 'modified');
      assert.strictEqual(result[2].changeType, 'deleted');
      assert.strictEqual(result[3].changeType, 'added');
    });

    test('marks uncommitted files correctly', () => {
      const output = 'M\tsrc/uncommitted.ts\n';
      const result = parseGitDiffOutput(output, 'worktree-agent-1', 'feature/test', true);

      assert.strictEqual(result[0].uncommitted, true);
    });

    test('handles empty output', () => {
      const result = parseGitDiffOutput('', 'worktree-agent-1', 'feature/test', false);
      assert.strictEqual(result.length, 0);
    });

    test('handles files with spaces in path', () => {
      const output = 'A\tsrc/my file.ts\n';
      const result = parseGitDiffOutput(output, 'worktree-agent-1', 'feature/test', false);

      assert.strictEqual(result.length, 1);
      assert.strictEqual(result[0].relativePath, 'src/my file.ts');
    });
  });

  suite('aggregateFiles', () => {
    test('aggregates files from multiple worktrees', () => {
      const files1: TrackedFile[] = [
        { relativePath: 'src/shared.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified' }
      ];
      const files2: TrackedFile[] = [
        { relativePath: 'src/shared.ts', worktreeName: 'agent-2', branch: 'b2', changeType: 'modified' }
      ];

      const result = aggregateFiles([files1, files2]);

      assert.strictEqual(result.size, 1);
      assert.strictEqual(result.get('src/shared.ts')?.length, 2);
    });

    test('keeps unique entries per worktree', () => {
      const files1: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified' },
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'added' }
      ];

      const result = aggregateFiles([files1]);

      assert.strictEqual(result.get('src/file.ts')?.length, 1);
    });

    test('prefers committed over uncommitted for same worktree', () => {
      const uncommittedFirst: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified', uncommitted: true }
      ];
      const committedSecond: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified', uncommitted: false }
      ];

      const result = aggregateFiles([uncommittedFirst, committedSecond]);

      assert.strictEqual(result.get('src/file.ts')?.[0].uncommitted, false);
    });

    test('handles files unique to each worktree', () => {
      const files1: TrackedFile[] = [
        { relativePath: 'src/file1.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'added' }
      ];
      const files2: TrackedFile[] = [
        { relativePath: 'src/file2.ts', worktreeName: 'agent-2', branch: 'b2', changeType: 'added' }
      ];

      const result = aggregateFiles([files1, files2]);

      assert.strictEqual(result.size, 2);
      assert.strictEqual(result.get('src/file1.ts')?.length, 1);
      assert.strictEqual(result.get('src/file2.ts')?.length, 1);
    });
  });

  suite('clearWorktreeFromMap', () => {
    test('removes only specified worktree entries', () => {
      const initial = new Map<string, TrackedFile[]>([
        ['src/shared.ts', [
          { relativePath: 'src/shared.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified' },
          { relativePath: 'src/shared.ts', worktreeName: 'agent-2', branch: 'b2', changeType: 'modified' }
        ]],
        ['src/unique.ts', [
          { relativePath: 'src/unique.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'added' }
        ]]
      ]);

      const result = clearWorktreeFromMap(initial, 'agent-1');

      assert.strictEqual(result.size, 1);
      assert.strictEqual(result.get('src/shared.ts')?.length, 1);
      assert.strictEqual(result.get('src/shared.ts')?.[0].worktreeName, 'agent-2');
      assert.strictEqual(result.has('src/unique.ts'), false);
    });

    test('handles clearing non-existent worktree', () => {
      const initial = new Map<string, TrackedFile[]>([
        ['src/file.ts', [
          { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified' }
        ]]
      ]);

      const result = clearWorktreeFromMap(initial, 'non-existent');

      assert.strictEqual(result.size, 1);
      assert.strictEqual(result.get('src/file.ts')?.length, 1);
    });
  });

  // Regression coverage for issue #1: git must be invoked via execFile-style
  // argv arrays, never a shell command string. A comparison branch (or any
  // other branch name) containing shell metacharacters must be passed as a
  // single literal argv element and must NEVER reach a shell.
  suite('git execution hardening (no shell injection)', () => {
    /**
     * Build a fake execFile-style function that records every invocation and
     * returns canned, empty git output. The recorded calls let us assert that
     * every git argument is a literal array element.
     */
    function makeRecordingExec(): {
      exec: (file: string, args: string[], options: { cwd: string }) => Promise<{ stdout: string; stderr: string }>;
      calls: Array<{ file: string; args: string[]; cwd: string }>;
    } {
      const calls: Array<{ file: string; args: string[]; cwd: string }> = [];
      const exec = async (file: string, args: string[], options: { cwd: string }) => {
        calls.push({ file, args, cwd: options.cwd });
        // rev-parse --verify is used to validate the branch exists; succeed so
        // scanning proceeds and the diff command is exercised.
        return { stdout: '', stderr: '' };
      };
      return { exec, calls };
    }

    function stubComparisonBranch(branch: string): void {
      configStub.restore();
      configStub = sinon.stub(vscode.workspace, 'getConfiguration');
      configStub.returns({
        get: (key: string, defaultValue: unknown) => {
          if (key === 'enableFileDecorations') return true;
          if (key === 'trackUncommittedChanges') return false;
          if (key === 'comparisonBranch') return branch;
          return defaultValue;
        }
      } as unknown as vscode.WorkspaceConfiguration);
    }

    const maliciousBranches = [
      'foo;rm -rf x',
      '$(touch pwned)',
      '`touch pwned`',
      'foo"; echo hi; "bar',
      "foo' || true; '"
    ];

    for (const malicious of maliciousBranches) {
      test(`passes branch "${malicious}" as a literal argv element`, async () => {
        stubComparisonBranch(malicious);
        const { exec, calls } = makeRecordingExec();

        const tracker = new WorktreeFileTrackerService(
          '/tmp/repo',
          os.tmpdir(),
          exec
        );

        const worktrees: Worktree[] = [
          { path: '/tmp/repo/worktree-agent-1', branch: 'feature/x', isMainWorktree: false }
        ];

        await tracker.scanAllWorktrees(worktrees);

        // Every git call must be invoked as ("git", [args...]) — never as a
        // single shell string. Args must never be concatenated together.
        for (const call of calls) {
          assert.strictEqual(call.file, 'git', 'git must be the executable, not a shell');
          assert.ok(Array.isArray(call.args), 'args must be an array');
          // No single arg should contain the whole command glued together.
          assert.ok(
            !call.args.some(a => a.includes(' git ')),
            'arguments must not contain a concatenated shell command'
          );
        }

        // The branch must be validated literally via rev-parse --verify <branch>.
        const verifyCall = calls.find(
          c => c.args[0] === 'rev-parse' && c.args.includes('--verify')
        );
        assert.ok(verifyCall, 'expected a rev-parse --verify call');
        assert.strictEqual(
          verifyCall!.args[verifyCall!.args.length - 1],
          malicious,
          'branch name must be passed verbatim as its own argv element (no quoting, no shell)'
        );

        // The diff must reference the branch via a literal `<branch>...HEAD`
        // argv element — not interpolated into a quoted shell string.
        const diffCall = calls.find(
          c => c.args[0] === 'diff' && c.args.some(a => a.endsWith('...HEAD'))
        );
        assert.ok(diffCall, 'expected a git diff ...HEAD call');
        assert.ok(
          diffCall!.args.includes(`${malicious}...HEAD`),
          'diff range must contain the branch name verbatim with no surrounding quotes'
        );
        // Guard against the old quoted form sneaking back in: the range must
        // never be wrapped in literal shell quotes (e.g. `"<branch>...HEAD"`).
        // Note: a quote character that is part of the branch name itself is
        // fine — passing it verbatim as argv data is exactly the safe behaviour.
        assert.ok(
          !diffCall!.args.includes(`"${malicious}...HEAD"`),
          'diff range must not be wrapped in shell quote characters'
        );
      });
    }

    test('resolves the comparison branch exactly once per scan pass', async () => {
      // Use an explicit branch name (not 'current'/'main') so resolution is a
      // single rev-parse --verify, isolating the "once per pass" guarantee.
      stubComparisonBranch('develop');
      const { exec, calls } = makeRecordingExec();

      const tracker = new WorktreeFileTrackerService(
        '/tmp/repo',
        os.tmpdir(),
        exec
      );

      const worktrees: Worktree[] = [
        { path: '/tmp/repo/worktree-agent-1', branch: 'feature/a', isMainWorktree: false },
        { path: '/tmp/repo/worktree-agent-2', branch: 'feature/b', isMainWorktree: false },
        { path: '/tmp/repo/worktree-agent-3', branch: 'feature/c', isMainWorktree: false }
      ];

      await tracker.scanAllWorktrees(worktrees);

      // Branch validation (rev-parse --verify) must happen once total, not once
      // per worktree, even though three worktrees were scanned.
      const verifyCalls = calls.filter(
        c => c.args[0] === 'rev-parse' && c.args.includes('--verify')
      );
      assert.strictEqual(
        verifyCalls.length,
        1,
        'comparison branch should be resolved/validated exactly once per pass'
      );

      // ...yet a diff should still run for each of the three worktrees.
      const diffCalls = calls.filter(
        c => c.args[0] === 'diff' && c.args.some(a => a.endsWith('...HEAD'))
      );
      assert.strictEqual(diffCalls.length, 3, 'each worktree should be diffed');
    });
  });
});
