import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import Mocha from 'mocha';
import { glob } from 'glob';

// File for capturing test output (read by runTest.ts)
const TEST_OUTPUT_FILE = path.join(os.tmpdir(), 'awt-test-results.txt');

export async function run(): Promise<void> {
  // Create write stream for test output
  const outputStream = fs.createWriteStream(TEST_OUTPUT_FILE);

  // Create the mocha test with output going to file
  const mocha = new Mocha({
    ui: 'tdd',
    color: true,
    timeout: 10000,
    reporter: 'spec',
    reporterOptions: {
      output: TEST_OUTPUT_FILE
    }
  });

  // Redirect Mocha's output to our file
  mocha.reporter('spec', { output: outputStream });

  const testsRoot = path.resolve(__dirname, '.');

  // Find all test files
  const files = await glob('**/*.test.js', { cwd: testsRoot });

  // Add files to the test suite
  files.forEach(f => {
    const filePath = path.resolve(testsRoot, f);
    mocha.addFile(filePath);
  });

  // Run the mocha test
  return new Promise((resolve, reject) => {
    try {
      const runner = mocha.run(failures => {
        outputStream.end();
        if (failures > 0) {
          reject(new Error(`${failures} tests failed.`));
        } else {
          resolve();
        }
      });

      // Write test output to file stream
      runner.on('start', () => outputStream.write('\n'));
      runner.on('pass', (test: Mocha.Test) => outputStream.write(`  ✔ ${test.title}\n`));
      runner.on('fail', (test: Mocha.Test, err: Error) => outputStream.write(`  ✖ ${test.title}: ${err.message}\n`));
      runner.on('suite', (suite: Mocha.Suite) => {
        if (suite.title) outputStream.write(`\n  ${suite.title}\n`);
      });
      runner.on('end', () => {
        const stats = runner.stats;
        outputStream.write(`\n  ${stats?.passes} passing (${stats?.duration}ms)\n`);
        if (stats?.failures) outputStream.write(`  ${stats.failures} failing\n`);
      });
    } catch (err) {
      outputStream.end();
      reject(err);
    }
  });
}
