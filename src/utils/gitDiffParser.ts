// Git Diff Parser Utilities


import { TrackedFile } from '../types';

/**
 * Parse git diff output and convert to TrackedFile entries
 */
export function parseGitDiffOutput(
  output: string,
  worktreeName: string,
  branch: string,
  uncommitted: boolean
): TrackedFile[] {
  const files: TrackedFile[] = [];
  const lines = output.trim().split(/\r?\n/).filter(line => line.length > 0);

  for (const line of lines) {
    // git diff --name-status emits tab-separated fields:
    //   "A<tab>file", "M<tab>file", "D<tab>file"
    //   "R<score><tab>old<tab>new", "C<score><tab>old<tab>new"
    // Renames/copies carry a similarity score after the status letter and two
    // paths (source and destination). Split on tabs and inspect the status so
    // these rows are not silently dropped.
    const fields = line.split('\t');
    if (fields.length < 2) {
      continue;
    }

    const statusLetter = fields[0].charAt(0);
    let changeType: 'added' | 'modified' | 'deleted';
    let filePath: string;

    switch (statusLetter) {
      case 'A':
        changeType = 'added';
        filePath = fields[1];
        break;
      case 'D':
        changeType = 'deleted';
        filePath = fields[1];
        break;
      case 'R':
      case 'C':
        // Rename/copy: use the destination (new) path when present.
        changeType = 'modified';
        filePath = fields.length >= 3 ? fields[2] : fields[1];
        break;
      case 'M':
        changeType = 'modified';
        filePath = fields[1];
        break;
      default:
        // Unknown status; skip rather than guess.
        continue;
    }

    files.push({
      relativePath: filePath,
      worktreeName,
      branch,
      changeType,
      uncommitted: uncommitted || undefined
    });
  }

  return files;
}
