# AI Orchestrator - Development Status

## Overview

A desktop application for managing multiple AI CLI instances (Claude, Gemini, OpenAI) with hierarchical supervision, cross-instance communication, and a scalable UI supporting 10,000+ instances.

## Current Status: Phase 1 MVP Complete ✅

The foundational architecture is in place and compiles successfully.

### What's Built

```
src/
├── main/                              # Electron Main Process
│   ├── index.ts                       # App entry point, lifecycle
│   ├── window-manager.ts              # Window creation, IPC to renderer
│   ├── cli/
│   │   ├── adapters/                  # CLI adapters (Claude, Copilot)
│   │   └── ndjson-parser.ts           # NDJSON stream parsing
│   ├── core/
│   │   ├── config/                    # Configuration management
│   │   └── system/                    # Health, stats, cost tracking
│   ├── hooks/                         # Hook system (pre/post exec)
│   ├── instance/                      # Instance management (lifecycle, state)
│   ├── ipc/                           # IPC handlers for all features
│   ├── learning/                      # ML/learning systems (GRPO, A/B testing)
│   ├── memory/                        # Memory system (episodic, procedural)
│   ├── orchestration/                 # Multi-instance orchestration
│   ├── persistence/                   # Data persistence (RLM database)
│   ├── providers/                     # Provider plugins (Claude, Codex)
│   ├── rlm/                           # Reinforcement Learning from Memory
│   ├── security/                      # Secret detection, redaction
│   ├── session/                       # Session continuity
│   ├── tasks/                         # Background tasks, todo management
│   └── workspace/                     # Worktree management
│
├── renderer/                          # Angular 19 Application (Zoneless)
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
│   │       ├── dashboard/             # Main layout
│   │       ├── debate/                # Debate feature
│   │       ├── file-drop/             # File handling
│   │       ├── file-explorer/         # File browser
│   │       ├── instance-detail/       # Instance view
│   │       ├── instance-list/         # Instance list
│   │       ├── providers/             # Provider management
│   │       ├── rlm/                   # RLM analytics UI
│   │       ├── settings/              # Settings panels
│   │       ├── training/              # Training dashboard
│   │       └── verification/          # Multi-agent verification
│   │           ├── config/            # Agent config panels
│   │           ├── dashboard/         # Verification dashboard
│   │           ├── execution/         # Monitoring, selectors
│   │           ├── results/           # Results, export, heatmap
│   │           └── shared/            # Shared verification components
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
| Electron + Angular setup | ✅ | Zoneless Angular 19 |
| CLI adapter with NDJSON streaming | ✅ | Real-time output parsing |
| Instance Manager | ✅ | Create, terminate, restart |
| Signal-based state store | ✅ | 50ms batched updates |
| Virtual scroll list | ✅ | Angular CDK, ready for 10k+ |
| Status color indicators | ✅ | Idle/busy/waiting/error |
| Context usage bar | ✅ | Visual token usage |
| Output stream display | ✅ | Auto-scroll, message types |
| Input panel | ✅ | Enter to send, Shift+Enter newline |
| File drag & drop | ✅ | Drop zone component |
| Image paste | ✅ | Clipboard image support |
| Dark/light theme | ✅ | CSS variables, system preference |
| macOS title bar | ✅ | Traffic light positioning |

---

## Running the App

### Prerequisites
- Node.js 22+
- npm 10+
- Claude Code CLI installed (`claude` command available)

### Commands

```bash
# Install dependencies
npm install

# Development (builds main, starts Angular + Electron)
npm start

# If port 4200 is busy, use alternate port
npm run start:fresh

# Build main process only (useful for quick testing)
npm run build:main

# Build everything for production
npm run build

# Package for distribution
npm run electron:build
```

### Troubleshooting

**"Cannot find module dist/main/index.js"**
- Run `npm run build:main` first, then `npm start`

**"Port 4200 is already in use"**
- Use `npm run start:fresh` (uses port 4201)
- Or kill the process: `lsof -ti:4200 | xargs kill -9`

---

## What's Next

### Phase 2: Multi-Instance with Hierarchy (3-4 weeks)

**Files to create:**
```
src/main/process/
├── supervisor-tree.ts      # Root supervisor, auto-expansion
├── supervisor-node.ts      # Individual supervisor node
└── circuit-breaker.ts      # Resource protection, restart limits
```

**Tasks:**
- [ ] Implement supervisor tree with 8-16 children per node
- [ ] Add `one_for_one` restart strategy
- [ ] Circuit breaker (max 5 restarts per minute)
- [ ] Parent-child instance relationships in UI
- [ ] Hierarchy tree visualization component
- [ ] Instance grouping/filtering by parent

### Phase 3: Cross-Instance Communication (2-3 weeks)

**Files to create:**
```
src/main/communication/
├── token-broker.ts         # Generate, validate, expire tokens
├── message-router.ts       # Route messages between instances
└── stream-bridge.ts        # Pipe output to another instance's input
```

**Tasks:**
- [ ] Token-based permission system (read/write/control)
- [ ] Instance A can send message to Instance B
- [ ] Instance A can subscribe to Instance B's output
- [ ] Stream chaining (A's output → B's input)
- [ ] Control commands (restart/terminate via token)
- [ ] UI for managing tokens and connections

### Phase 4: Scale Testing & Optimization (2-3 weeks)

**Files to create:**
```
workers/
├── cli-worker.ts           # CLI management in worker thread
├── parser-worker.ts        # NDJSON parsing offloaded
└── metrics-worker.ts       # Metrics collection
```

**Tasks:**
- [ ] Worker thread pool for CLI management
- [ ] Stress test with 1,000 instances
- [ ] Profile and optimize memory usage
- [ ] Tune batching intervals
- [ ] Add resource monitoring dashboard

### Phase 5: Polish & Cross-Platform (2-3 weeks)

**Tasks:**
- [ ] Keyboard shortcuts (Cmd+N new, Cmd+W close, etc.)
- [ ] Settings panel (theme, default working dir, etc.)
- [ ] Session persistence (restore instances on restart)
- [ ] Linux build (AppImage, deb)
- [ ] Windows build (NSIS installer)
- [ ] App icons and branding

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

## File Counts

| Category | Files |
|----------|-------|
| Main Process | 6 |
| Renderer (Angular) | 16 |
| Shared Types/Utils | 8 |
| Preload | 1 |
| Config | 4 |
| **Total Source** | **35** |

---

## Contact

Built with Claude Code by James.
