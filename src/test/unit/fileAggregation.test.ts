// Fast unit tests for the pure file-aggregation helpers.
// Host-independent: must not import `vscode`.

import * as assert from 'assert';
import { TrackedFile } from '../../types';
import {
  aggregateFiles,
  clearWorktreeFromMap,
  getChangedPaths,
  trackedFilesEqual,
} from '../../utils/fileAggregation';

describe('fileAggregation (unit)', () => {
  describe('aggregateFiles', () => {
    it('groups the same path from multiple worktrees', () => {
      const files1: TrackedFile[] = [
        { relativePath: 'src/shared.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified' },
      ];
      const files2: TrackedFile[] = [
        { relativePath: 'src/shared.ts', worktreeName: 'agent-2', branch: 'b2', changeType: 'modified' },
      ];

      const result = aggregateFiles([files1, files2]);

      assert.strictEqual(result.size, 1);
      assert.strictEqual(result.get('src/shared.ts')?.length, 2);
    });

    it('keeps a single entry per worktree for the same path', () => {
      const files: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified' },
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'added' },
      ];

      assert.strictEqual(aggregateFiles([files]).get('src/file.ts')?.length, 1);
    });

    it('prefers a committed entry over an uncommitted one', () => {
      const uncommitted: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified', uncommitted: true },
      ];
      const committed: TrackedFile[] = [
        { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified', uncommitted: false },
      ];

      assert.strictEqual(aggregateFiles([uncommitted, committed]).get('src/file.ts')?.[0].uncommitted, false);
    });

    it('keeps files unique to each worktree', () => {
      const files1: TrackedFile[] = [
        { relativePath: 'src/file1.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'added' },
      ];
      const files2: TrackedFile[] = [
        { relativePath: 'src/file2.ts', worktreeName: 'agent-2', branch: 'b2', changeType: 'added' },
      ];

      const result = aggregateFiles([files1, files2]);
      assert.strictEqual(result.size, 2);
    });
  });

  describe('clearWorktreeFromMap', () => {
    it('removes only the specified worktree entries', () => {
      const initial = new Map<string, TrackedFile[]>([
        ['src/shared.ts', [
          { relativePath: 'src/shared.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified' },
          { relativePath: 'src/shared.ts', worktreeName: 'agent-2', branch: 'b2', changeType: 'modified' },
        ]],
        ['src/unique.ts', [
          { relativePath: 'src/unique.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'added' },
        ]],
      ]);

      const result = clearWorktreeFromMap(initial, 'agent-1');

      assert.strictEqual(result.size, 1);
      assert.strictEqual(result.get('src/shared.ts')?.length, 1);
      assert.strictEqual(result.get('src/shared.ts')?.[0].worktreeName, 'agent-2');
      assert.strictEqual(result.has('src/unique.ts'), false);
    });

    it('is a no-op for a non-existent worktree', () => {
      const initial = new Map<string, TrackedFile[]>([
        ['src/file.ts', [
          { relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified' },
        ]],
      ]);

      const result = clearWorktreeFromMap(initial, 'non-existent');
      assert.strictEqual(result.size, 1);
      assert.strictEqual(result.get('src/file.ts')?.length, 1);
    });
  });

  describe('trackedFilesEqual', () => {
    const base: TrackedFile = {
      relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified',
    };

    it('returns true for identical arrays', () => {
      assert.strictEqual(trackedFilesEqual([base], [{ ...base }]), true);
    });

    it('returns false for differing length', () => {
      assert.strictEqual(trackedFilesEqual([base], [base, base]), false);
    });

    it('returns false when changeType differs', () => {
      assert.strictEqual(trackedFilesEqual([base], [{ ...base, changeType: 'added' }]), false);
    });

    it('returns false when uncommitted status differs', () => {
      assert.strictEqual(trackedFilesEqual([base], [{ ...base, uncommitted: true }]), false);
    });
  });

  describe('getChangedPaths', () => {
    const file = (over: Partial<TrackedFile> = {}): TrackedFile => ({
      relativePath: 'src/file.ts', worktreeName: 'agent-1', branch: 'b1', changeType: 'modified', ...over,
    });

    it('detects a newly added path', () => {
      const oldState = new Map<string, TrackedFile[]>();
      const newState = new Map([['src/file.ts', [file()]]]);
      assert.deepStrictEqual([...getChangedPaths(oldState, newState)], ['src/file.ts']);
    });

    it('detects a removed path', () => {
      const oldState = new Map([['src/file.ts', [file()]]]);
      const newState = new Map<string, TrackedFile[]>();
      assert.deepStrictEqual([...getChangedPaths(oldState, newState)], ['src/file.ts']);
    });

    it('detects a modified path', () => {
      const oldState = new Map([['src/file.ts', [file({ uncommitted: false })]]]);
      const newState = new Map([['src/file.ts', [file({ uncommitted: true })]]]);
      assert.deepStrictEqual([...getChangedPaths(oldState, newState)], ['src/file.ts']);
    });

    it('reports no change for identical states', () => {
      const oldState = new Map([['src/file.ts', [file()]]]);
      const newState = new Map([['src/file.ts', [file()]]]);
      assert.strictEqual(getChangedPaths(oldState, newState).size, 0);
    });
  });
});
