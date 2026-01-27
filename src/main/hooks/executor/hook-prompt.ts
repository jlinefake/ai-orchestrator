/**
 * Hook Prompt Module
 *
 * Prompt evaluation for hooks using Anthropic API.
 */

import type Anthropic from '@anthropic-ai/sdk';
import { CLAUDE_MODELS } from '../../../shared/types/provider.types';
import type {
  EnhancedHookConfig,
  HookExecutionContext,
  HookExecutionResult,
  HookAction
} from './hook-types';
import { interpolateString } from './hook-utils';

/**
 * Execute a prompt hook.
 */
export async function executePrompt(
  hook: EnhancedHookConfig,
  context: HookExecutionContext,
  anthropic: Anthropic | null
): Promise<HookExecutionResult> {
  const startTime = Date.now();
  const handler = hook.handler;
  const prompt = interpolateString(handler.prompt || '', context);

  if (context.dryRun) {
    return {
      hookId: hook.id,
      hookName: hook.name,
      success: true,
      action: 'allow',
      output: `[DRY RUN] Would evaluate prompt: ${prompt.slice(0, 100)}...`,
      duration: Date.now() - startTime,
      timestamp: startTime
    };
  }

  if (!anthropic) {
    return {
      hookId: hook.id,
      hookName: hook.name,
      success: false,
      action: 'skip',
      error: 'Anthropic client not initialized for prompt hooks',
      duration: Date.now() - startTime,
      timestamp: startTime
    };
  }

  try {
    const response = await anthropic.messages.create({
      model: handler.model || CLAUDE_MODELS.HAIKU,
      max_tokens: 1024,
      system: `You are a security and code review assistant evaluating whether a tool call should be allowed.

Respond with a JSON object:
- action: "allow", "block", or "modify"
- reason: explanation of your decision
- modification: (optional) modified parameters if action is "modify"

Be concise and security-focused.`,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const responseText =
      response.content[0].type === 'text' ? response.content[0].text : '';

    // Parse response
    try {
      const parsed = JSON.parse(responseText);
      return {
        hookId: hook.id,
        hookName: hook.name,
        success: true,
        action: (parsed.action || 'allow') as HookAction,
        output: parsed.reason,
        blockReason: parsed.action === 'block' ? parsed.reason : undefined,
        modifiedData: parsed.modification,
        duration: Date.now() - startTime,
        timestamp: startTime
      };
    } catch {
      // Non-JSON response, assume allow
      return {
        hookId: hook.id,
        hookName: hook.name,
        success: true,
        action: 'allow',
        output: responseText,
        duration: Date.now() - startTime,
        timestamp: startTime
      };
    }
  } catch (error) {
    return {
      hookId: hook.id,
      hookName: hook.name,
      success: false,
      action: 'skip',
      error: (error as Error).message,
      duration: Date.now() - startTime,
      timestamp: startTime
    };
  }
}
