# Claude Orchestrator - Design Document

## Overview

Claude Orchestrator is a desktop application for managing multiple Claude Code CLI instances. It provides a graphical interface for creating, monitoring, and coordinating Claude instances at scale, from a single instance up to thousands.

## Core Goals

1. **Wrap Claude Code CLI** - Provide a GUI around the Claude Code command-line interface
2. **Scale to 10,000+ instances** - Support massive parallelization for large projects
3. **Enable instance coordination** - Allow Claude instances to communicate and control each other
4. **Visual feedback** - Real-time status indicators, context usage, and output streaming
5. **Cross-platform** - Mac priority, Windows/Linux support planned

---

## Architecture

### Technology Stack

- **Electron** - Desktop application framework
- **Angular 19+** - Frontend framework (zoneless, signals-based)
- **TypeScript** - Full-stack type safety
- **Claude Code CLI** - Backend AI engine (spawned as child processes)

### Process Model

```
┌─────────────────────────────────────────────────────────┐
│                    Main Process                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │   Window    │  │  Instance   │  │    IPC      │     │
│  │   Manager   │  │   Manager   │  │   Handler   │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                          │                              │
│         ┌────────────────┼────────────────┐            │
│         ▼                ▼                ▼            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │
│  │ CLI Adapter │  │ CLI Adapter │  │ CLI Adapter │    │
│  │ (claude)    │  │ (claude)    │  │ (claude)    │    │
│  └─────────────┘  └─────────────┘  └─────────────┘    │
└─────────────────────────────────────────────────────────┘
                          │
                    (IPC Bridge)
                          │
┌─────────────────────────────────────────────────────────┐
│                  Renderer Process                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  Instance   │  │   Output    │  │    Input    │     │
│  │    Store    │  │   Stream    │  │    Panel    │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
└─────────────────────────────────────────────────────────┘
```

### Hierarchical Supervisor Tree (Planned)

Inspired by Erlang OTP, instances can be organized in a supervision hierarchy:

```
                    ┌─────────────┐
                    │   Root      │
                    │ Supervisor  │
                    └──────┬──────┘
           ┌───────────────┼───────────────┐
           ▼               ▼               ▼
    ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
    │  Project A  │ │  Project B  │ │  Project C  │
    │ Supervisor  │ │ Supervisor  │ │ Supervisor  │
    └──────┬──────┘ └──────┬──────┘ └──────┬──────┘
           │               │               │
     ┌─────┼─────┐   ┌─────┼─────┐   ┌─────┼─────┐
     ▼     ▼     ▼   ▼     ▼     ▼   ▼     ▼     ▼
   [Worker instances for each project]
```

---

## Features

### Phase 1: Core Functionality (Current)

#### Instance Management
- [x] Create new Claude instances
- [x] Terminate instances
- [x] Restart instances
- [x] View instance list with filtering
- [x] Select and view instance details

#### Visual Feedback
- [x] Status indicators with color coding:
  - 🟢 **Green** - Idle (ready for input)
  - 🔵 **Blue** - Busy (processing)
  - 🟡 **Amber** - Waiting for user input
  - 🔴 **Red** - Error state
- [x] Context usage bar (tokens used / max tokens)
- [x] Real-time output streaming

#### Input/Output
- [x] Text input with Enter to send
- [x] File drag & drop support
- [x] Image paste support (Cmd+V)
- [x] Streaming JSON output parsing

#### Native App Experience
- [x] macOS traffic lights integration
- [x] Native window dragging
- [x] Dark theme optimized UI
- [x] Vibrancy effects (macOS)

### Phase 2: Hierarchical Instances (Planned)

#### Parent-Child Relationships
- [ ] Create child instances from parent
- [ ] Visual hierarchy in sidebar (tree view)
- [ ] Cascade termination (terminate parent = terminate children)
- [ ] Inherit working directory from parent

#### Supervisor Strategies
- [ ] **one-for-one** - Restart only the failed instance
- [ ] **one-for-all** - Restart all siblings if one fails
- [ ] **rest-for-one** - Restart failed instance and all started after it

### Phase 3: Cross-Instance Communication (Planned)

#### Token-Based Messaging
Instances can communicate via tokens with permission levels:

```typescript
interface CommunicationToken {
  id: string;
  sourceInstanceId: string;
  targetInstanceId: string;
  permissions: TokenPermission[];
  expiresAt: number | null;
}

type TokenPermission =
  | 'read'      // Can read target's output
  | 'write'     // Can send messages to target
  | 'control'   // Can restart/terminate target
  | 'spawn';    // Can create child instances
```

#### Message Types
- **Direct messages** - Instance A sends to Instance B
- **Broadcast** - Parent sends to all children
- **Pub/Sub** - Instances subscribe to topics

#### Use Cases
- Code review: Reviewer instance reads Writer instance output
- Test runner: Spawns child instances for parallel test execution
- Agent orchestration: Coordinator delegates tasks to specialists

### Phase 4: Scale & Performance (Planned)

#### Virtual Scrolling
- [x] CDK Virtual Scroll for instance list
- [ ] Virtualized output buffer (for very long conversations)

#### Batched Updates
- [x] 50ms batching interval for state updates
- [ ] Configurable batch intervals
- [ ] Priority updates bypass batching (errors, termination)

#### Resource Management
- [ ] Memory limits per instance
- [ ] CPU throttling for background instances
- [ ] Automatic instance hibernation
- [ ] Instance pooling for rapid spawning

### Phase 5: Advanced Features (Planned)

#### Session Persistence
- [ ] Save/restore sessions
- [ ] Export conversation history
- [ ] Resume sessions after restart

#### Templates & Presets
- [ ] Instance templates (pre-configured settings)
- [ ] Quick-start presets (code review, testing, documentation)
- [ ] Custom system prompts per instance

#### Collaboration (Nice to Have)
- [ ] Share instance view (read-only)
- [ ] Multi-user coordination
- [ ] Instance handoff between users

---

## UI Components

### Sidebar (Left Panel)
```
┌─────────────────────────┐
│  Claude Orchestrator    │
│  [+ New Instance]       │
├─────────────────────────┤
│  [Filter...] [Status ▼] │
├─────────────────────────┤
│  ● Instance 1      0%   │
│  ● Instance 2     45%   │
│  ○ Instance 3     12%   │
│  ◉ Instance 4     78%   │
├─────────────────────────┤
│  4 instances   32% ctx  │
└─────────────────────────┘
```

### Detail View (Right Panel)
```
┌─────────────────────────────────────────────┐
│  ● Instance 1                               │
│  Session: abc-123  •  ~/projects/myapp      │
│  [Restart] [Terminate] [+ Child]            │
├─────────────────────────────────────────────┤
│  ████████░░░░░░░░░░░░  45,000 / 200,000 (22%)│
├─────────────────────────────────────────────┤
│                                             │
│  YOU                              10:30:45  │
│  Help me refactor this function             │
│                                             │
│  CLAUDE                           10:30:48  │
│  I'll help you refactor that. Let me...     │
│                                             │
├─────────────────────────────────────────────┤
│  [Send a message to Claude...]        [↑]   │
│  Press Enter to send, Shift+Enter new line  │
└─────────────────────────────────────────────┘
```

---

## Data Flow

### Creating an Instance

```
User clicks "New Instance"
        │
        ▼
┌─────────────────┐
│ Renderer:       │
│ store.create()  │
└────────┬────────┘
         │ IPC: instance:create
         ▼
┌─────────────────┐
│ Main Process:   │
│ InstanceManager │
│ .createInstance │
└────────┬────────┘
         │ spawn child process
         ▼
┌─────────────────┐
│ Claude CLI      │
│ --print         │
│ --stream-json   │
└────────┬────────┘
         │ IPC: instance:created
         ▼
┌─────────────────┐
│ Renderer:       │
│ store updates   │
│ UI re-renders   │
└─────────────────┘
```

### Sending a Message

```
User types message, presses Enter
        │
        ▼
┌─────────────────┐
│ InputPanel:     │
│ emit(message)   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ InstanceDetail: │
│ store.sendInput │
└────────┬────────┘
         │ IPC: instance:send-input
         ▼
┌─────────────────┐
│ InstanceManager │
│ adapter.send()  │
└────────┬────────┘
         │ stdin (JSON)
         ▼
┌─────────────────┐
│ Claude CLI      │
│ processes input │
└────────┬────────┘
         │ stdout (NDJSON stream)
         ▼
┌─────────────────┐
│ CLIAdapter:     │
│ parse & emit    │
└────────┬────────┘
         │ IPC: instance:output
         ▼
┌─────────────────┐
│ Renderer:       │
│ store updates   │
│ OutputStream    │
│ re-renders      │
└─────────────────┘
```

---

## CLI Integration

### Command Format
```bash
claude \
  --print \
  --output-format stream-json \
  --input-format stream-json \
  --verbose \
  --session-id <uuid>
```

### Input Format (stdin)
```json
{"type":"user","message":{"role":"user","content":"Hello Claude"}}
```

### Output Format (stdout NDJSON)
```json
{"type":"system","subtype":"init","session_id":"...","tools":[...]}
{"type":"assistant","message":{"role":"assistant","content":[{"type":"text","text":"Hello!"}]}}
{"type":"result","subtype":"success","duration_ms":1234,"total_cost_usd":0.001}
```

---

## Configuration

### Default Limits
```typescript
const LIMITS = {
  MAX_INSTANCES: 10000,
  DEFAULT_MAX_CONTEXT_TOKENS: 200000,
  OUTPUT_BUFFER_MAX_SIZE: 1000,      // messages per instance
  OUTPUT_BATCH_INTERVAL_MS: 50,      // batching frequency
  INSTANCE_IDLE_TIMEOUT_MS: 3600000, // 1 hour
};
```

### Per-Instance Settings (Planned)
- Model selection (claude-sonnet-4-20250514, opus, haiku)
- Max tokens
- System prompt
- Allowed/disallowed tools
- Working directory

---

## Error Handling

### Instance Errors
- CLI spawn failure → Mark instance as error, show message
- CLI crash → Emit error event, offer restart
- API errors → Display in output stream with error styling

### Recovery Strategies
- Automatic restart with exponential backoff (planned)
- Manual restart via UI
- Session resume from last checkpoint (planned)

---

## Security Considerations

### Process Isolation
- Each Claude instance runs in its own process
- Sandboxed preload script for IPC
- Context isolation enabled

### Permissions
- Instances cannot access each other without explicit tokens
- Working directory scoped per instance
- No direct filesystem access from renderer

---

## Future Considerations

### Multi-Model Support
- Switch between Claude models mid-conversation
- Cost optimization (use Haiku for simple tasks)

### Plugin System
- Custom output renderers
- Integration with external tools
- Workflow automation

### Analytics
- Token usage tracking
- Cost estimation
- Performance metrics

---

## Development

### Project Structure
```
claude-orchestrator/
├── src/
│   ├── main/           # Electron main process
│   │   ├── cli/        # Claude CLI integration
│   │   ├── instance/   # Instance management
│   │   ├── ipc/        # IPC handlers
│   │   └── index.ts    # Entry point
│   ├── preload/        # Context bridge
│   ├── renderer/       # Angular app
│   │   └── app/
│   │       ├── core/   # Services, state
│   │       └── features/
│   └── shared/         # Shared types, constants
├── dist/               # Compiled output
└── package.json
```

### Scripts
```bash
npm start          # Development mode
npm run build      # Production build
npm run build:main # Build main process only
```

---

## Version History

- **v0.1.0** (Current) - Core functionality, single-instance management
- **v0.2.0** (Planned) - Hierarchical instances, parent-child relationships
- **v0.3.0** (Planned) - Cross-instance communication
- **v0.4.0** (Planned) - Scale optimizations, resource management
- **v1.0.0** (Planned) - Production ready, full feature set
