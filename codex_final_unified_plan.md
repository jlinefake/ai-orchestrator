# Codex Final Unified Plan

**Purpose:** Define the canonical redesign and implementation strategy for AI Orchestrator after comparing and reconciling:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/codex_uniformed_plan.md`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/claude_unified_plan.md`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/DESIGN.md`

**Intent:** This is the final synthesis document. It keeps the stronger product framing from the Codex plan, keeps the stronger implementation detail from the Claude plan, and corrects both plans where they drift from the actual repository structure.

---

## Executive Decision

AI Orchestrator should explicitly become a **two-layer product**:

1. **Operator Workspace**
- transcript-first
- fast
- calm
- premium
- optimized for the daily loop of reading, deciding, and sending

2. **Orchestration Control Plane**
- hierarchy
- supervision
- verification
- debate
- telemetry
- memory / RLM
- scale operations

This is not a compromise. It is the right product architecture.

The old problem:
- the default route behaves too much like a command center

The new direction:
- the default route becomes an operator workspace
- advanced orchestration remains first-class, but shifts into on-demand surfaces and dedicated routes

---

## What Changed After The Extra Architecture Pass

This final plan is grounded in the actual repo, not just earlier planning docs.

### Confirmed repo facts

1. The default route still loads `DashboardComponent` in:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/app.routes.ts`

2. The renderer state layout is centered around `core/state`, not `app/stores`:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/state/instance/index.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/state/instance.store.ts`

3. The app already has a global token/theme system in:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/styles.scss`

4. Multi-provider support is already real, not hypothetical:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/main/providers/index.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/main/providers/provider-registry.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/providers/provider-selector.component.ts`

5. Worktree support is already a product area, not a future invention:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/worktree/worktree-page.component.ts`

6. There is currently no obvious shared feature-flag system in the renderer.

7. `node-pty` and `xterm` are not present in `package.json`, so an integrated terminal would still be genuinely new scope.

8. There is already a reusable shared timeline-style component:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/shared/components/timeline-view/timeline-view.component.ts`

### Consequence

This final plan avoids:
- inventing parallel `app/stores` paths
- treating provider support as greenfield
- treating worktree support as greenfield
- introducing a second competing token system unless there is a hard technical reason

---

## Comparison Outcome

### What the Codex plan got right

The best contribution from `codex_uniformed_plan.md`:
- the **two-layer product model**
- the distinction between **Operator Workspace** and **Control Plane**
- preserving the original orchestrator ambition instead of collapsing into “make it a nicer chat app”

### What the Claude plan got right

The best contribution from `claude_unified_plan.md`:
- explicit budgets
- migration sequencing
- component/store ideas
- Angular implementation rules
- more concrete workstream shape

### What needed correction

From the Claude plan:
- `src/renderer/app/stores/...` does not match the current repository structure
- several deferred items were described as greenfield despite existing provider/worktree infrastructure
- introducing a fresh shell component tree should be treated as a design option, not an unquestioned assumption

From the Codex plan:
- it was a better product strategy than build plan
- it needed more implementation specificity and more repo-fit guidance

---

## Final Product Thesis

### The app should feel like this

When a user opens AI Orchestrator, the first impression should be:
- “this is where I do the work”

Not:
- “this is where I configure the machinery”

When the user needs more power, the app should reveal:
- child agents
- verification
- review
- context diagnostics
- worktrees
- provider controls
- logs
- VCS
- memory / RLM

That leads to one core rule:

**The default route must optimize for focused execution, not feature visibility.**

---

## Product Layers

## Layer 1: Operator Workspace

This is the default path and primary daily-use surface.

### Required traits
- transcript-first
- low chrome density
- stable under heavy streaming
- fast thread switching
- one coherent composer dock
- secondary concerns only when needed

### Core objects the user experiences
- projects
- sessions/threads
- transcript
- work/tool activity
- composer
- optional inspectors

## Layer 2: Orchestration Control Plane

This is where AI Orchestrator differentiates.

### Includes
- supervision
- verification
- debate
- specialists
- worktrees
- VCS
- RLM / memory
- statistics
- security
- tasks
- settings

### Rule

These features stay powerful and visible, but they should not overload the operator workspace by default.

---

## Final UX Model

## Left rail

The left rail should primarily show:
- project groups
- sessions/threads
- active / unread / busy state
- creation actions

It may also include secondary navigation, but that navigation should be visually subordinate to projects and sessions.

### Existing fit

This means the current `dashboard` shell should evolve rather than be discarded outright:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/dashboard/dashboard.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/dashboard/dashboard.component.html`

## Top bar

The session header should be reduced to high-signal information:
- session title
- cwd / worktree
- provider / model summary
- status
- compact action cluster

Advanced controls should move behind:
- segmented menus
- popovers
- drawers

## Main column

The transcript must be the strongest visual object.

### Transcript contents
- user messages
- assistant messages
- grouped work / tool blocks
- diff / checkpoint summaries
- proposed plans
- working indicators

### The transcript should not be visually preceded by
- permanently mounted review blocks
- permanently mounted todo panels
- permanently mounted child-agent sections
- permanently mounted approval panels

## Composer dock

The bottom of the workspace should become one integrated control surface.

### It must own
- prompt entry
- attachments
- provider/model state
- interaction/runtime state
- send / interrupt
- queue visibility when needed

## Secondary inspectors

The following should move into on-demand surfaces:
- child agents
- review / verification
- context health
- pending approvals / user inputs
- extended metadata / diagnostics

Preferred patterns:
- right-side drawer
- contextual sheet
- inspector tabs
- collapsible blocks attached to relevant events

---

## Final Architecture Rules

## Renderer rules

### 1. Respect current repo structure

New state or services should prefer:
- `src/renderer/app/core/state/`
- `src/renderer/app/core/services/`
- feature-local files where appropriate

Do not create a parallel `src/renderer/app/stores/` universe unless there is a compelling migration reason.

### 2. Extend existing shell where possible

Prefer:
- evolving `dashboard` into the new operator shell
- extracting focused components into adjacent feature folders

Over:
- inventing a completely separate shell hierarchy too early

### 3. Reuse existing shared components when they fit

Candidates for reuse or adaptation:
- status badges
- message attachments
- thought-process rendering
- tool-group rendering
- timeline-view patterns

### 4. Preserve existing provider and orchestration wiring

Do not plan around replacing:
- provider registry
- provider detection
- IPC channels
- instance management backend

The near-term leverage is in the renderer.

## Theming rules

### 1. Build on existing global tokens

The current token system in:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/styles.scss`

already covers:
- colors
- spacing
- typography
- radii
- transitions
- status colors

The redesign should refine and extend this system, not create a second design-token source by default.

### 2. Visual direction

Keep the orchestrator identity, but reduce command-center intensity.

Recommended direction:
- darker, quieter surfaces
- fewer competing borders
- less amber dominance in the hot path
- softer text contrast hierarchy
- transcript stronger than chrome

---

## Performance Doctrine

Performance is not a polish phase. It is a product requirement.

## Hard requirements

1. Large transcripts must not require mounting full history.
2. Stable identity must replace index-based tracking in transcript rendering.
3. Streaming must not degrade input responsiveness.
4. Thread switching must feel immediate in common cases.
5. Expensive rendering must not block scroll and typing.
6. Caches must be bounded by policy.

## Target budgets

| Metric | Target |
|---|---|
| Thread switch to usable workspace | under 120 ms typical |
| Time to first visible transcript paint | under 200 ms typical |
| Sustained scroll on large transcripts | no obvious jank |
| Composer latency during streaming | effectively instantaneous |
| Markdown/highlight cache growth | bounded |
| Long-session memory behavior | stable, no unbounded growth |

## Reference lessons from `t3code`

Keep these principles, not their exact framework implementation:
- virtualized transcript rows
- stable row keys
- image-aware measurement
- grouped tool/work activity
- worker-based heavy rendering
- bounded caches

---

## Scope Classification After The Extra Pass

This section corrects earlier planning drift.

## Already real and should be integrated/refined

### Multi-provider support

Already exists in meaningful form:
- provider registry in main
- provider selector in renderer
- codex and gemini providers already present

Plan implication:
- do not treat multi-provider as deferred greenfield
- integrate provider state more elegantly into the new composer and header

### Worktree support

Already exists as a feature area and backend flow.

Plan implication:
- do not treat worktree support as deferred greenfield
- decide whether the operator workspace should surface lightweight worktree state inline
- keep full worktree workflows in dedicated views until inline integration is justified

## Truly new scope and should stay out of the core redesign

### Integrated terminal

Because the dependency and infra are not currently present:
- no `node-pty`
- no `xterm`

Plan implication:
- do not fold terminal work into the core redesign
- keep it as a future initiative unless the user explicitly reprioritizes it

### Large shell-level state rewrite

Plan implication:
- do not assume new global stores for everything
- add only the minimum new state needed to support project/thread grouping and transcript modeling

---

## Final Workstreams

## F1: Baseline, Profiling, And Stress Fixtures

**Goal:** Establish evidence before architecture changes.

### Tasks
1. Add renderer instrumentation for:
   - thread switch time
   - transcript initial paint
   - scroll-heavy sessions
   - composer latency during streaming
2. Create synthetic stress fixtures covering:
   - long markdown
   - many tool events
   - image attachments
   - multiple active sessions
3. Capture baseline metrics in the actual Electron app.
4. Create a simple benchmark note under `docs/plans` or `benchmarks`.

### Likely files
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/output-stream.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/dashboard/dashboard.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/services/`

### Verification
```bash
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.spec.json
npm run lint
```

Manual:
- load large fixture
- switch instances rapidly
- stream responses
- record timings

---

## F2: Dashboard-to-Workspace Shell Transformation

**Goal:** Transform the current default dashboard route into an operator workspace without breaking the rest of the app.

### Tasks
1. Rework the current sidebar to prioritize:
   - project groups
   - sessions/threads
   - active state
   - unread/busy state
2. Move broad feature navigation into a secondary visual zone.
3. Simplify sidebar header chrome.
4. Reduce default shell competition from right-side explorer behavior if it harms the operator loop.
5. Keep route-level feature access intact.

### Important repo-fit constraint

Do not begin by creating a parallel shell unless needed. First try evolving:
- `dashboard.component.ts`
- `dashboard.component.html`
- `dashboard.component.scss`

### Optional migration support

Because there is no current feature-flag system, a lightweight development toggle may be introduced if needed, but it should be intentionally small and local to the shell migration.

### Verification
```bash
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.spec.json
npm run lint
```

Manual:
- default route reads as workspace-first
- navigation to advanced routes still works

---

## F3: Session Layout Recomposition

**Goal:** Make the selected session route transcript-first.

### Tasks
1. Reduce permanent vertical stack above the transcript.
2. Move todo, review, child-agent, approval, and diagnostic surfaces into on-demand inspectors.
3. Introduce a centered transcript column.
4. Simplify the instance header to high-signal information.
5. Keep active status visible without bloating the top of the page.

### Likely files
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/instance-detail.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/instance-header.component.ts`

### Verification
```bash
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.spec.json
npm run lint
```

Manual:
- transcript is visually dominant
- orchestration features remain one interaction away

---

## F4: Transcript Data Model And Rendering Rewrite

**Goal:** Make the transcript path scale while preserving semantics.

### Tasks
1. Introduce a normalized timeline model for the active session.
2. Replace index-based tracking with stable row ids.
3. Preserve current strengths:
   - consolidated streaming messages
   - grouped tool output
   - repeated-message collapse
4. Separate timeline derivation from template rendering.
5. Avoid rebuilding unchanged rows when upstream content has not changed.

### Repo-fit note

This can live:
- as feature-local helpers under `features/instance-detail`
- or as narrowly scoped state/services under `core/state/instance`

Do not create a broad new state layer unless the implementation proves it necessary.

### Verification
```bash
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.spec.json
npm run lint
```

Manual:
- timeline behavior matches existing semantics before virtualization is introduced

---

## F5: Transcript Virtualization And Scroll Integrity

**Goal:** Ensure huge transcripts remain fast.

### Tasks
1. Evaluate Angular CDK virtual scroll against transcript needs.
2. If CDK is viable, implement:
   - virtualized rows
   - stable `trackBy`
   - dynamic-height measurement
   - image-aware remeasurement
3. If CDK proves too rigid, use a custom windowed approach.
4. Preserve:
   - stick-to-bottom during streaming
   - late content/image loading
   - expand/collapse behavior
   - thread switch restoration

### Important caution

The transcript contains variable-height content:
- markdown
- images
- code
- thought blocks
- tool groups
- system boundaries

This is the hardest part of the redesign. It needs explicit spike/prototyping before committing fully to CDK.

### Verification
```bash
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.spec.json
npm run lint
```

Manual:
- 5k to 10k row fixture remains smooth
- thread switch does not force full-history reflow

---

## F6: Async Rendering, Bounded Caching, And Main-Thread Protection

**Goal:** Keep interaction smooth under code-heavy output.

### Tasks
1. Audit markdown rendering cost.
2. Audit syntax highlight and diff rendering cost.
3. Replace ad hoc cache sizing with bounded policy.
4. Reduce rebinding/reinitialization overhead in output behavior.
5. Add worker offload only where baseline data proves it pays off.

### Important correction from prior draft

Do not assume all markdown rendering must move to workers immediately.

The right sequence is:
1. measure
2. optimize obvious hot spots
3. add worker offload where the data justifies the complexity

### Likely files
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/output-stream.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/services/markdown.service.ts`

### Verification
```bash
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.spec.json
npm run lint
```

Manual:
- large code-heavy responses do not visibly hitch scroll or typing

---

## F7: Integrated Composer And Session Control Dock

**Goal:** Create one coherent operator input surface.

### Tasks
1. Consolidate prompt, attachments, provider, model, mode, and send/interrupt into one dock.
2. Integrate existing provider capabilities rather than inventing new provider systems.
3. Preserve busy/respawn/queued-message semantics.
4. Make advanced controls expandable rather than always visible.
5. Ensure drafts survive thread/session switching.

### Repo-fit note

This should likely extend existing provider and instance state services instead of replacing them:
- `ProviderStateService`
- instance selection/output/messaging state

### Likely files
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/input-panel.component.ts`
- related provider state/services

### Verification
```bash
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.spec.json
npm run lint
```

Manual:
- typing remains fast during streaming
- provider/model changes still work
- attachments still work

---

## F8: Orchestration Inspectors Modernization

**Goal:** Keep power visible without keeping it in the hot path.

### Tasks
1. Redesign child-agent presentation as an inspector surface.
2. Redesign review and verification summaries as inspector surfaces or contextual inline cards.
3. Redesign context-health presentation for quick scanning.
4. Preserve important badge/alert states even when inspectors are collapsed.

### Likely files
- `features/instance-detail/child-instances-panel.component.ts`
- `features/instance-detail/instance-review-panel.component.ts`
- `features/instance-detail/context-warning.component.ts`
- `features/instance-detail/user-action-request.component.ts`

### Verification
```bash
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.spec.json
npm run lint
```

Manual:
- child agents and approvals are easy to find
- they no longer dominate the transcript path

---

## F9: Visual System Unification

**Goal:** Make the operator workspace and control plane feel like one product.

### Tasks
1. Refine existing global tokens in `styles.scss`.
2. Reduce border density and surface noise.
3. Tune typography and spacing hierarchy.
4. Make the transcript visually stronger than supporting chrome.
5. Ensure advanced routes inherit the calmer system instead of remaining visually disconnected.

### Important correction from prior draft

Do not introduce a new token file by default if `styles.scss` can remain the source of truth.

### Verification
```bash
npx tsc --noEmit
npx tsc --noEmit -p tsconfig.spec.json
npm run lint
```

Manual:
- shell and advanced routes feel related
- transcript remains the strongest object in the workspace

---

## F10: Control Plane Integration Pass

**Goal:** Ensure the redesign does not weaken the rest of the product.

### Tasks
1. Review navigation into:
   - verification
   - debate
   - worktrees
   - VCS
   - memory / RLM
   - settings
2. Ensure the shell transition preserves discoverability.
3. Decide which control-plane summaries should surface in the operator workspace, and which should remain route-level only.

### Important reclassification

These are not “future maybe” areas. They already exist in the product and must be intentionally integrated into the new shell story.

---

## F11: Scale Operations Roadmap Continuation

**Goal:** Carry forward the original systems roadmap after the workspace rewrite stabilizes.

### Includes
- batching improvements for large instance counts
- resource governance
- memory caps
- hibernation
- instance pooling

### Status

This remains important, but should follow the hot-path redesign unless user priorities change.

---

## F12: Persistence, Recovery, And Templates

**Goal:** Increase continuity and repeatability once the new workspace is stable.

### Includes
- session restore
- crash recovery
- export improvements
- blueprint/template workflows

### Status

Post-core redesign initiative.

---

## Technical Decisions

## Keep Angular

Reasons:
- the repo already has a large Angular surface area
- signals-based state is already in use
- Angular control flow and CDK are viable for this redesign
- rewriting to React would add delay without solving the core problem

## Keep IPC

Reasons:
- Electron IPC fits the current architecture
- provider/orchestration wiring already exists
- there is no product-level reason to insert WebSocket complexity into the desktop path

## Prefer extension over parallel architecture

Examples:
- evolve `dashboard` before inventing a separate shell
- extend `core/state` before inventing `app/stores`
- extend `styles.scss` before inventing a second token system

## Add feature flags only if needed for migration safety

There is no visible shared feature-flag system now. If needed, introduce the smallest possible mechanism to safely parallel-run old and new shell behavior during development.

---

## Delivery Order

1. F1: Baseline, profiling, and stress fixtures
2. F2: Dashboard-to-workspace shell transformation
3. F3: Session layout recomposition
4. F4: Transcript data model and rendering rewrite
5. F5: Transcript virtualization and scroll integrity
6. F6: Async rendering, bounded caching, and main-thread protection
7. F7: Integrated composer and session control dock
8. F8: Orchestration inspectors modernization
9. F9: Visual system unification
10. F10: Control plane integration pass
11. F11: Scale operations roadmap continuation
12. F12: Persistence, recovery, and templates

## Why this order

- F1 ensures evidence before change.
- F2 and F3 correct product posture early.
- F4 and F5 address the hardest performance problem directly.
- F6 protects interaction quality under heavy content.
- F7 completes the core operator loop.
- F8 through F10 ensure the redesign does not weaken orchestration value.
- F11 and F12 continue the original roadmap after the hot path is fixed.

---

## Risks And Mitigations

## Risk 1: Solving only the visuals

If the team only reskins the app, it will still feel dense and slow.

### Mitigation
- make transcript and shell architecture the first real changes

## Risk 2: Over-rewriting

If we invent too many new layers up front, delivery slows and migration risk rises.

### Mitigation
- prefer evolution of current shell, state, and token systems

## Risk 3: Underestimating transcript complexity

Dynamic-height transcript virtualization is hard.

### Mitigation
- do a measured spike before locking strategy
- keep fallback options open

## Risk 4: Weakening control-plane discoverability

If advanced features become too hidden, the product loses one of its reasons to exist.

### Mitigation
- use badges, inspector entry points, and deliberate shell/navigation integration

## Risk 5: Breaking existing workflows during migration

### Mitigation
- keep migration incremental
- add temporary shell toggle if needed
- preserve backend and IPC contracts

---

## Success Criteria

The redesign is successful when all of the following are true:

1. The default route feels like a focused operator workspace.
2. The transcript is visually and functionally dominant.
3. Large transcripts remain smooth under realistic load.
4. Thread switching and streaming feel fast.
5. Provider/model workflows remain intact and better integrated.
6. Worktree and orchestration capabilities remain accessible.
7. The shell and advanced routes feel like one product.
8. The product still clearly supports supervision, verification, debate, and scale ambitions.
9. No major regression lands in existing backend-powered capabilities.

---

## Final Recommendation On Document Usage

Use this file as the canonical plan.

Use the earlier docs this way:
- `codex_uniformed_plan.md` as the strategic predecessor
- `claude_unified_plan.md` as the source of useful implementation ideas, but not as the canonical execution document

---

## Immediate Next Step

Create a phase-1 execution plan for:
- F1
- F2
- F3
- the design spike portion of F5

That implementation plan should identify:
- exact files to modify first
- the smallest safe migration slice
- verification procedure in the real Electron UI

---

## Repo-Fit Execution Appendix

This appendix exists to make the plan executable against the current repository rather than merely persuasive.

## Likely files by workstream

## F1: Baseline, profiling, and stress fixtures

Primary candidate files:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/output-stream.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/dashboard/dashboard.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/services/update-batcher.service.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/services/activity-debouncer.service.ts`

Possible new files:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/services/perf-instrumentation.service.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/docs/plans/workspace-benchmarks.md`

## F2: Dashboard-to-workspace shell transformation

Primary candidate files:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/dashboard/dashboard.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/dashboard/dashboard.component.html`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/dashboard/dashboard.component.scss`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/dashboard/sidebar-header.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/dashboard/sidebar-header.component.scss`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/dashboard/sidebar-nav.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/dashboard/sidebar-footer.component.ts`

Adjacent systems to review before changing shell behavior:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/services/view-layout.service.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/file-explorer/file-explorer.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/app.routes.ts`

## F3: Session layout recomposition

Primary candidate files:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/instance-detail.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/instance-header.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/context-bar.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/context-warning.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/todo-list.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/instance-review-panel.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/child-instances-panel.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/user-action-request.component.ts`

## F4 and F5: Transcript rewrite and virtualization

Primary candidate files:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/output-stream.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/services/markdown.service.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/shared/components/timeline-view/timeline-view.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/shared/components/message-attachments/message-attachments.component.ts`

State files that may need narrow extensions:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/state/instance/instance-output.store.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/state/instance/instance-selection.store.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/state/instance/instance-state.service.ts`

## F6: Async rendering and bounded caching

Primary candidate files:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/services/markdown.service.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/services/diff.service.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/output-stream.component.ts`

Likely new files if worker offload is justified:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/workers/markdown-render.worker.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/workers/diff-render.worker.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/services/render-worker-pool.service.ts`

## F7: Integrated composer and session dock

Primary candidate files:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/instance-detail/input-panel.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/services/draft.service.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/services/provider-state.service.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/providers/provider-selector.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/providers/copilot-model-selector.component.ts`

State files to inspect first:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/state/instance/instance-messaging.store.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/core/state/instance/instance.store.ts`

## F8 through F10: Inspectors, visual system, and control-plane integration

Primary candidate files:
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/styles.scss`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/shared/components/status-badge/status-badge.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/worktree/worktree-page.component.ts`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/verification/`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/vcs/`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/memory/`
- `/Users/suas/work/orchestrat0r/claude-orchestrator/src/renderer/app/features/rlm/`

## Explicit spikes before committing architecture

These questions should be answered with code spikes or measurements, not opinion.

1. Can Angular CDK virtual scroll handle the transcript’s dynamic-height mix of markdown, images, code blocks, tool groups, and expandable sections without introducing unacceptable scroll bugs?
2. Does the current `output-stream` structure need a full normalized timeline model, or can stable identity and virtualization be added by refactoring the existing derived list?
3. Is the right-side file explorer harming the operator workflow enough on the default route to justify demotion, collapse-by-default, or contextual mounting?
4. Can the current `draft.service.ts` and provider state be extended to support per-thread dock behavior without a new store?
5. Which expensive render paths are actually causing jank: markdown parsing, syntax highlighting, diff generation, DOM rebinding, image reflow, or all of the above?
6. Does shell migration require a real feature-flag mechanism, or is a route-local development toggle sufficient?

## Do-not-regress list

The redesign must preserve the following existing product capabilities.

1. Provider selection and provider-aware model flows must keep working.
2. Worktree flows must remain reachable and coherent.
3. Verification, debate, memory, VCS, and settings routes must remain accessible from the shell.
4. Instance selection, output streaming, and message sending must not regress semantically while the UI is being rearranged.
5. File drag-and-drop and attachment workflows must keep working if the shell layout changes around the composer and file explorer.
6. Existing IPC contracts should remain intact unless there is a deliberate, separately reviewed backend change.

## Suggested phase gates

Each phase should stop at a clear acceptance gate instead of bleeding into the next one.

## Gate A: After F1

Required:
- repeatable benchmark fixture exists
- baseline timings recorded
- at least one clearly identified hot path is proven with measurements

## Gate B: After F2

Required:
- default route reads as project/thread workspace first
- advanced route navigation still works
- no shell-level workflow is blocked by the layout change

## Gate C: After F3

Required:
- transcript is clearly dominant in the selected session
- review, child-agent, approval, and diagnostic surfaces remain one interaction away
- no feature is lost, only moved or reprioritized

## Gate D: After F4 and F5

Required:
- stable row identity replaces index-based tracking
- large-thread behavior is measurably better than baseline
- scroll restoration, stick-to-bottom, and expansion behavior remain sane

## Gate E: After F6 and F7

Required:
- typing remains responsive under streaming load
- provider/model changes still behave correctly
- memory and cache behavior stay bounded during prolonged use

## Gate F: After F8 through F10

Required:
- workspace and control-plane routes feel like one product
- orchestration capability remains discoverable
- no major backend-powered feature loses its UI path
