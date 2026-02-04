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
    // Format: "M<tab>filename" or "A<tab>filename" or "D<tab>filename"
    const match = line.match(/^([AMDRC])\t(.+)$/);
    if (match) {
      const [, status, filePath] = match;
      let changeType: 'added' | 'modified' | 'deleted';

      switch (status) {
        case 'A':
          changeType = 'added';
          break;
        case 'D':
          changeType = 'deleted';
          break;
        case 'M':
        case 'R':
        case 'C':
        default:
          changeType = 'modified';
          break;
      }

      files.push({
        relativePath: filePath,
        worktreeName,
        branch,
        changeType,
        uncommitted: uncommitted || undefined
      });
    }
  }

  return files;
}
