# SWE-bench 30-Task Comparison: Vanilla vs Orchestrator

## Overview

### Goal

Determine whether the orchestrator produces better patches than vanilla Claude Code on real-world software engineering tasks.

### Previous Run Context

**Session:** `swebench_2026-02-15T22-26-09` (5 astropy tasks)

**Results:**
- Both systems: 20% resolution rate (1/5 tasks)
- Orchestrator used 1.64x more tokens, 3.25x more time
- When both produced patches, they were character-for-character identical
- Orchestrator timed out on 40% of tasks (since addressed)
- **Conclusion:** Orchestrator NOT cost-justified for the tested sample

### This Run

**Scope:** 30 tasks across 6 repositories, 3 difficulty tiers
**Purpose:** Achieve statistically meaningful sample to determine if orchestrator provides value
**Hypothesis:** Multi-phase orchestration should help on harder tasks (>1500 byte gold patches)

### Statistical Threshold

With 30 tasks, we need ≥4 additional resolutions (13%+ improvement) for the orchestrator to be considered meaningfully better. Anything less suggests the extra cost isn't justified.

## Prerequisites

Before starting, ensure:

1. **Docker Desktop** is running (required for SWE-bench evaluation)
2. **SWE-bench dataset** downloaded at `data/swe-bench-lite.json`
3. **Python virtual environment** with swebench installed:
   ```bash
   cd benchmarks/external-benchmarks/swe-bench
   source venv/bin/activate
   pip install swebench
   ```
4. **Claude CLI** installed and configured with API key
5. **Node.js** and dependencies installed (`npm install` in benchmark directory)

### Budget Estimate

- **Token usage:** ~120M tokens total (~4M per task × 30 tasks)
- **Cost:** $15-20 USD (depending on caching)
- **Time:** 4-6 hours generation + 1-2 hours evaluation
- **Context window:** Fits within 200K token limit with budget-based phasing

## Task Sample (30 tasks)

### Easy Tier (10 tasks, gold patch < 650 bytes)

| # | Instance ID | Repo | Gold Patch Size |
|---|-------------|------|----------------|
| 1 | django__django-14534 | django/django | 386b |
| 2 | django__django-15400 | django/django | 446b |
| 3 | django__django-16255 | django/django | 539b |
| 4 | sympy__sympy-18057 | sympy/sympy | 391b |
| 5 | sympy__sympy-20212 | sympy/sympy | 410b |
| 6 | sympy__sympy-21614 | sympy/sympy | 461b |
| 7 | scikit-learn__scikit-learn-13779 | scikit-learn/scikit-learn | 563b |
| 8 | matplotlib__matplotlib-23314 | matplotlib/matplotlib | 421b |
| 9 | pytest-dev__pytest-7432 | pytest-dev/pytest | 456b |
| 10 | sphinx-doc__sphinx-8721 | sphinx-doc/sphinx | 573b |

### Medium Tier (12 tasks, gold patch 650-1500 bytes)

| # | Instance ID | Repo | Gold Patch Size |
|---|-------------|------|----------------|
| 11 | django__django-12700 | django/django | 675b |
| 12 | django__django-15498 | django/django | 770b |
| 13 | django__django-13590 | django/django | 823b |
| 14 | django__django-12286 | django/django | 919b |
| 15 | django__django-16910 | django/django | 940b |
| 16 | sympy__sympy-12236 | sympy/sympy | 669b |
| 17 | sympy__sympy-13471 | sympy/sympy | 747b |
| 18 | sympy__sympy-24066 | sympy/sympy | 883b |
| 19 | scikit-learn__scikit-learn-25747 | scikit-learn/scikit-learn | 746b |
| 20 | scikit-learn__scikit-learn-13142 | scikit-learn/scikit-learn | 1155b |
| 21 | matplotlib__matplotlib-25332 | matplotlib/matplotlib | 824b |
| 22 | pytest-dev__pytest-8365 | pytest-dev/pytest | 846b |

### Hard Tier (8 tasks, gold patch > 1500 bytes)

| # | Instance ID | Repo | Gold Patch Size |
|---|-------------|------|----------------|
| 23 | django__django-12589 | django/django | 1557b |
| 24 | django__django-13448 | django/django | 1589b |
| 25 | django__django-15819 | django/django | 1783b |
| 26 | sympy__sympy-16503 | sympy/sympy | 1521b |
| 27 | sympy__sympy-18835 | sympy/sympy | 1692b |
| 28 | scikit-learn__scikit-learn-10949 | scikit-learn/scikit-learn | 1521b |
| 29 | matplotlib__matplotlib-24970 | matplotlib/matplotlib | 1598b |
| 30 | pytest-dev__pytest-5495 | pytest-dev/pytest | 1657b |

### Repository Distribution

- **django/django:** 11 tasks (3 easy, 5 medium, 3 hard)
- **sympy/sympy:** 8 tasks (3 easy, 3 medium, 2 hard)
- **scikit-learn/scikit-learn:** 4 tasks (1 easy, 2 medium, 1 hard)
- **matplotlib/matplotlib:** 3 tasks (1 easy, 1 medium, 1 hard)
- **pytest-dev/pytest:** 3 tasks (1 easy, 1 medium, 1 hard)
- **sphinx-doc/sphinx:** 1 task (1 easy)

This distribution ensures we test across diverse codebases while maintaining balanced difficulty representation.

## Pre-Run Setup: Add --instance-ids Support

### Current Limitation

The runner currently only supports `--limit N` (first N tasks). We need to add `--instance-ids` flag support to cherry-pick specific tasks.

### Required Code Changes

#### 1. Update `types.ts`

Add `instanceIds` to `RunnerOptions`:

```typescript
export interface RunnerOptions {
  limit?: number;
  instanceIds?: string[];  // ADD THIS
  timeout?: number;
  resume?: boolean;
  sessionId?: string;
  evalOnly?: boolean;
  report?: boolean;
}
```

#### 2. Update `runner.ts` - parseArgs()

Add argument parsing for `--instance-ids`:

```typescript
function parseArgs(): RunnerOptions {
  const args = process.argv.slice(2);
  const options: RunnerOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    // ... existing args ...

    if (arg === '--instance-ids') {
      // Collect all subsequent args until next flag
      const ids: string[] = [];
      while (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        ids.push(args[++i]);
      }
      options.instanceIds = ids;
    }
  }

  return options;
}
```

#### 3. Update `runner.ts` - runBenchmark()

Filter tasks by instance IDs when provided:

```typescript
async function runBenchmark(options: RunnerOptions) {
  // ... load dataset ...

  let tasks = dataset.tasks;

  // Apply instance ID filter if provided
  if (options.instanceIds && options.instanceIds.length > 0) {
    tasks = tasks.filter(t => options.instanceIds!.includes(t.instance_id));
    console.log(`Filtered to ${tasks.length} tasks by instance IDs`);
  } else if (options.limit) {
    tasks = tasks.slice(0, options.limit);
  }

  // ... rest of benchmark logic ...
}
```

### Verification

After implementing, verify with:

```bash
npx tsx runner.ts --instance-ids django__django-14534 --limit 1
```

Should run only the django-14534 task, not the first task from the dataset.

## Execution Steps

### Step 1: Implement --instance-ids Flag

Follow the code changes in the "Pre-Run Setup" section above. Test with a single task to verify it works.

### Step 2: Run Benchmark Generation

Execute the full 30-task run:

```bash
cd benchmarks/external-benchmarks/swe-bench

npx tsx runner.ts \
  --instance-ids \
    django__django-14534 \
    django__django-15400 \
    django__django-16255 \
    sympy__sympy-18057 \
    sympy__sympy-20212 \
    sympy__sympy-21614 \
    scikit-learn__scikit-learn-13779 \
    matplotlib__matplotlib-23314 \
    pytest-dev__pytest-7432 \
    sphinx-doc__sphinx-8721 \
    django__django-12700 \
    django__django-15498 \
    django__django-13590 \
    django__django-12286 \
    django__django-16910 \
    sympy__sympy-12236 \
    sympy__sympy-13471 \
    sympy__sympy-24066 \
    scikit-learn__scikit-learn-25747 \
    scikit-learn__scikit-learn-13142 \
    matplotlib__matplotlib-25332 \
    pytest-dev__pytest-8365 \
    django__django-12589 \
    django__django-13448 \
    django__django-15819 \
    sympy__sympy-16503 \
    sympy__sympy-18835 \
    scikit-learn__scikit-learn-10949 \
    matplotlib__matplotlib-24970 \
    pytest-dev__pytest-5495 \
  --timeout 30
```

**Notes:**
- Default timeout is 30 minutes per task
- Can be interrupted (Ctrl+C) and resumed with `--resume --session <session-id>`
- Session ID is printed at start and saved to `runs/<session>/metadata.json`
- Estimated time: 4-6 hours (depends on task complexity and Claude API latency)
- Progress is logged to console and `runs/<session>/benchmark.log`

**Monitoring Progress:**

```bash
# Watch log in real-time
tail -f runs/swebench_<timestamp>/benchmark.log

# Check how many patches generated so far
ls runs/swebench_<timestamp>/patches/*.patch | wc -l
```

### Step 3: Evaluate Patches with Docker

After generation completes, evaluate all patches against the test suites:

```bash
npx tsx runner.ts --eval-only <session-id>
```

**Notes:**
- Requires Docker Desktop running
- Builds Docker containers for each repo (cached after first build)
- Runs tests in isolated containers
- Estimated time: 1-2 hours (depends on test suite size)
- Results saved to `runs/<session>/eval-results.json`

**Common Issues:**
- If Docker builds fail, ensure Docker Desktop has sufficient resources (4GB+ RAM)
- If tests timeout, individual tasks can be re-evaluated by deleting their entry from `eval-results.json` and re-running

### Step 4: Generate Report

```bash
npx tsx runner.ts --report <session-id>
```

Generates:
- `runs/<session>/report.md` - Detailed markdown report
- `runs/<session>/summary.json` - Machine-readable summary
- Console output with key metrics

## Evaluating Results

### Key Metrics to Compare

#### Overall Performance
- **Resolution rate:** Percentage of tasks where patch passes all tests
- **Token usage:** Total tokens and per-task average
- **Time per task:** Wall-clock time (includes retries, timeouts)
- **Timeout rate:** Percentage of tasks that hit 30-minute limit
- **Error rate:** Percentage of tasks that crashed or failed to produce patch

#### By Difficulty Tier
Compare resolution rates for:
- Easy tasks (< 650 byte gold patches)
- Medium tasks (650-1500 byte gold patches)
- Hard tasks (> 1500 byte gold patches)

**Expected pattern:** If orchestrator provides value, it should excel on hard tasks where multi-phase reasoning matters most.

#### By Repository
Compare resolution rates for:
- django/django (11 tasks)
- sympy/sympy (8 tasks)
- scikit-learn/scikit-learn (4 tasks)
- matplotlib/matplotlib (3 tasks)
- pytest-dev/pytest (3 tasks)
- sphinx-doc/sphinx (1 task)

**Expected pattern:** Some repos may favor orchestrator's structured approach (complex domains like sympy) while others may not benefit (simple CRUD fixes in django).

### Statistical Significance

With a sample size of 30 tasks:

- **≥4 additional resolutions (13%+ improvement):** Meaningful difference, suggests orchestrator provides real value
- **1-3 additional resolutions (3-10% improvement):** Marginal difference, could be noise or repo-specific
- **0 additional resolutions:** No advantage, orchestrator cost not justified
- **Negative improvement:** Orchestrator actively harmful (unlikely given previous 5-task parity)

**Cost-Effectiveness Threshold:**

For the orchestrator to be cost-justified, it should either:
1. Resolve significantly more tasks (≥13% improvement) at comparable token cost, OR
2. Resolve moderately more tasks (≥7% improvement) at <2x token cost

### Patch Quality Analysis

For tasks where both systems produce patches, examine:

#### Patch Similarity
- Are patches identical? (suggests same underlying reasoning path)
- Are patches semantically equivalent but stylistically different?
- Do they fix the same root cause via different approaches?

#### Test Coverage
- Does orchestrator add more test cases? (previous run showed this as one advantage)
- Are orchestrator's tests more comprehensive?
- Do orchestrator patches handle edge cases vanilla misses?

#### Code Quality
- Are orchestrator patches cleaner/more maintainable?
- Does orchestrator avoid introducing new bugs?
- Are orchestrator patches closer to the gold patch approach?

#### Investigation Method

For each task where both systems produced patches:

```bash
# Compare patches side-by-side
diff runs/<session>/patches/vanilla_<instance-id>.patch \
     runs/<session>/patches/orchestrator_<instance-id>.patch

# Compare against gold patch
diff runs/<session>/patches/vanilla_<instance-id>.patch \
     data/gold-patches/<instance-id>.patch
```

### Decision Framework

Based on results, use this framework to decide next steps:

#### Scenario A: Clear Win (≥4 extra resolutions, ≤2x token cost)
**Decision:** Invest in improving orchestrator
**Next steps:**
- Analyze what made orchestrator succeed on those tasks
- Optimize budget allocation (plan/implement/review ratios)
- Add task classification to route appropriate work to orchestrator
- Consider adding more phases for complex tasks

#### Scenario B: Marginal Improvement (1-3 extra resolutions)
**Decision:** Investigate deeply before committing
**Next steps:**
- Analyze failure modes: where did orchestrator still fail?
- Identify task characteristics where orchestrator helps (e.g., requires multi-file changes)
- Consider targeted improvements to orchestrator phases
- May not be worth general-purpose use, but could be valuable for specific task types

#### Scenario C: No Improvement (0 extra resolutions, or worse)
**Decision:** Orchestrator not justified for SWE-bench tasks
**Next steps:**
- Accept that structured orchestration doesn't help code generation
- Focus orchestrator on different use cases (research, analysis, planning)
- Consider whether SWE-bench measures the wrong thing (e.g., doesn't value test quality)
- Pivot to simpler vanilla approach for code generation workflows

#### Scenario D: Token Cost Too High (>2x tokens regardless of resolution improvement)
**Decision:** Optimize or abandon orchestrator
**Next steps:**
- Profile where tokens are wasted (verbose planning? redundant review?)
- Implement aggressive budget caps per phase
- Consider hybrid approach (orchestrate only on hard tasks)
- Calculate break-even point: how much improvement needed to justify cost?

## Previous Results (5-Task Baseline)

### Session: swebench_2026-02-15T22-26-09

| Task | Vanilla | Orchestrator | Notes |
|------|---------|--------------|-------|
| astropy-12907 | ❌ (211s, 3.56M tok) | ❌ (timeout, no patch) | Orchestrator timed out |
| astropy-14182 | ✅ (401s, 3.97M tok) | ✅ (481s, 6.50M tok) | Both resolved, identical patch |
| astropy-14365 | ❌ (89s, 1.15M tok) | ❌ (232s, 2.60M tok) | Both failed |
| astropy-14995 | ❌ (106s, 1.17M tok) | ❌ (268s, 2.63M tok) | Both failed |
| astropy-6938 | ❌ (64s, 403K tok) | ❌ (timeout, no patch) | Orchestrator timed out |

### Key Findings

**Resolution Rate:**
- Vanilla: 20% (1/5)
- Orchestrator: 20% (1/5)
- **No improvement**

**Resource Usage:**
- Orchestrator used 1.64x more tokens on average
- Orchestrator used 3.25x more time on average
- Orchestrator timed out on 40% of tasks (vs 0% for vanilla)

**Patch Quality:**
- When both produced patches, they were character-for-character identical
- No evidence of orchestrator adding value via better reasoning or test coverage

**Conclusion:**
Orchestrator was NOT cost-justified for the tested sample. However, sample size was too small (n=5) and all tasks were from a single repo (astropy). This 30-task run addresses both limitations.

## Improvements Made Since Last Run

The following improvements have been implemented to address issues from the 5-task run:

### 1. Budget-Based Phase Timing
- Default allocation: 40% plan / 40% implement / 20% review
- Unused time from early phases rolls forward to later phases
- Prevents premature timeouts during implementation phase
- Configurable via orchestrator settings

### 2. Graceful Timeout Recovery
- Partial output is now preserved if a phase times out
- Degraded completion instead of complete failure
- Logs warning but continues to next phase with partial results
- Should eliminate the 40% timeout rate from previous run

### 3. Turn Limit (--max-turns 25)
- Prevents infinite exploration loops
- Agent stops after 25 conversation turns even if task not complete
- Preserves partial work rather than burning entire budget
- Ensures timely completion

### 4. Smart Review Skipping
- Review phase skipped if implementation produced no output
- Avoids wasting budget reviewing nothing
- Automatically detected, no manual configuration needed

### 5. Configurable Timeout Propagation
- `--timeout` flag now properly propagated to Claude CLI adapter
- Per-task timeout enforced at orchestrator level
- Prevents runaway tasks from blocking entire benchmark
- Default: 30 minutes per task

### Expected Impact

These improvements should:
- Reduce timeout rate from 40% to near 0%
- Improve token efficiency (no wasted review of empty output)
- Maintain same or better resolution rate
- Provide better data for cost-benefit analysis

If orchestrator still shows no improvement with these fixes, it's strong evidence that structured orchestration doesn't help SWE-bench tasks.

## Execution Checklist

Use this checklist to track progress:

- [ ] Prerequisites verified (Docker, dataset, venv, Claude CLI)
- [ ] `--instance-ids` flag implemented in runner.ts
- [ ] `--instance-ids` flag tested with single task
- [ ] Full 30-task benchmark started
- [ ] Session ID recorded: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_
- [ ] Benchmark generation completed (4-6 hours)
- [ ] Patches generated for all 30 tasks (check `runs/<session>/patches/`)
- [ ] Docker evaluation started
- [ ] Docker evaluation completed (1-2 hours)
- [ ] Results verified in `runs/<session>/eval-results.json`
- [ ] Report generated (`runs/<session>/report.md`)
- [ ] Results analyzed using decision framework
- [ ] Decision made on orchestrator value
- [ ] Next steps identified

## Appendix: Quick Reference Commands

```bash
# Start new 30-task run
npx tsx runner.ts --instance-ids <30 IDs> --timeout 30

# Resume interrupted run
npx tsx runner.ts --resume --session swebench_<timestamp>

# Evaluate patches
npx tsx runner.ts --eval-only swebench_<timestamp>

# Generate report
npx tsx runner.ts --report swebench_<timestamp>

# Check progress
tail -f runs/swebench_<timestamp>/benchmark.log
ls runs/swebench_<timestamp>/patches/*.patch | wc -l

# Compare patches
diff runs/<session>/patches/vanilla_<id>.patch \
     runs/<session>/patches/orchestrator_<id>.patch

# Extract resolution rate from report
grep "Resolution rate:" runs/<session>/report.md
```
