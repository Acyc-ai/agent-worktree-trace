import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { runTests } from '@vscode/test-electron';

// File where test suite writes results (avoids VS Code's noisy verbose output)
const TEST_OUTPUT_FILE = path.join(os.tmpdir(), 'awt-test-results.txt');

async function main() {
  let exitCode = 0;

  try {
    // The folder containing the Extension Manifest package.json
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');

    // The path to the extension test script
    const extensionTestsPath = path.resolve(__dirname, './suite/index');

    // Use a shorter path for user data to avoid IPC socket path length issues
    const userDataDir = path.join(os.tmpdir(), 'awt-test');

    // Clean up old test output
    if (fs.existsSync(TEST_OUTPUT_FILE)) {
      fs.unlinkSync(TEST_OUTPUT_FILE);
    }

    // Run tests without --verbose to avoid leaking paths/config in output
    // Test results are written to a file by the test suite
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--user-data-dir', userDataDir,
        '--disable-extensions',
        '--disable-telemetry'
      ]
    });
  } catch (err) {
    exitCode = 1;
  }

  // Display test results from file (clean output without VS Code noise)
  if (fs.existsSync(TEST_OUTPUT_FILE)) {
    const results = fs.readFileSync(TEST_OUTPUT_FILE, 'utf-8');
    console.log(results);
  } else {
    console.error('Test output file not found - tests may not have run');
    exitCode = 1;
  }

  process.exit(exitCode);
}

main();
