// Fast unit tests for the pure git-diff parser.
//
// Runs under plain Mocha (BDD) WITHOUT the VS Code Electron host. This module
// must never import `vscode` so the unit tier stays host-independent.

import * as assert from 'assert';
import { parseGitDiffOutput } from '../../utils/gitDiffParser';
import {
  SIMPLE_STATUS_FIXTURES,
  RENAME_COPY_FIXTURES,
  MIXED_DIFF,
} from './fixtures/gitDiff.fixtures';

const WORKTREE = 'worktree-agent-1';
const BRANCH = 'feature/test';

describe('gitDiffParser (unit)', () => {
  describe('simple statuses (A/M/D)', () => {
    for (const fixture of SIMPLE_STATUS_FIXTURES) {
      it(`parses ${fixture.name}`, () => {
        const result = parseGitDiffOutput(fixture.raw + '\n', WORKTREE, BRANCH, false);

        assert.strictEqual(result.length, fixture.expected.length);
        fixture.expected.forEach((exp, i) => {
          assert.strictEqual(result[i].relativePath, exp.relativePath);
          assert.strictEqual(result[i].changeType, exp.changeType);
          assert.strictEqual(result[i].worktreeName, WORKTREE);
          assert.strictEqual(result[i].branch, BRANCH);
        });
      });
    }
  });

  describe('rename/copy fixtures (issue #2 regression)', () => {
    for (const fixture of RENAME_COPY_FIXTURES) {
      it(`parses ${fixture.name}`, () => {
        const result = parseGitDiffOutput(fixture.raw + '\n', WORKTREE, BRANCH, false);

        assert.strictEqual(
          result.length,
          fixture.expected.length,
          'rename/copy rows must not be silently dropped'
        );
        fixture.expected.forEach((exp, i) => {
          // Destination (new) path must be used, never the source.
          assert.strictEqual(
            result[i].relativePath,
            exp.relativePath,
            'rename/copy must resolve to the destination path'
          );
          assert.strictEqual(
            result[i].changeType,
            exp.changeType,
            'rename/copy must be classified as modified'
          );
        });
      });
    }
  });

  describe('mixed diff block', () => {
    it(`parses ${MIXED_DIFF.name}`, () => {
      const result = parseGitDiffOutput(MIXED_DIFF.raw + '\n', WORKTREE, BRANCH, false);

      assert.strictEqual(result.length, MIXED_DIFF.expected.length);
      MIXED_DIFF.expected.forEach((exp, i) => {
        assert.strictEqual(result[i].relativePath, exp.relativePath);
        assert.strictEqual(result[i].changeType, exp.changeType);
      });
    });
  });

  describe('edge cases', () => {
    it('returns no entries for empty output', () => {
      assert.strictEqual(parseGitDiffOutput('', WORKTREE, BRANCH, false).length, 0);
    });

    it('handles CRLF line endings', () => {
      const result = parseGitDiffOutput('A\tsrc/a.ts\r\nM\tsrc/b.ts\r\n', WORKTREE, BRANCH, false);
      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].relativePath, 'src/a.ts');
      assert.strictEqual(result[1].relativePath, 'src/b.ts');
    });

    it('skips rows with an unknown status letter', () => {
      const result = parseGitDiffOutput('X\tsrc/weird.ts\n', WORKTREE, BRANCH, false);
      assert.strictEqual(result.length, 0);
    });

    it('skips malformed rows with fewer than two fields', () => {
      const result = parseGitDiffOutput('justonefield\n', WORKTREE, BRANCH, false);
      assert.strictEqual(result.length, 0);
    });

    it('marks files as uncommitted when the flag is set', () => {
      const result = parseGitDiffOutput('M\tsrc/x.ts\n', WORKTREE, BRANCH, true);
      assert.strictEqual(result[0].uncommitted, true);
    });

    it('leaves uncommitted undefined when the flag is false', () => {
      const result = parseGitDiffOutput('M\tsrc/x.ts\n', WORKTREE, BRANCH, false);
      assert.strictEqual(result[0].uncommitted, undefined);
    });
  });
});
