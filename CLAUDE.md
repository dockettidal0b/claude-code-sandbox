# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the Claude Code Sandbox project - a CLI tool that runs Claude Code instances inside isolated Docker containers with automatic git integration. The tool creates safe sandboxed environments where Claude can execute commands and make code changes without affecting the host system.

## Common Development Commands

### Build and Development

- `npm run build` - Compile TypeScript to JavaScript (output in `dist/`)
- `npm run dev` - Watch mode for TypeScript compilation
- `npm start` - Run the CLI tool

### Testing and Quality

- `npm run lint` - Run ESLint on TypeScript files
- `npm test` - Run Jest tests
- `npm run test:watch` - Run tests in watch mode
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:coverage` - Run tests with coverage report

### Container Management

- `npm run purge-containers` - Remove all Claude Sandbox containers and images

## Architecture

### Core Components

1. **Main Orchestrator** (`src/index.ts`)
   - `ClaudeSandbox` class that coordinates all components
   - Manages the entire lifecycle of a sandbox session
   - Handles repository copying and git branch creation

2. **CLI Entry Point** (`src/cli.ts`)
   - Command-line interface using Commander.js
   - Handles options parsing and main flow orchestration

3. **Container Management** (`src/container.ts`)
   - Docker container lifecycle management using dockerode
   - Builds images, creates containers, handles streams
   - **Important**: Files are copied into containers (not mounted) for true isolation

4. **Web Terminal Interface** (`src/web-server.ts`)
   - Provides browser-based terminal UI (default interaction method)
   - WebSocket communication for real-time terminal output
   - Xterm.js integration for terminal rendering

5. **Git Integration** (`src/git-monitor.ts`)
   - Monitors git repository for new commits
   - Uses simple-git for operations
   - Provides real-time notifications of Claude's commits

6. **Credential Discovery** (`src/credentials.ts`)
   - Automatically discovers Claude API keys (Anthropic, AWS Bedrock, Google Vertex)
   - Discovers GitHub credentials (CLI auth, SSH keys)
   - Priority: Environment vars → macOS Keychain → Config files → GitHub CLI

7. **Configuration** (`src/config.ts`)
   - Loads and validates configuration from `claude-sandbox.config.json`
   - Manages Docker settings, environment variables, and Claude parameters

8. **UI Components** (`src/ui.ts`)
   - Interactive prompts using inquirer
   - Diff display with syntax highlighting
   - Commit review interface

### Key Design Decisions

- Claude runs with `--dangerously-skip-permissions` flag (safe within container isolation)
- Git wrapper prevents branch switching to protect main branch
- All credentials are mounted read-only
- Each session creates a new branch (`claude/[timestamp]`)
- Real-time commit monitoring with interactive review

## Configuration

The tool looks for `claude-sandbox.config.json` in the working directory. Key options:

- `dockerImage`: Base image name (default: "claude-code-sandbox:latest")
- `dockerfile`: Path to custom Dockerfile
- `environment`: Additional environment variables
- `mounts`: Additional volume mounts (array of {source, target, readonly})
- `setupCommands`: Commands to run after container setup (e.g., ["npm install"])
- `autoPush`/`autoCreatePR`: Git workflow settings
- `defaultShell`: Choose between "claude" or "bash" (default: "claude")
- `envFile`: Path to .env file for environment variables
- `maxThinkingTokens`: Maximum tokens for Claude's thinking (default: 100000)
- `bashTimeout`: Timeout for bash commands in milliseconds (default: 600000)

## Development Workflow

Start a new sandbox:

```
claude-sandbox start
```

Kill all running sandbox containers:

```
claude-sandbox purge -y
```
