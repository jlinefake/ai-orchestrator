# AI Orchestrator - Development Status

## Overview

A desktop application for managing multiple AI CLI instances (Claude, Gemini, OpenAI) with hierarchical supervision, cross-instance communication, and a scalable UI supporting 10,000+ instances.

## Current Status: Phase 2 Complete, Phase 3 In Progress

The foundational architecture is in place with hierarchical supervision implemented.

### What's Built

```
src/
├── main/                              # Electron Main Process
│   ├── index.ts                       # App entry point, lifecycle
│   ├── window-manager.ts              # Window creation, IPC to renderer
│   ├── agents/                        # Agent management system
│   ├── api/                           # API handlers and routes
│   ├── browser-automation/            # Browser automation features
│   ├── cli/
│   │   ├── adapters/                  # CLI adapters (Claude, Copilot)
│   │   └── ndjson-parser.ts           # NDJSON stream parsing
│   ├── commands/                      # Command execution system
│   ├── communication/                 # Cross-instance communication
│   ├── context/                       # Context management
│   ├── core/
│   │   ├── config/                    # Configuration management
│   │   └── system/                    # Health, stats, cost tracking
│   ├── history/                       # History tracking
│   ├── hooks/                         # Hook system (pre/post exec)
│   ├── indexing/                      # Code indexing and search
│   ├── instance/                      # Instance management (lifecycle, state)
│   ├── ipc/                           # IPC handlers for all features
│   ├── learning/                      # ML/learning systems (GRPO, A/B testing)
│   ├── logging/                       # Structured logging system
│   ├── mcp/                           # Model Context Protocol integration
│   ├── memory/                        # Memory system (episodic, procedural)
│   ├── observation/                   # Observation/telemetry
│   ├── orchestration/                 # Multi-instance orchestration
│   ├── persistence/                   # Data persistence (RLM database)
│   ├── plugins/                       # Plugin system
│   ├── process/                       # Supervisor tree, circuit breaker
│   ├── providers/                     # Provider plugins (Claude, Codex)
│   ├── remote/                        # Remote execution
│   ├── repo-jobs/                     # Repository job management
│   ├── rlm/                           # Reinforcement Learning from Memory
│   ├── routing/                       # Message routing
│   ├── security/                      # Secret detection, redaction
│   ├── session/                       # Session continuity
│   ├── skills/                        # Extensible skills framework
│   ├── tasks/                         # Background tasks, todo management
│   ├── testing/                       # Test utilities
│   ├── tools/                         # External tools integration
│   ├── util/                          # Utilities
│   ├── vcs/                           # Version control integration
│   ├── workflows/                     # Workflow automation
│   └── workspace/                     # Worktree management
│
├── renderer/                          # Angular 21 Application (Zoneless)
│   ├── app/
│   │   ├── app.component.ts           # Root component
│   │   ├── app.config.ts              # Zoneless change detection
│   │   ├── core/
│   │   │   ├── state/                 # Signal-based stores
│   │   │   │   ├── instance/          # Instance state management
│   │   │   │   └── verification/      # Verification state management
│   │   │   └── services/
│   │   │       └── ipc/               # Feature-specific IPC services
│   │   └── features/
│   │       ├── agents/                # Agent management UI
│   │       ├── archive/               # Archive management
│   │       ├── codebase/              # Codebase browser
│   │       ├── commands/              # Command UI
│   │       ├── communication/         # Cross-instance communication UI
│   │       ├── context/               # Context management UI
│   │       ├── cost/                  # Cost tracking
│   │       ├── dashboard/             # Main layout
│   │       ├── debate/                # Debate feature
│   │       ├── editor/                # Editor integration
│   │       ├── file-drop/             # File handling
│   │       ├── file-explorer/         # File browser
│   │       ├── history/               # History viewer
│   │       ├── hooks/                 # Hooks management
│   │       ├── instance-detail/       # Instance view
│   │       ├── instance-list/         # Instance list
│   │       ├── logs/                  # Log viewer
│   │       ├── lsp/                   # LSP integration
│   │       ├── mcp/                   # MCP management
│   │       ├── memory/                # Memory management
│   │       ├── models/                # Model configuration
│   │       ├── multi-edit/            # Multi-file editing
│   │       ├── observations/          # Observation dashboard
│   │       ├── plan/                  # Plan management
│   │       ├── plugins/               # Plugin management
│   │       ├── providers/             # Provider management
│   │       ├── remote-access/         # Remote access UI
│   │       ├── remote-config/         # Remote configuration
│   │       ├── replay/                # Session replay
│   │       ├── review/                # Code review
│   │       ├── rlm/                   # RLM analytics UI
│   │       ├── routing/               # Routing management
│   │       ├── security/              # Security settings
│   │       ├── semantic-search/       # Semantic search UI
│   │       ├── settings/              # Settings panels
│   │       ├── skills/                # Skills management
│   │       ├── snapshots/             # Snapshot management
│   │       ├── specialists/           # Specialist agents
│   │       ├── stats/                 # Statistics dashboard
│   │       ├── supervision/           # Supervision tree UI
│   │       ├── tasks/                 # Task management
│   │       ├── thinking/              # Thinking visualization
│   │       ├── training/              # Training dashboard
│   │       ├── vcs/                   # Version control UI
│   │       ├── verification/          # Multi-agent verification
│   │       ├── workflow/              # Workflow management
│   │       └── worktree/              # Worktree management
│   └── styles.scss
│
├── shared/                            # Shared types and utils
│   ├── types/                         # TypeScript interfaces
│   ├── constants/                     # System constants
│   └── utils/                         # Utility functions
│
└── preload/
    └── preload.ts                     # Context bridge for IPC
```

### Key Features Implemented

| Feature | Status | Notes |
|---------|--------|-------|
| Electron + Angular setup | Done | Zoneless Angular 21 |
| CLI adapter with NDJSON streaming | Done | Real-time output parsing |
| Instance Manager | Done | Create, terminate, restart |
| Signal-based state store | Done | 50ms batched updates |
| Virtual scroll list | Done | Angular CDK, ready for 10k+ |
| Status color indicators | Done | Idle/busy/waiting/error |
| Context usage bar | Done | Visual token usage |
| Output stream display | Done | Auto-scroll, message types |
| Input panel | Done | Enter to send, Shift+Enter newline |
| File drag & drop | Done | Drop zone component |
| Image paste | Done | Clipboard image support |
| Dark/light theme | Done | CSS variables, system preference |
| macOS title bar | Done | Traffic light positioning |
| Supervisor tree | Done | Erlang OTP-inspired hierarchy |
| Circuit breaker | Done | Restart rate limiting |
| Cross-instance communication | Done | Token-based messaging |
| Multi-agent verification | Done | Semantic clustering |
| Debate system | Done | Multi-round agent debates |
| Skills system | Done | Progressive skill loading |
| Code indexing & search | Done | Semantic search |
| Remote access | Done | Remote observer server |
| Plugin system | Done | Extensible plugin framework |
| Workflow automation | Done | Multi-step workflows |

---

## Running the App

### Prerequisites
- Node.js 20+
- npm 10+
- Claude Code CLI installed (`claude` command available)

### Commands

```bash
# Install dependencies
npm install

# Development (builds main, starts Angular + Electron)
npm run dev

# Build main process only (useful for quick testing)
npm run build:main

# Build everything for production
npm run build

# Package for macOS (unsigned)
npm run build && npm run electron:build -- --mac --config.mac.identity=null

# Run tests
npm run test

# Run linting
npm run lint

# TypeScript compilation check
npx tsc --noEmit
```

### Troubleshooting

**"Cannot find module dist/main/index.js"**
- Run `npm run build:main` first, then `npm run dev`

**Port conflicts**
- Dev server uses port 4567 by default (configured in package.json start script)

---

## Architecture Decisions

### Why Zoneless Angular?
- Better performance for high-frequency updates
- Explicit change detection via signals
- No Zone.js overhead

### Why Signals over NgRx?
- Simpler for this use case
- Native Angular feature
- Less boilerplate
- Perfect for computed/derived state

### Why 50ms Batching?
- Balances responsiveness vs CPU usage
- 20 updates/second is smooth enough
- Prevents UI thrashing from rapid CLI output

### Why Hierarchical Supervision?
- Erlang/OTP proven pattern
- Scales to 10,000+ with 2-3 tree levels
- Natural fault isolation
- Easy to implement restart strategies

---

## Contact

Built with Claude Code by James.
