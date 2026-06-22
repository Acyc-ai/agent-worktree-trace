# Agent Worktree Trace - Test Plan

## Overview

Test strategy for the Agent Worktree Trace VS Code extension.

There are two tiers:

- **Unit tier** (`src/test/unit/*.test.ts`) — fast, plain-Mocha (BDD) tests for the
  pure, host-independent utilities in `src/utils/`. These do **not** import
  `vscode` and run without the VS Code Electron host.
- **Integration tier** (`src/test/suite/*.test.ts`) — Mocha (TDD) tests that run
  inside the VS Code Electron host via `@vscode/test-electron`, exercising the
  services that depend on the `vscode` API.

## Running Tests

```bash
# Fast unit tier (no VS Code host)
npm run test:unit

# Unit tier with coverage (c8 -> coverage/)
npm run coverage:unit

# Full integration tier (launches VS Code)
npm test

# Run a specific integration test file
npm test -- --grep "WorktreeDiscovery"
```

The unit tier compiles with the existing `tsconfig.test.json`
(`npm run compile:tests`) and Mocha runs the emitted `dist/test/unit/**/*.test.js`.
Fixtures for git-diff rename/copy cases live in
`src/test/unit/fixtures/gitDiff.fixtures.ts`.

## Test Principles

1. **Simplicity**: Each test covers one specific behavior
2. **Readability**: Test names describe expected behavior
3. **Independence**: Tests don't depend on each other
4. **No external dependencies**: Ideally

## Adding New Tests

1. Identify the behavior to test
2. Create a focused test with clear name
3. Use existing mocks where possible
4. Keep assertions specific and minimal
