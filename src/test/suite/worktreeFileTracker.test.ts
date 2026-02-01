import * as assert from 'assert';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { TrackedFile } from '../../types';
import { parseGitDiffOutput } from '../../utils/gitDiffParser';
import { aggregateFiles, clearWorktreeFromMap } from '../../utils/fileAggregation';

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
});
