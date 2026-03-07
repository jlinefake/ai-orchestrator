# AI Orchestrator - Design Document

## Overview

AI Orchestrator is a high-performance desktop environment designed to manage, monitor, and coordinate multiple AI CLI instances (Claude, Gemini, OpenAI, and more). It bridges the gap between command-line power and graphical usability, scaling from individual agent interactions to massive, orchestrated swarms of thousands of concurrent instances.

## Core Goals

1. **Seamless CLI Integration** - Encapsulate the Claude Code CLI within a robust, interactive GUI.
2. **Massive Scalability** - Support the parallel execution of 10,000+ instances for enterprise-scale projects.
3. **Agent Coordination** - Enable instances to communicate, delegate tasks, and form complex supervisor hierarchies.
4. **Rich Visual Telemetry** - Provide real-time status indicators, token usage metrics, and streaming output visualization.
5. **Cross-Platform Compatibility** - Prioritize macOS native integration, with planned support for Windows and Linux.

---

## Architecture

### Technology Stack

- **Electron** - Robust desktop application framework for cross-platform deployment.
- **Angular 21** - Modern, zoneless frontend framework utilizing signals for reactive performance.
- **TypeScript** - Ensuring full-stack type safety and shared interfaces between main and renderer processes.
- **Claude Code CLI** - The core AI engine, managed as spawned child processes for isolation and control.

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

### Hierarchical Supervisor Tree (Implemented)

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
- [x] **Lifecycle Control**: Create, terminate, and restart Claude instances.
- [x] **List View**: Sortable and filterable list of active instances.
- [x] **Detailed Inspection**: Deep dive into individual instance state and history.

#### Visual Feedback
- [x] **Status Indicators**: Color-coded states for quick health assessment:
  - 🟢 **Green** - Idle (Ready for input)
  - 🔵 **Blue** - Busy (Processing)
  - 🟡 **Amber** - Waiting (User input required)
  - 🔴 **Red** - Error (Process failure)
- [x] **Context Metrics**: Visual bar displaying token usage vs. limits.
- [x] **Output Streaming**: Low-latency rendering of CLI output.

#### Input/Output
- [x] **Interactive Console**: Text input with standard command history and execution.
- [x] **File Integration**: Drag & drop support for file context.
- [x] **Rich Media**: Clipboard support for images (Cmd+V).
- [x] **Structured Parsing**: Real-time parsing of JSON output streams.

#### Native App Experience
- [x] **macOS Integration**: Native traffic lights and window controls.
- [x] **Draggable Windows**: Native-feeling window management.
- [x] **Theming**: Optimized dark mode for prolonged usage.
- [x] **Visual Polish**: Platform-specific vibrancy effects (macOS).

### Phase 2: Hierarchical Instances (Implemented)

#### Parent-Child Relationships
- [x] **Spawn Control**: Capability to spawn child instances directly from a parent.
- [x] **Tree Visualization**: Hierarchical sidebar view representing instance lineage (IPC handlers ready).
- [x] **Cascade Management**: Configurable termination policies (terminate-children, orphan-children, reparent-to-root).
- [x] **Context Inheritance**: Option for children to inherit working directory, environment, YOLO mode, and agent settings.

#### Supervisor Strategies
- [x] **One-for-One**: Restart only the specific failed instance.
- [x] **One-for-All**: Restart the failed instance and all its siblings.
- [x] **Rest-for-One**: Restart the failed instance and any siblings started after it.

#### Phase 2 Implementation Details
- **New Files Created**:
  - `src/main/process/supervisor-tree.ts` - Root supervisor with auto-expansion for 10,000+ instances
  - `src/main/process/supervisor-node.ts` - Individual supervisor nodes with restart strategies
  - `src/main/process/circuit-breaker.ts` - Resource protection and restart rate limiting
  - `src/main/ipc/handlers/supervision-handlers.ts` - IPC handlers for supervision tree UI

- **Types Added** (in `supervision.types.ts`):
  - `TerminationPolicy`: 'terminate-children' | 'orphan-children' | 'reparent-to-root'
  - `ContextInheritanceConfig`: Working dir, env vars, YOLO mode, agent settings inheritance
  - `ChildSpawnConfig`: Configuration for spawning child instances
  - `InstanceHierarchy`: Hierarchical relationship tracking
  - `HierarchyTreeNode`: Tree view node for UI rendering

- **Instance Fields Added** (in `instance.types.ts`):
  - `depth`: Position in hierarchy (0 = root)
  - `workerNodeId`: Worker node ID in supervision tree
  - `terminationPolicy`: Cascade termination behavior
  - `contextInheritance`: What settings children inherit

### Phase 3: Cross-Instance Communication (Partially Implemented)

#### Token-Based Messaging
Instances utilize a capability-based security model to communicate:

```typescript
export interface CommunicationToken {
  token: string;
  targetInstanceId: string;
  permissions: ('read' | 'write' | 'control')[];
  expiresAt: number;
  createdBy: string;
}
```

#### Message Topologies
- **Direct**: Point-to-point communication (Instance A → Instance B).
- **Broadcast**: One-to-many communication (Parent → All Children).
- **Pub/Sub**: Topic-based event subscription model.

#### Use Cases
- **Code Review**: A 'Reviewer' instance monitors and critiques the output of a 'Writer' instance.
- **Test Runner**: A 'Coordinator' spawns ephemeral child instances for parallel test execution.
- **Swarm Orchestration**: A 'Supervisor' delegates specialized tasks to a pool of 'Worker' agents.

### Phase 4: Scale & Performance (Planned)

#### Virtualization
- [x] **List Virtualization**: CDK Virtual Scroll for handling thousands of list items.
- [ ] **Output Buffering**: Virtualized rendering for massive conversation histories.

#### Optimized State Management
- [x] **Batched Updates**: 50ms aggregation window for state changes to reduce render cycles.
- [ ] **Configurable Intervals**: Dynamic batching based on system load.
- [ ] **Priority Bypass**: Immediate processing for critical events (errors, termination).

#### Resource Governance
- [ ] **Memory Caps**: Hard limits per instance to prevent OOM.
- [ ] **CPU Throttling**: Background priority management for non-active instances.
- [ ] **Hibernation**: Automatic suspension of idle instances to swap.
- [ ] **Instance Pooling**: Pre-warmed pools for instant spawn times.

### Phase 5: Advanced Features (Planned)

#### Persistence & Continuity
- [ ] **Session State**: Full serialization and restoration of instance state.
- [ ] **Export**: JSON/Markdown export of conversation trees.
- [ ] **Crash Recovery**: Automatic session resumption post-failure.

#### Templating System
- [ ] **Blueprints**: Pre-configured instance setups (System Prompt + Tools + Env).
- [ ] **Quick-Start Library**: Built-in templates for common tasks (Review, Test, Doc).
- [ ] **Per-Instance Customization**: Overridable system prompts and toolsets.

#### Collaborative Features (Nice to Have)
- [ ] **Shared View**: Read-only mirroring of instance state.
- [ ] **Multi-User Sync**: Real-time coordination between multiple human operators.
- [ ] **Handoff Protocols**: Transferring instance ownership between users.

---

## UI Components

### Sidebar (Left Panel)
```
┌─────────────────────────┐
│  AI Orchestrator        │
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
// From src/shared/constants/limits.ts
const LIMITS = {
  MAX_CHILDREN_PER_NODE: 12,
  MAX_RESTARTS: 5,
  RESTART_WINDOW_MS: 60000,            // 1 minute
  OUTPUT_BUFFER_MAX_SIZE: 2000,        // messages per instance
  OUTPUT_BATCH_INTERVAL_MS: 50,        // batching frequency
  DEFAULT_MAX_CONTEXT_TOKENS: 200000,
  IPC_TIMEOUT_MS: 30000,
};
```

### Per-Instance Settings (Planned)
- **Model Selection**: Granular control (e.g., `claude-3-opus`, `claude-3-sonnet`).
- **Token Limits**: Configurable context windows.
- **System Prompts**: Custom behavioral instructions.
- **Tool Restrictions**: Allow/Deny lists for tool access.
- **Environment**: Scoped working directories and environment variables.

---

## Error Handling

### Failure Modes
- **Launch Failure**: If CLI fails to spawn, instance enters 'Error' state with accessible stderr logs.
- **Process Crash**: Unexpected termination triggers an 'Error' event with automatic recovery options.
- **API Errors**: Rate limits or API failures are rendered distinctly in the output stream.

### Recovery Strategies
- **Auto-Restart**: Exponential backoff strategy for transient failures (Planned).
- **Manual Intervention**: UI controls for immediate restart or termination.
- **State Restoration**: Resume from last known good checkpoint (Planned).

---

## Security Considerations

### Isolation & Sandboxing
- **Process Isolation**: Each Claude instance runs in a dedicated child process.
- **Context Bridge**: Renderer communicates with Main process exclusively via secure IPC.
- **Preload Hardening**: Context isolation enabled, preventing direct Node.js access in the UI.

### Access Control
- **Tokenized Communication**: Instances require explicit capabilities to interact.
- **Filesystem Scoping**: Working directories are strictly enforced per instance.
- **No Direct IO**: Renderer cannot access filesystem directly; all operations go through validated Main process handlers.

---

## Future Considerations

### Extended Capabilities
- **Model Switching**: Dynamic hot-swapping of models during a conversation.
- **Cost Optimization**: Automated routing of simple tasks to lighter models (e.g., Haiku).

### Ecosystem
- **Plugin Architecture**: API for custom renderers and third-party tool integrations.
- **Workflow Automation**: Scriptable sequences of multi-agent interactions.

### Intelligence
- **Analytics Dashboard**: Comprehensive view of token usage, costs, and performance metrics.
- **Self-Optimization**: System suggestions for model selection based on task complexity.

---

## Development

### Project Structure
```
claude-orchestrator/
├── src/
│   ├── main/              # Electron Main Process (Node.js)
│   │   ├── agents/        # Agent management
│   │   ├── cli/           # Claude CLI Adapter Layer
│   │   ├── communication/ # Cross-instance communication
│   │   ├── core/          # Config, health, cost tracking
│   │   ├── indexing/      # Code indexing and search
│   │   ├── instance/      # Instance State Management
│   │   ├── ipc/           # IPC Event Handlers
│   │   ├── orchestration/ # Multi-agent coordination
│   │   ├── process/       # Supervisor tree, circuit breaker
│   │   ├── skills/        # Skills system
│   │   └── index.ts       # Application Entry Point
│   ├── preload/           # Secure Context Bridge
│   ├── renderer/          # Angular 21 Frontend
│   │   └── app/
│   │       ├── core/      # Services, Stores, Models
│   │       └── features/  # Feature Modules (47 feature dirs)
│   └── shared/            # Shared Interfaces & Types
├── dist/                  # Compilation Artifacts
└── package.json
```

### Scripts
```bash
npm run dev        # Launch in Development Mode
npm run build      # Compile for Production
npm run build:main # Recompile Main Process only
npm run test       # Run tests (Vitest)
npm run lint       # ESLint check (ng lint)
npx tsc --noEmit   # TypeScript compilation check

# Package for macOS (unsigned)
npm run build && npm run electron:build -- --mac --config.mac.identity=null
```

---

## Version History

- **v0.1.0** - Core functionality, single-instance management
- **v0.2.0** - Hierarchical instances, parent-child relationships, supervisor tree
- **v0.3.0** (In Progress) - Cross-instance communication
- **v0.4.0** (Planned) - Scale optimizations, resource management
- **v1.0.0** (Planned) - Production ready, full feature set
