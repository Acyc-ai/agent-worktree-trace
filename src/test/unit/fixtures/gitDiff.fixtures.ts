// Named git-diff fixtures for the fast unit tier.
//
// These model the raw `git diff --name-status` lines the extension parses.
// Of particular interest are the rename (R<score>) and copy (C<score>) rows
// introduced by the issue #2 fix: they carry a similarity score after the
// status letter plus TWO tab-separated paths (source and destination). The
// parser must classify these as `modified` and use the DESTINATION (new) path.
//
// Each fixture pairs a raw line (or block) with the expected parsed outcome so
// assertions stay declarative and easy to extend.

export interface ExpectedTrackedFile {
  relativePath: string;
  changeType: 'added' | 'modified' | 'deleted';
}

export interface GitDiffFixture {
  /** Human-readable description used as the test title. */
  name: string;
  /** Raw `git diff --name-status` output (without a trailing newline). */
  raw: string;
  /** Expected parsed files, in order. */
  expected: ExpectedTrackedFile[];
}

// --- Simple status fixtures (A / M / D) -----------------------------------

export const ADDED_FILE: GitDiffFixture = {
  name: 'added file (A)',
  raw: 'A\tsrc/newfile.ts',
  expected: [{ relativePath: 'src/newfile.ts', changeType: 'added' }],
};

export const MODIFIED_FILE: GitDiffFixture = {
  name: 'modified file (M)',
  raw: 'M\tsrc/existing.ts',
  expected: [{ relativePath: 'src/existing.ts', changeType: 'modified' }],
};

export const DELETED_FILE: GitDiffFixture = {
  name: 'deleted file (D)',
  raw: 'D\tsrc/removed.ts',
  expected: [{ relativePath: 'src/removed.ts', changeType: 'deleted' }],
};

// --- Rename / copy fixtures (issue #2 regression coverage) -----------------

/** R100: identical content moved -> classify as modified, keep destination. */
export const RENAME_EXACT: GitDiffFixture = {
  name: 'rename, 100% similarity (R100) -> destination path, modified',
  raw: 'R100\tsrc/old.ts\tsrc/new.ts',
  expected: [{ relativePath: 'src/new.ts', changeType: 'modified' }],
};

/** R96: renamed with light edits -> still destination path, modified. */
export const RENAME_PARTIAL: GitDiffFixture = {
  name: 'rename with edits (R96) -> destination path, modified',
  raw: 'R96\tsrc/oldName.ts\tsrc/newName.ts',
  expected: [{ relativePath: 'src/newName.ts', changeType: 'modified' }],
};

/** C75: copied file -> destination (copy) path, modified. */
export const COPY_PARTIAL: GitDiffFixture = {
  name: 'copy, 75% similarity (C75) -> destination path, modified',
  raw: 'C75\tsrc/old.ts\tsrc/copy.ts',
  expected: [{ relativePath: 'src/copy.ts', changeType: 'modified' }],
};

/** Rename whose source and destination paths both contain spaces. */
export const RENAME_WITH_SPACES: GitDiffFixture = {
  name: 'rename with spaces in path (R96) -> destination path, modified',
  raw: 'R96\told name.ts\tnew name.ts',
  expected: [{ relativePath: 'new name.ts', changeType: 'modified' }],
};

// --- Combined fixture ------------------------------------------------------

/** A realistic mixed diff exercising every status letter together. */
export const MIXED_DIFF: GitDiffFixture = {
  name: 'mixed A/M/D + rename/copy block',
  raw: [
    'A\tsrc/new.ts',
    'M\tsrc/changed.ts',
    'D\tsrc/removed.ts',
    'R100\tsrc/from.ts\tsrc/to.ts',
    'C50\tsrc/src.ts\tsrc/dest.ts',
  ].join('\n'),
  expected: [
    { relativePath: 'src/new.ts', changeType: 'added' },
    { relativePath: 'src/changed.ts', changeType: 'modified' },
    { relativePath: 'src/removed.ts', changeType: 'deleted' },
    { relativePath: 'src/to.ts', changeType: 'modified' },
    { relativePath: 'src/dest.ts', changeType: 'modified' },
  ],
};

/** Every rename/copy fixture, for table-driven iteration. */
export const RENAME_COPY_FIXTURES: GitDiffFixture[] = [
  RENAME_EXACT,
  RENAME_PARTIAL,
  COPY_PARTIAL,
  RENAME_WITH_SPACES,
];

/** All simple-status fixtures, for table-driven iteration. */
export const SIMPLE_STATUS_FIXTURES: GitDiffFixture[] = [
  ADDED_FILE,
  MODIFIED_FILE,
  DELETED_FILE,
];
