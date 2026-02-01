# Agent Worktree Trace - Test Plan

## Overview

Test strategy for the Agent Worktree Trace VS Code extension.

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- --grep "WorktreeDiscovery"
```

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
