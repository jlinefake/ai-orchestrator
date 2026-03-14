# Session Diff Stats & Unread Completion Indicator

**Date**: 2026-03-14
**Status**: Approved

## Overview

Add two Codex-inspired features to the instance list UI:

1. **Lines changed indicator** — Show `+N -M` (green/red) per instance session, tracking only what that instance changed during the session.
2. **Unread completion dot** — A blue dot appears when an instance finishes a task (busy→idle) and persists until the user selects/views that instance.

## Motivation

When managing multiple concurrent AI instances, the user needs at-a-glance answers to two questions:
- "Did this instance actually change anything, and how much?"
- "Which instances have finished since I last looked?"

Codex provides both — `+N -M` diff stats and a blue unread dot. We adapt the same UX to our orchestrator's instance list.

## Research

### How other tools do it

| App | Change tracking method | Completion indicator |
|-----|----------------------|---------------------|
| **Codex** | `TurnDiffTracker` — file content baselines captured before patches, unified diff computed after. Uses `similar::TextDiff`. | Blue dot (unread semantics — clears on view) |
| **opencode** | Snapshot at "step-start"/"step-finish", session-level summary of additions/deletions/file count. `Session.Event.Diff` event. | N/A |
| **t3code** | Turn-based diff checkpoints, `additions`/`deletions` per file, aggregated to directories. | N/A |
| **openclaw** | Ephemeral state with timestamp-based auto-clearing. `chatNewMessagesBelow` for unread. | Toast notifications, count badges |

### Design input

**Gemini** recommended: intercept file writes rather than polling git; ephemeral crossfade for completion; hide `+0 -0`; aggregate in row with file detail on tooltip.

**Copilot** recommended: fixed-width diff slot (mono font, tabular-nums); state model (running/done+changes/done+no-changes/failed); 700-1200ms highlight animation on completion.

## Architecture

### Approach: File Content Snapshots (Codex-style)

We chose Approach C — file content snapshots — modeled on Codex's `TurnDiffTracker`. This approach:
- Captures file content baselines before modifications
- Computes line-level diffs after each busy→idle transition
- Works in non-git directories
- Provides per-instance isolation without git coordination

This was chosen over git-based approaches because:
- It isolates changes per instance even when multiple instances work in the same repo
- It doesn't require spawning git subprocesses
- It matches the proven Codex architecture

---

## Feature 1: Session Diff Tracking Engine

### Data Model

```typescript
interface SessionDiffStats {
  totalAdded: number;
  totalDeleted: number;
  files: Map<string, FileDiffEntry>;
}

interface FileDiffEntry {
  path: string;
  status: 'added' | 'modified' | 'deleted';
  added: number;
  deleted: number;
}
```

### SessionDiffTracker (main process)

One `SessionDiffTracker` instance per active Instance. Stored in a `Map<string, SessionDiffTracker>` inside `InstanceStateManager`. Created when an instance spawns, destroyed when terminated.

**Baseline capture:**
- When a `tool_use` or `tool_result` message indicates a file is being modified, `ToolOutputParser` extracts the file path.
- The first time a file is seen in a turn, `SessionDiffTracker.captureBaseline(filePath)` reads the file from disk and stores its content in memory.
- If the file doesn't exist yet (new file being created), baseline is stored as empty string.

**Diff computation:**
- Triggered on busy→idle transition.
- For each file with a captured baseline: read current content from disk, compute line-level diff.
- Sum additions and deletions across all files.
- Uses a diffing library (e.g., `diff` npm package) for line-level comparison.
- Binary files detected and skipped (counted as file changes but not line changes).

**Accumulation across turns:**
- Diff stats accumulate across the session's lifetime.
- After each diff computation, baselines are updated to current content so subsequent turns don't double-count.
- Running totals in `totalAdded` and `totalDeleted` grow monotonically.

**Edge cases:**
- **Non-git directories**: Works fine — pure file content diffing, no git dependency.
- **Binary files**: Detected (content fails UTF-8 check), counted as 1 file changed but 0 line changes.
- **File deleted by instance**: All baseline lines count as deletions.
- **File created by instance**: All new lines count as additions (baseline was empty).
- **Shell commands modifying files indirectly**: Best-effort detection via bash tool output parsing. Accepted limitation — matches Codex's behavior (they only track files going through their patch system).

### ToolOutputParser (main process)

Extracts file paths from instance output messages. Provider-specific parsing with documented conventions.

```typescript
class ToolOutputParser {
  extractFilePaths(
    message: OutputMessage,
    workingDirectory: string,
    provider: InstanceProvider
  ): string[];
}
```

**Provider tool naming conventions:**

These conventions MUST be documented with real examples and covered by tests, so we detect when providers change their output format.

#### Claude CLI
- **`Write` tool**: `file_path` in tool_use metadata/content
- **`Edit` tool**: `file_path` in tool_use metadata/content
- **`Bash` tool**: Best-effort regex for file-modifying commands (`>`, `sed -i`, `mv`, `cp`, `tee`, etc.)
- **`Read` tool**: Ignored (doesn't modify files)
- **`Glob`/`Grep` tools**: Ignored (read-only)

#### Codex CLI
- **`write_file`**: File path in arguments
- **`apply_patch`**: File paths in patch content
- **`shell`**: Best-effort regex (same as Claude Bash)

#### Gemini CLI
- **`edit_file`**: File path in arguments
- **`write_file`**: File path in arguments
- **`shell`**: Best-effort regex

#### Copilot CLI
- **`editFile`**: File path in arguments
- **`createFile`**: File path in arguments
- **`runCommand`**: Best-effort regex

#### General fallback
- For any unrecognized provider or tool name: scan message content and metadata for strings that look like file paths within the working directory (heuristic).

**Test requirements:**
- Each provider's tool conventions must have dedicated test cases with real-world example messages.
- Tests should include the tool_use message format (what the JSON looks like) as documentation.
- Tests should cover: simple file path extraction, multiple files in one message, relative vs absolute paths, paths outside working directory (should be ignored), shell commands with file targets.

---

## Feature 2: Unread Completion Indicator

### State

- New field on renderer-side `Instance` type: `hasUnreadCompletion: boolean`
- **Set to `true`** when a batch-update arrives showing status changed to `idle` and previous status was `busy`
- **Cleared to `false`** when the user selects that instance (clicks on the row)
- Also set on `busy` → `waiting_for_input` (instance finished but needs input)
- Also set on `busy` → `error` (instance failed — user should check why)
- NOT set on: initial creation, waking from hibernation, respawning, or any non-busy origin transition

### State location

This is purely renderer-side state. The main process doesn't track or care about "unread" status. The renderer's `InstanceStateService` manages it by:
1. Comparing previous and current status on each batch-update
2. Checking if the selected instance matches one with `hasUnreadCompletion: true` and clearing it

### Visual treatment

**Placement**: Inline before the instance name, inside `.instance-info`:
```
[provider icon]  ● Instance name...    +13 -13   8m
```

**Styling:**
- 8px diameter circle
- Color: `#60A5FA` (blue-400, muted blue for dark backgrounds)
- Subtle glow: `box-shadow: 0 0 6px rgba(96, 165, 250, 0.5)`
- Appears with 200ms fade-in animation
- Disappears immediately on selection (no fade-out)

**Edge cases:**
- Instance errors (busy→error): Show dot — user should look at the error
- Rapid busy→idle→busy (multi-step): Clear dot on first idle, set new dot on next idle. Diff stats accumulate independently.
- Multiple instances complete at once: Each gets independent dot state

---

## Feature 3: Diff Stats Display (UI)

### Placement

Between instance name and time label, matching Codex's layout:
```
[provider icon]  ● Instance name...    +13 -13   8m
```

### Rendering rules

| State | Display |
|-------|---------|
| Has changes (`totalAdded > 0 \|\| totalDeleted > 0`) | `+N` in green, `-M` in red |
| No changes (both zero) | Hidden completely — no visual element |
| Instance is busy (working) | Stats update live as files are detected |
| Instance errored | Hidden (focus on error state) |

### Styling

```css
.diff-stats {
  display: flex;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
  white-space: nowrap;
}

.diff-added { color: #4ade80; }
.diff-deleted { color: #f87171; }
```

Both the sign character and number are the same color (`+13` all green, `-13` all red).

### Tooltip

On hover over the diff stats, show per-file breakdown:
```
Modified:
  src/app/main.ts        +10  -2
  package.json            +2  -2
  src/utils/helpers.ts    +1  -9
```

Data comes from `SessionDiffStats.files` — already tracked by the engine.

### IPC transport

Diff stats piggyback on the existing batch-update system:
- Added as optional `diffStats?: { totalAdded: number; totalDeleted: number }` in the batch-update payload
- Flushed on the existing 100ms cycle — no new IPC channel needed
- File-level detail sent separately (or on-demand via a new IPC call to avoid bloating batch updates)

---

## Files to Create

| File | Purpose |
|------|---------|
| `src/main/instance/session-diff-tracker.ts` | `SessionDiffTracker` class — baseline snapshots + diff computation |
| `src/main/instance/tool-output-parser.ts` | `ToolOutputParser` — provider-specific file path extraction |
| `src/main/instance/tool-output-parser.spec.ts` | Tests for tool naming conventions per provider, with documented examples |
| `src/main/instance/session-diff-tracker.spec.ts` | Tests for baseline capture, diff computation, accumulation |

## Files to Modify

### Main process
| File | Changes |
|------|---------|
| `src/shared/types/instance.types.ts` | Add `diffStats` field to `Instance` type |
| `src/main/instance/instance-state.ts` | Store `SessionDiffTracker` per instance; include `diffStats` in batch-update |
| `src/main/instance/instance-lifecycle.ts` | Hook output events → `ToolOutputParser`; hook busy→idle → diff computation |

### Renderer
| File | Changes |
|------|---------|
| `src/renderer/app/core/state/instance/instance.types.ts` | Add `diffStats` and `hasUnreadCompletion` fields |
| `src/renderer/app/core/state/instance/instance-state.service.ts` | Set/clear unread flag on status transitions and selection changes |
| `src/renderer/app/core/state/instance/instance-list.store.ts` | Deserialize new fields from IPC |
| `src/renderer/app/features/instance-list/instance-row.component.ts` | Render diff stats, unread dot, tooltip |

## Event Flow

```
Instance output arrives (tool_use message)
  → ToolOutputParser.extractFilePaths()
  → SessionDiffTracker.captureBaseline(filePath)

Instance status: busy → idle
  → SessionDiffTracker.computeDiff()
  → Updates instance.diffStats
  → Included in next batch-update IPC flush
  → Renderer receives & updates store
  → InstanceRowComponent re-renders with +N -M
  → hasUnreadCompletion set to true

User selects instance
  → hasUnreadCompletion cleared to false
  → Blue dot disappears
```
