# Agent Worktree Trace

[![Tests](https://github.com/Acyc-ai/agent-worktree-trace/actions/workflows/test.yml/badge.svg)](https://github.com/Acyc-ai/agent-worktree-trace/actions/workflows/test.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-blue.svg)](https://code.visualstudio.com/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue.svg)](https://www.typescriptlang.org/)

<p align="center" >
  <span style="font-style: italic; margin-bottom: 1.25rem;">Open VS Code. Badges appear as your agents work.</span>
  <br /><br />
  <span>Tracks and highlights files changed in local git worktrees (by AI Agents)</span>
  <br />
  <span>For VSCode</span>
</p>

&nbsp;

- Track agent activity across multiple parallel worktrees (live)
- Identify potential merge conflicts before they happen
- See local changes that might conflict with agent work


## Install

Install through VS Code extensions. Search for `Agent Worktree Trace`

You can also download and install the extension .vsix from [Acyc.ai](https://acyc.ai).

#### Requirements

- Git repository with worktree support
- VS Code 1.87.0 or later (Feb 2024)
- Works with any agents (or humans) that use worktrees

## Usage

_When you have multiple AI agents working in parallel locally using git worktrees, this extension shows you which files they've changed - directly in the VS Code's File Explorer._

### File Decorations

Files changed by agents get a badge in the VSCode Explorer:

| Badge | Meaning                                                         |
| ----- | --------------------------------------------------------------- |
| `W`   | 1 agent has changed this file                                   |
| `W*`  | 1 agent has changed this file, but not committed                |
| `W3`  | More than one agent has changed this file (3 in this example)   |
| `!W`  | 1 or more agents, and _you_, have changed this file (watch out) |

## Commands

All commands are accessible by clicking 'Ⓐ wrktree trace' in the status bar or from the Command Palette (cmd+shift+p)

- **Agent Worktree Trace: Toggle Scanning** - Pause/turn off worktree scanning
- **Agent Worktree Trace: Refresh** - Manually trigger a worktree scan
- **Agent Worktree Trace: Clear All Tracked Files** - Reset all tracking data
- **Agent Worktree Trace: Show Tracking Status** - Display current tracking statistics
- **Agent Worktree Trace: List Files** - Output all worktree files traced

## Config

| Setting                       | Default           | Description                                                                                                                                                                                                                                                |
| ----------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Enable File Decorations**   | enabled           | Show decoration (W) on files chanded by agents in worktrees (Enable/disable extension scanning)                                                                                                                                                            |
| **Track Uncommitted Changes** | true              | Track uncommitted worktree changes (\*)                                                                                                                                                                                                                    |
| **Show Local Edit Warning**   | true              | Show warning (!) if a file has been edited locally"                                                                                                                                                                                                        |
| **Scan Interval Seconds**     | 60                | Seconds between worktree checks                                                                                                                                                                                                                            |
| **Worktree Pattern**          | worktree-agent-\* | Glob pattern to match agent worktree directory names (\* = match anything)                                                                                                                                                                                 |
| **Comparison Branch**         | current           | Branch to compare agent worktree changes against. Use 'current' (default) to compare against whatever branch is checked out. Use 'main' to compare against the detected main branch, or specify any branch name (e.g., 'master', 'develop', 'feat/foobar') |

## How It Works

1. The extension discovers git worktrees matching your configured pattern
2. For each worktree, it uses `git diff` against the branch configured (defaults to main/master)
3. Changed files are traced and decorated in the Explorer
4. Scans run periodically (configurable) and can be stopped/started from the status bar

## Usage with AI Agents

This extension is designed for workflows where AI agents work in parallel using git worktrees:

```bash
# Create agent worktrees
git worktree add ../worktree-agent-1 -b feature/task-1
git worktree add ../worktree-agent-2 -b feature/task-2
git worktree add ../worktree-agent-3 -b feature/task-3
```

The extension will automatically detect these worktrees and track file changes.

## Customizing the Worktree Pattern

If your agent worktrees follow a different naming convention than https://asyc.ai, update the pattern:

```json
{
  "agentWorktreeTrace.worktreePattern": "agent-work-*"
}
```

The pattern supports `*` (matches any characters) and `?` (matches single character).

## Development

### Test

`npm test`

### Build

`npm run compile`
`npm run package`

## License

MIT

## Author

https://acyc.ai × https://github.com/hcjmartin

> [!TIP]
> This is just one [Acyc.ai](https://acyc.ai) tool I use for parallel agent management.
>
> If you're interested in early-access multi-agent development workflows and kicking context-switching fog, register [here](https://acyc.ai) for more.
