/**
 * SWE-bench Adapter - Wraps Claude CLI for SWE-bench task execution
 *
 * Takes a SWE-bench problem statement and generates a patch using
 * either vanilla Claude or the orchestrator.
 */

import { spawn } from 'child_process';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import type { SWEBenchTask, SWEBenchResult } from './types.js';

const DEFAULT_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes per task

/** Phase time budgets as fractions of the total timeout */
const PHASE_BUDGETS = {
  plan: 0.40,     // 40% — explore + plan
  implement: 0.40, // 40% — generate patch
  review: 0.20,    // 20% — validate/refine
} as const;

/**
 * Generate a patch using vanilla Claude CLI
 */
export async function generatePatchVanilla(
  task: SWEBenchTask,
  workDir: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<SWEBenchResult> {
  const startTime = Date.now();
  const startedAt = startTime;

  try {
    const prompt = buildSWEBenchPrompt(task, 'vanilla');
    const output = await invokeClaude(prompt, workDir, timeoutMs);

    // Parse JSON response for token usage
    const { content, inputTokens, outputTokens } = parseClaudeOutput(output);

    // Extract patch from output
    const patch = extractPatchFromOutput(content);

    if (!patch) {
      return {
        instanceId: task.instanceId,
        system: 'vanilla',
        patch: '',
        resolved: false,
        tokensUsed: inputTokens + outputTokens,
        inputTokens,
        outputTokens,
        durationMs: Date.now() - startTime,
        agentTurns: 1,
        startedAt,
        completedAt: Date.now(),
        error: 'Failed to extract patch from model output',
      };
    }

    return {
      instanceId: task.instanceId,
      system: 'vanilla',
      patch,
      resolved: false, // Will be determined by evaluation
      tokensUsed: inputTokens + outputTokens,
      inputTokens,
      outputTokens,
      durationMs: Date.now() - startTime,
      agentTurns: 1,
      startedAt,
      completedAt: Date.now(),
    };
  } catch (error) {
    return {
      instanceId: task.instanceId,
      system: 'vanilla',
      patch: '',
      resolved: false,
      tokensUsed: 0,
      inputTokens: 0,
      outputTokens: 0,
      durationMs: Date.now() - startTime,
      agentTurns: 1,
      startedAt,
      completedAt: Date.now(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Generate a patch using orchestrator-style multi-agent coordination
 *
 * Uses a budget-based timeout system: the total timeout is divided across
 * phases, with unused time from earlier phases rolling forward. Each phase
 * has graceful degradation — if it times out, we recover partial output
 * and continue with subsequent phases using whatever context we have.
 *
 * Phases:
 * 1. Planning — explore repo and analyze the issue
 * 2. Implementation — generate the patch based on the plan
 * 3. Review — validate and refine (skipped if time is tight or patch looks good)
 */
export async function generatePatchOrchestrator(
  task: SWEBenchTask,
  workDir: string,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<SWEBenchResult> {
  const startTime = Date.now();
  const startedAt = startTime;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let agentTurns = 0;
  const totalBudgetMs = timeoutMs;

  /** Calculate remaining time budget */
  const remainingMs = () => totalBudgetMs - (Date.now() - startTime);

  /** Minimum time to bother starting a phase (2 minutes) */
  const MIN_PHASE_MS = 2 * 60 * 1000;

  try {
    // ── Phase 1: Planning ──────────────────────────────────────────
    const planBudgetMs = Math.min(
      totalBudgetMs * PHASE_BUDGETS.plan,
      remainingMs() - MIN_PHASE_MS // leave room for at least one more phase
    );

    let planContent = '';
    if (planBudgetMs >= MIN_PHASE_MS) {
      const planPrompt = buildPlanningPrompt(task);
      const planOutput = await invokeClaudeGraceful(planPrompt, workDir, planBudgetMs);
      const planResult = parseClaudeOutput(planOutput.output);
      totalInputTokens += planResult.inputTokens;
      totalOutputTokens += planResult.outputTokens;
      agentTurns++;
      planContent = planResult.content;

      if (planOutput.timedOut) {
        console.log('      ⏱️  Planning phase timed out, continuing with partial plan');
      }
    }

    // ── Phase 2: Implementation ────────────────────────────────────
    // Give implementation all remaining time minus review budget
    const reviewReserveMs = Math.max(MIN_PHASE_MS, totalBudgetMs * PHASE_BUDGETS.review);
    const implBudgetMs = Math.max(MIN_PHASE_MS, remainingMs() - reviewReserveMs);

    let implContent = '';
    let implPatch = '';
    if (implBudgetMs >= MIN_PHASE_MS) {
      const implPrompt = planContent
        ? buildImplementationPrompt(task, planContent)
        : buildSWEBenchPrompt(task, 'orchestrator'); // Fallback: act like vanilla if no plan
      const implOutput = await invokeClaudeGraceful(implPrompt, workDir, implBudgetMs);
      const implResult = parseClaudeOutput(implOutput.output);
      totalInputTokens += implResult.inputTokens;
      totalOutputTokens += implResult.outputTokens;
      agentTurns++;
      implContent = implResult.content;
      implPatch = extractPatchFromOutput(implContent);

      if (implOutput.timedOut) {
        console.log('      ⏱️  Implementation phase timed out, attempting patch recovery');
      }
    }

    // ── Phase 3: Review (optional) ─────────────────────────────────
    // Skip review if: no time left, no implementation content, or we already have a clean patch
    const reviewBudgetMs = remainingMs();
    let reviewPatch = '';

    const shouldSkipReview =
      reviewBudgetMs < MIN_PHASE_MS ||
      !implContent ||
      !implPatch; // no point reviewing if there's nothing to review

    if (!shouldSkipReview) {
      const reviewPrompt = buildReviewPrompt(task, implContent);
      const reviewOutput = await invokeClaudeGraceful(reviewPrompt, workDir, reviewBudgetMs);
      const reviewResult = parseClaudeOutput(reviewOutput.output);
      totalInputTokens += reviewResult.inputTokens;
      totalOutputTokens += reviewResult.outputTokens;
      agentTurns++;
      reviewPatch = extractPatchFromOutput(reviewResult.content);

      if (reviewOutput.timedOut) {
        console.log('      ⏱️  Review phase timed out, using implementation patch');
      }
    }

    // ── Select best patch ──────────────────────────────────────────
    // Prefer review patch (refined) > implementation patch > plan patch (rare)
    const patch = reviewPatch || implPatch || extractPatchFromOutput(planContent);

    if (!patch) {
      return {
        instanceId: task.instanceId,
        system: 'orchestrator',
        patch: '',
        resolved: false,
        tokensUsed: totalInputTokens + totalOutputTokens,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        durationMs: Date.now() - startTime,
        agentTurns,
        startedAt,
        completedAt: Date.now(),
        error: 'Failed to extract patch from orchestrator output',
      };
    }

    return {
      instanceId: task.instanceId,
      system: 'orchestrator',
      patch,
      resolved: false, // Will be determined by evaluation
      tokensUsed: totalInputTokens + totalOutputTokens,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      durationMs: Date.now() - startTime,
      agentTurns,
      startedAt,
      completedAt: Date.now(),
    };
  } catch (error) {
    return {
      instanceId: task.instanceId,
      system: 'orchestrator',
      patch: '',
      resolved: false,
      tokensUsed: totalInputTokens + totalOutputTokens,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
      durationMs: Date.now() - startTime,
      agentTurns,
      startedAt,
      completedAt: Date.now(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Build the main prompt for vanilla Claude
 */
function buildSWEBenchPrompt(task: SWEBenchTask, mode: 'vanilla' | 'orchestrator'): string {
  const hintsSection = task.hints_text ? `\n\nHints:\n${task.hints_text}` : '';

  return `You are an expert software engineer. You are in a cloned checkout of the ${task.repo} repository at commit ${task.baseCommit.substring(0, 12)} (version ${task.version}). The repository source code is in the current working directory.

Issue Description:
${task.problem_statement}${hintsSection}

Your task:
1. Explore the repository to understand the relevant code (use grep, find, cat etc.)
2. Identify the root cause of the issue
3. Make the minimal code changes needed to fix the issue
4. Generate a unified diff patch of your changes

IMPORTANT INSTRUCTIONS:
- Explore the codebase first. The full source is available in the current directory.
- Output your final patch in unified diff format, enclosed in a \`\`\`diff code block.
- The patch must be a valid unified diff with proper context lines (3 lines before/after)
- Include file paths relative to the repository root
- The patch must apply cleanly with \`git apply\`
- Make minimal changes — fix only what's needed

Generate the patch now:`;
}

/**
 * Build planning prompt for orchestrator
 */
function buildPlanningPrompt(task: SWEBenchTask): string {
  const hintsSection = task.hints_text ? `\n\nHints:\n${task.hints_text}` : '';

  return `You are a planning agent in a software engineering team. You are in a cloned checkout of the ${task.repo} repository at commit ${task.baseCommit.substring(0, 12)} (version ${task.version}). The full source code is in the current working directory.

Issue Description:
${task.problem_statement}${hintsSection}

Explore the repository to understand the relevant code. Then create a detailed plan:
1. Root cause analysis - what is the underlying issue? (cite specific files and line numbers)
2. Affected files - which files need to be modified?
3. Solution approach - how should this be fixed?
4. Edge cases - what scenarios should be handled?
5. Testing strategy - how to verify the fix?

Provide your analysis and plan:`;
}

/**
 * Build implementation prompt for orchestrator
 */
function buildImplementationPrompt(task: SWEBenchTask, plan: string): string {
  return `You are an implementation agent. Based on the following plan, generate a patch to fix the issue.

Issue: ${task.instanceId}
Repository: ${task.repo}

Plan from planning agent:
${plan}

Now generate a unified diff patch that implements this plan. The patch must:
- Be a valid unified diff format
- Include all necessary file changes
- Apply cleanly to base commit ${task.baseCommit}
- Handle all edge cases mentioned in the plan

Output the patch enclosed in a \`\`\`diff code block:`;
}

/**
 * Build review prompt for orchestrator
 */
function buildReviewPrompt(task: SWEBenchTask, implementation: string): string {
  return `You are a review agent. Review and validate the following patch implementation.

Issue: ${task.instanceId}
Repository: ${task.repo}

Implementation:
${implementation}

Review the patch for:
1. Correctness - does it solve the issue?
2. Completeness - are all cases handled?
3. Code quality - is it well-structured?
4. Potential issues - any bugs or edge cases?

If the patch is good, output it in final form in a \`\`\`diff code block.
If it needs fixes, provide the corrected patch in a \`\`\`diff code block.

Final patch:`;
}

/**
 * Extract unified diff patch from model output
 */
export function extractPatchFromOutput(output: string): string {
  // Try to extract from ```diff code block
  const diffBlockMatch = output.match(/```diff\s*\n([\s\S]*?)\n```/);
  if (diffBlockMatch) {
    return diffBlockMatch[1].trim();
  }

  // Try to extract from plain ```  block
  const codeBlockMatch = output.match(/```\s*\n([\s\S]*?)\n```/);
  if (codeBlockMatch) {
    const content = codeBlockMatch[1].trim();
    // Check if it looks like a diff
    if (content.includes('diff --git') || content.includes('---') && content.includes('+++')) {
      return content;
    }
  }

  // Look for git format-patch style
  const gitPatchMatch = output.match(/diff --git[\s\S]*?(?=\n(?:diff --git|$))/g);
  if (gitPatchMatch && gitPatchMatch.length > 0) {
    return gitPatchMatch.join('\n').trim();
  }

  // Look for unified diff markers (--- and +++)
  const unifiedDiffMatch = output.match(/^---[\s\S]*?\+\+\+[\s\S]*?(?=\n(?:---|$))/m);
  if (unifiedDiffMatch) {
    return unifiedDiffMatch[0].trim();
  }

  // No patch found
  return '';
}

/**
 * Invoke Claude CLI and capture output.
 * On timeout, rejects with an error (no partial recovery).
 */
function invokeClaude(prompt: string, workDir: string, timeoutMs: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = buildClaudeArgs();
    const env = buildClaudeEnv();

    const child = spawn('claude', args, {
      cwd: workDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Claude CLI exited with code ${code}:\n${stderr}`));
      } else {
        resolve(stdout);
      }
    });

    child.on('error', (error) => {
      reject(new Error(`Failed to spawn Claude CLI: ${error.message}`));
    });

    child.stdin.write(prompt);
    child.stdin.end();

    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error(`Claude CLI timeout after ${timeoutMs}ms`));
    }, timeoutMs);

    child.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

/**
 * Invoke Claude CLI with graceful timeout handling.
 * On timeout, returns whatever partial output has been captured so far
 * instead of throwing. This allows later phases to continue with
 * partial context rather than losing everything.
 */
function invokeClaudeGraceful(
  prompt: string,
  workDir: string,
  timeoutMs: number
): Promise<{ output: string; timedOut: boolean }> {
  return new Promise((resolve) => {
    const args = buildClaudeArgs();
    const env = buildClaudeEnv();

    const child = spawn('claude', args, {
      cwd: workDir,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let didTimeout = false;

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      if (didTimeout) {
        // Return partial output on timeout
        resolve({ output: stdout, timedOut: true });
      } else if (code !== 0) {
        // Non-zero exit but not timeout — still return what we have
        resolve({ output: stdout || stderr, timedOut: false });
      } else {
        resolve({ output: stdout, timedOut: false });
      }
    });

    child.on('error', (error) => {
      // Spawn failure — resolve with empty output so orchestrator can continue
      resolve({ output: '', timedOut: false });
    });

    child.stdin.write(prompt);
    child.stdin.end();

    const timeout = setTimeout(() => {
      didTimeout = true;
      child.kill('SIGTERM');
      // Give the process 5s to write final output before SIGKILL
      setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* already dead */ }
      }, 5000);
    }, timeoutMs);

    child.on('close', () => {
      clearTimeout(timeout);
    });
  });
}

/** Build common Claude CLI arguments */
function buildClaudeArgs(): string[] {
  return [
    '--print',
    '--output-format', 'json',
    '--dangerously-skip-permissions',
    '--max-turns', '25',  // Prevent runaway exploration loops
  ];
}

/** Build environment for Claude CLI (strip CLAUDECODE to allow nesting) */
function buildClaudeEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env['CLAUDECODE'];
  return env;
}

/**
 * Parse Claude CLI JSON output to extract content and token usage
 */
function parseClaudeOutput(output: string): {
  content: string;
  inputTokens: number;
  outputTokens: number;
} {
  try {
    // Claude CLI --print --output-format json produces a single JSON object
    // with type "result" containing the response in `result` field
    const lines = output.trim().split('\n');
    let content = '';
    let inputTokens = 0;
    let outputTokens = 0;

    for (const line of lines) {
      if (!line.trim()) continue;

      try {
        const json = JSON.parse(line);

        // Handle the result object (from --print --output-format json)
        if (json.type === 'result' && json.result) {
          content += json.result;

          // Extract token usage from the result object
          if (json.usage) {
            inputTokens += json.usage.input_tokens || 0;
            outputTokens += json.usage.output_tokens || 0;
            // Also check cache tokens as part of input
            inputTokens += json.usage.cache_read_input_tokens || 0;
            inputTokens += json.usage.cache_creation_input_tokens || 0;
          }

          // Extract from modelUsage breakdown if available
          if (json.modelUsage) {
            for (const model of Object.values(json.modelUsage) as any[]) {
              inputTokens += model.inputTokens || 0;
              inputTokens += model.cacheReadInputTokens || 0;
              inputTokens += model.cacheCreationInputTokens || 0;
              outputTokens += model.outputTokens || 0;
            }
          }

          continue;
        }

        // Handle streaming assistant messages
        if (json.type === 'assistant' || json.type === 'content') {
          content += json.content || json.text || '';
        }

        // Extract token usage from other message types
        if (json.usage && json.type !== 'result') {
          inputTokens += json.usage.input_tokens || 0;
          outputTokens += json.usage.output_tokens || 0;
        }
      } catch {
        // Not JSON, might be plain text - append to content
        content += line + '\n';
      }
    }

    // Fallback: if no JSON parsing succeeded, treat entire output as content
    if (!content && output) {
      content = output;
    }

    return { content: content.trim(), inputTokens, outputTokens };
  } catch {
    // Fallback: treat entire output as content
    return { content: output.trim(), inputTokens: 0, outputTokens: 0 };
  }
}

/**
 * Write a patch to disk
 */
export function writePatch(patch: string, outputPath: string): void {
  writeFileSync(outputPath, patch, 'utf-8');
}

/**
 * Read a patch from disk
 */
export function readPatch(patchPath: string): string {
  if (!existsSync(patchPath)) {
    throw new Error(`Patch file not found: ${patchPath}`);
  }
  return readFileSync(patchPath, 'utf-8');
}
