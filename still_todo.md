# Remaining Work — Codex Final Unified Plan

**Audited:** 2026-03-11
**Method:** Full code deep-dive across all 12 workstreams, cross-referenced with documented benchmarks
**Validated by:** GitHub Copilot (gpt-5.3-codex) + Google Gemini (gemini-3-pro-preview)

---

## Summary

| Workstream | Status | Remaining Effort |
|---|---|---|
| F1 Baseline/Profiling | **Done** | — |
| F2 Dashboard Shell | **Done** | — (token cleanup tracked in F9) |
| F3 Session Layout | **Done** | — |
| F4 Transcript Data Model | **95% done** | Small — displayItems() rebuilds fully on every change |
| F5 Transcript Virtualization | **40% done** | **Large** — perf is 4-30x over budget |
| F6 Async Rendering/Caching | **Done** (worker offload deferred by design) | — |
| F7 Integrated Composer | **Done** | — |
| F8 Orchestration Inspectors | **Done** | — |
| F9 Visual System | **90% done** | Small — missing token categories + hardcoded values |
| F10 Control Plane Integration | **Done** | — |
| F11 Scale Operations | **20% done** | Large — 3 greenfield systems |
| F12 Persistence/Recovery | **70% done** | Medium — integration gap, not implementation gap |

---

## F4: Transcript Data Model — Remaining Item

### What's done
- Stable row IDs (`track item.id` with message-derived IDs)
- Tool grouping (consecutive tool_use/tool_result collapsed)
- Repeated message collapse with `repeatCount`
- Continuation header logic (2-minute gap threshold)
- Thought group consolidation with structured thinking content

### What's left

1. **Incremental updates violation** — The plan (F4) explicitly requires: "Avoid rebuilding unchanged rows when upstream content has not changed." However, `displayItems()` in `output-stream.component.ts` rebuilds the **entire** `DisplayItem[]` array from scratch on every state change — running 5 sequential O(n) passes:
   - Pass 1: Streaming message consolidation (lines 606-657)
   - Pass 2: Tool message grouping (lines 660-675)
   - Pass 3: Repeated message deduplication (lines 678-692)
   - Pass 4: `showHeader` continuation computation (lines 695-715)
   - Pass 5: `populateRenderedMarkdown()` re-renders all items (line 717, lines 894-909)

   At 1000 messages this is 5000+ operations per flush cycle. This is the root cause of the 24.6x display-items-compute budget overrun measured in benchmarks. Need incremental append-only processing for new messages.

---

## F5: Transcript Virtualization — CRITICAL PATH

### What's done
- Stable row IDs (`track item.id`) — F4 deliverable
- Scroll position memory per instance (`Map<string, number>`)
- Stick-to-bottom with `userScrolledUp` tracking
- Scroll-to-bottom button
- `requestAnimationFrame` for scroll and instance switch
- Passive scroll listener
- `content-visibility: auto` with `contain-intrinsic-size: auto 80px`
- LRU markdown cache (200 entries, 50K max)

### What's left — backed by measured benchmarks

**Documented performance (from `docs/plans/2026-03-07-workspace-benchmarks.md`):**

| Metric | Measured | Target | Over Budget |
|---|---|---|---|
| Thread switch (p95) | 488ms | 120ms | **4.1x** |
| Transcript paint (p95) | 484ms | 200ms | **2.4x** |
| Scroll frame (p95) | 525ms | 16ms/frame | **32.8x** |
| Display items compute (p99) | 246ms | 10ms | **24.6x** |
| Markdown render (p95) | 6.7ms | 5ms | 1.3x |

These numbers prove the current approach is insufficient for the plan's 5k-10k row target.

### Specific items

1. **CDK Virtual Scroll integration** — `@angular/cdk` is installed but `@angular/cdk/scrolling` is NOT imported in the transcript. Only `instance-list.component.ts` uses it. The transcript renders ALL rows (gated only by CSS `content-visibility`). For 5k+ messages, this causes the 32x scroll budget overrun. Need:
   - `CdkVirtualScrollViewport` with custom virtual scroll strategy for variable-height rows
   - Dynamic height measurement per row type (messages ~80px, thought groups ~120-400px, tool groups ~45-800px, images ~200-400px)
   - `ResizeObserver`-based remeasurement for expand/collapse and image load

2. **displayItems() compute optimization** — See F4 remaining item above. The 5-pass full rebuild is the primary compute bottleneck. Need incremental processing or pre-grouped data from the output store.

3. **Image-aware measurement** — No `ResizeObserver` or placeholder sizing exists. Images cause layout reflow after load, breaking scroll position. Need:
   - Image placeholder with aspect ratio from metadata
   - `ResizeObserver` to trigger remeasurement on image load
   - Update virtual scroll item size cache on reflow

4. **Expand/collapse state persistence** — Tool group and thought process expansion state is NOT saved across instance switches. When switching back to an instance, all groups reset to default collapsed state.

5. **Late content loading** — No lazy loading strategy for off-screen images or large code blocks. All content renders eagerly once the row enters the viewport via `content-visibility`.

6. **Spike required** — Plan explicitly states (line 587): "This is the hardest part of the redesign. It needs explicit spike/prototyping before committing fully to CDK." The spike should:
   - Test CDK virtual scroll with variable-height rows
   - Validate scroll anchoring with streaming append
   - Prototype `ResizeObserver` integration for dynamic content
   - Test with heavy-markdown stress fixture (500+ messages)
   - **Must validate in actual Electron shell**, not just browser harness

---

## F6: Async Rendering/Caching — Note

Marked as **Done** with a caveat: the plan mentioned possible `markdown-render.worker.ts` and `diff-render.worker.ts` Web Workers for offloading expensive rendering. No Web Workers exist in the codebase. However, the plan itself says "add worker offload only where baseline data proves it pays off" — and the markdown render budget is only 1.3x over (6.7ms vs 5ms target), which likely doesn't justify worker complexity. This is a deliberate deferral, not a gap.

If F5 optimization brings the compute budget in line, worker offload may never be needed.

---

## F9: Visual System — Remaining Items

### What's done
- Comprehensive token system: colors, spacing (2xs-3xl), typography (2xs-3xl), radii, shadows, transitions, z-index
- Dark theme (default) + light theme (`[data-theme='light']` + `prefers-color-scheme: light`)
- Status colors, markdown styles, code block styles, hljs syntax highlighting (dark + light)
- Component utilities: glass-panel, elevated-card, btn variants, badges, dividers, status-dot
- Workspace overrides: centered transcript, refined message sizing

### What's left

1. **Missing token categories in `styles.scss`:**
   - Memory type indicators: `--memory-type-{episodic,procedural,semantic,short-term,long-term,unknown}` with alpha variants — currently hardcoded as `#3b82f6`, `#10b981`, `#f59e0b`, `#8b5cf6`, `#ec4899`, `#6b7280` across `memory-browser.component.ts` (lines 497-525) and `memory-stats.component.ts` (lines 428-432)
   - Operation status colors: `--operation-{add,update,delete,noop}` — hardcoded in `memory-stats.component.ts` (lines 486-489)
   - Overlay variants: `--overlay-dark-{light,medium,strong}` — hardcoded `rgba(0,0,0,0.5)` in `settings.component.ts:167` and `rgba(0,0,0,0.2)` in `context/compaction-indicator.component.ts:377`

2. **Hardcoded rgba values that should use tokens:**
   - `sidebar-header.component.scss:11,57-58` — `rgba(255,255,255,0.05)` and `rgba(255,255,255,0.025)`
   - `sidebar-footer.component.scss:8,23-24` — `rgba(8,12,11,0.82)` and `rgba(255,255,255,0.03)`
   - `dashboard.component.scss:69` — `rgba(8,13,12,0.88)` should be `--bg-sidebar` token
   - `sidebar-header.component.scss:81` — `color: #10100d` should use `var(--text-primary)` or themed equivalent

---

## F11: Scale Operations — Remaining Items

### What exists (extendable)
- `SupervisorTree` — hierarchical supervision, auto-expand at 16 children, scales to 10k+ instances, 30s health checks
- `UpdateBatcherService` — 50ms batch window, per-instance dedup
- `ActivityDebouncerService` — 2.5s debounce, signal-based
- `TaskManager` — priority queue (critical/high/normal/low), timeout monitoring (15s)
- `MemoryMonitor` — heap/RSS tracking, pressure levels (normal/warning/critical), 10s interval, GC requests
- `MemoryMonitor` events wired to `InstanceLifecycleManager` (lines 1508-1528) — emits `memory:warning` and `memory:critical` events, forwarded through `InstanceManager`
- `calculateContextBudget()` — token budget calculation for RLM/UnifiedMemory

### What's greenfield

1. **Resource governance** (Medium effort)
   - Per-instance memory caps — no per-instance limits exist
   - Memory-triggered instance **actions** — `MemoryMonitor` events are emitted but no automated response (pause creation, suspend instances, trigger GC) is wired up
   - Context budget enforcement — `calculateContextBudget()` exists but is advisory only, not enforced

2. **Instance hibernation** (Medium effort)
   - Zero matches for `hibernat`, `suspend`, `dormant` patterns in codebase
   - Need: state serialization, idle detection timer, wake protocol
   - Can leverage existing `buildReplayContinuityMessage()` for state reconstruction on wake
   - Need: configurable idle threshold, memory-pressure triggers, hibernation metadata tracking

3. **Instance pooling** (Medium effort)
   - No pool/pooling mechanism exists
   - Need: `PoolManager` service with warm pool of pre-initialized CLI instances
   - Integration: `InstanceManager.createInstance()` should check pool first, `terminateInstance()` should return to pool
   - Need: configurable pool size, auto-grow/shrink, warmth checks

4. **Load balancing** (Medium effort)
   - No cross-instance load distribution logic
   - Need: load metrics per instance (active tasks, context usage, memory pressure)
   - Need: load-aware child selection in `InstanceOrchestrationManager`
   - Can extend `SupervisorTree` to track load per node

---

## F12: Persistence, Recovery, Templates — Remaining Items

### What exists (more than initially assessed)
- **Export/Import**: `exportSession()` (JSON), `exportSessionMarkdown()` (MD), `importSession()` — all working
- **Output storage**: Disk persistence with gzip, 100-message chunks, 500MB limit, auto-cleanup
- **Instance forking**: Fork at specific message point — working
- **Checkpoint system**: `error-recovery.ts` (802 lines) with 14 error patterns, checkpoint create/restore, max 10 per session
- **Session Continuity Manager**: `src/main/session/session-continuity.ts` — FULL implementation exists:
  - Auto-save at configurable intervals (default 60s)
  - Session snapshots with point-in-time restoration
  - `SessionState` schema with conversation history, context usage, pending tasks, environment, git branch
  - Resume options (messages, context, tasks, environment)
  - Default config has `resumeOnStartup: true` and `autoSaveEnabled: true`
  - Max 50 snapshots, 30-day retention, compression, optional encryption
- **Checkpoint Manager**: `src/main/session/checkpoint-manager.ts` — bridges error recovery with session continuity, transaction logging, recovery-aware checkpoints
- **Templates**: 4 production-ready templates (Feature Dev, PR Review, Repo Health, Issue Implementation) — **FULLY IMPLEMENTED**

### The actual gap: integration, not implementation

The `SessionContinuityManager` and `CheckpointManager` are **fully implemented** but **NOT wired into the app lifecycle**:

1. **App startup does not restore sessions** (High priority)
   - `src/main/index.ts` `initialize()` does NOT import or call `SessionContinuityManager`
   - Zero references to `session-continuity` or `checkpoint-manager` in `src/main/index.ts`
   - Need: wire `getSessionContinuityManager()` into `AIOrchestratorApp.initialize()` to restore sessions on startup

2. **App shutdown does not persist sessions** (High priority)
   - `cleanup()` in `src/main/index.ts` calls `terminateAll()` without saving state first
   - Need: call `SessionContinuityManager` to snapshot all active sessions before `terminateAll()`

3. **Auto-save timers not started** (High priority)
   - `SessionContinuityManager` has auto-save infrastructure (timers, intervals) but nothing calls `trackSession()` to register instances for auto-save
   - Need: wire `InstanceManager` instance creation/termination events to `SessionContinuityManager.trackSession()`/`untrackSession()`

4. **IPC handlers for restore UI** (Medium priority)
   - No IPC handlers expose session list or restore actions to the renderer
   - Need: handlers for listing available sessions, restoring selected sessions, managing snapshots

5. **Export improvements** (Low priority)
   - Only JSON and Markdown formats — no CSV, HTML export
   - No message filtering on export

6. ~~Custom template support~~ — The plan only asked for "blueprint/template workflows" which are fully implemented with 4 production templates. Custom user-created templates would be a scope extension beyond the original plan.

---

## Recommended Execution Order

### Phase 1: Critical Performance (F4 remaining + F5)
The 4-30x budget overruns are the most impactful user-facing issue:
1. Optimize `displayItems()` to use incremental append-only processing (F4 gap)
2. F5 spike: Test CDK virtual scroll with variable-height transcript rows
3. If spike succeeds: implement CDK virtual scroll for transcript
4. Add `ResizeObserver` for dynamic content measurement
5. Add expand/collapse state persistence

### Phase 2: Persistence Integration (F12)
The infrastructure exists — the gap is wiring it up:
1. Wire `SessionContinuityManager` into `src/main/index.ts` (startup restore + shutdown save)
2. Wire `InstanceManager` events to `SessionContinuityManager.trackSession()`
3. Add IPC handlers for session restore UI
4. Verify auto-save timers activate correctly

### Phase 3: Token Cleanup (F9)
Low-effort, high-consistency improvement:
1. Add missing token categories to `styles.scss` (memory types, operations, overlays)
2. Replace hardcoded rgba/hex values across dashboard + memory components

### Phase 4: Scale Operations (F11)
Longer-term infrastructure:
1. Resource governance (wire MemoryMonitor actions to instance lifecycle)
2. Instance hibernation
3. Instance pooling
4. Load balancing

---

## Validator Feedback Summary

### Corrections applied from Copilot review:
- Removed F2 "sidebar status indicators missing" — already implemented via `<app-status-indicator>` in `instance-row.component.ts:58`
- Updated F12 to reflect `SessionContinuityManager` and `CheckpointManager` existence — gap is integration, not implementation
- Updated F11 to note `MemoryMonitor` IS wired to `InstanceLifecycleManager` (lines 1508-1528) — gap is automated response actions
- Fixed path: `compaction-indicator.component.ts` is in `context/`, not `instance-list/`
- Clarified p95 vs p99 in benchmark table

### Corrections applied from Gemini review:
- Moved displayItems() full-rebuild issue from F5 to F4 (it violates F4's "avoid rebuilding unchanged rows" requirement)
- Added 5th hidden pass (populateRenderedMarkdown) to the compute analysis
- Added F6 caveat about Web Worker deferral being deliberate
- Removed "custom template support" as a gap — original plan only asked for template workflows, which are fully implemented
- Added note that Electron shell validation is required (not just browser harness)
