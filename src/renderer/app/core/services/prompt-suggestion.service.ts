/**
 * Prompt Suggestion Service - Generates contextual ghost-text suggestions
 *
 * Uses priority-ordered rules to analyze conversation state and suggest
 * the next prompt the user might want to type. Suggestions appear as
 * ghost text in the input panel, accepted via Tab or Right Arrow.
 */

import { Injectable } from '@angular/core';
import type { OutputMessage, InstanceStatus } from '../../../../shared/types/instance.types';

export interface SuggestionContext {
  messages: OutputMessage[];
  status: InstanceStatus;
  hasFiles: boolean;
  currentText: string;
}

interface SuggestionRule {
  match: (ctx: SuggestionContext) => boolean;
  suggest: (ctx: SuggestionContext) => string;
}

function lastMsg(ctx: SuggestionContext): OutputMessage | undefined {
  return ctx.messages.length > 0 ? ctx.messages[ctx.messages.length - 1] : undefined;
}

function lastMsgType(ctx: SuggestionContext): string {
  return lastMsg(ctx)?.type ?? '';
}

function lastMsgContent(ctx: SuggestionContext): string {
  return lastMsg(ctx)?.content ?? '';
}

/** Check pattern against the tail of the last message (perf: avoids scanning huge content) */
function lastMsgHasPattern(ctx: SuggestionContext, pattern: RegExp): boolean {
  const content = lastMsgContent(ctx);
  return pattern.test(content.slice(-800));
}

/** Get the last meaningful line of the assistant message (for question detection) */
function lastMsgLastLine(ctx: SuggestionContext): string {
  const content = lastMsgContent(ctx).trim();
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  return lines.length > 0 ? lines[lines.length - 1].trim() : '';
}

@Injectable({ providedIn: 'root' })
export class PromptSuggestionService {
  private readonly rules: SuggestionRule[] = [
    // Rule 1: New/empty instance — starter prompt
    {
      match: (ctx) => ctx.messages.length === 0 && ctx.status === 'idle',
      suggest: () => 'Describe what you want to build...',
    },

    // Rule 2: Waiting for input — the CLI is literally asking for input
    {
      match: (ctx) => ctx.status === 'waiting_for_input',
      suggest: () => 'Yes, proceed',
    },

    // Rule 3: Assistant asked for y/n confirmation
    {
      match: (ctx) =>
        lastMsgType(ctx) === 'assistant' &&
        lastMsgHasPattern(ctx, /\b(?:y\/n|yes\/no|proceed\?|continue\?|shall I|should I|want me to|would you like)\b/i),
      suggest: () => 'Yes, go ahead',
    },

    // Rule 4: Assistant provided numbered options/choices
    {
      match: (ctx) =>
        lastMsgType(ctx) === 'assistant' &&
        lastMsgHasPattern(ctx, /(?:^|\n)\s*(?:1[.)]\s|option\s*1|choice\s*1|approach\s*1)/i),
      suggest: () => 'Go with option 1',
    },

    // Rule 5: After test results — suggest based on pass/fail
    {
      match: (ctx) =>
        lastMsgType(ctx) === 'assistant' &&
        lastMsgHasPattern(ctx, /test.*(?:pass|fail)|(?:pass|fail).*test|spec.*(?:pass|fail)/i),
      suggest: (ctx) =>
        lastMsgHasPattern(ctx, /fail/i)
          ? 'Fix the failing tests'
          : 'Looks good! Run the full test suite',
    },

    // Rule 6: After lint/type errors
    {
      match: (ctx) =>
        lastMsgType(ctx) === 'assistant' &&
        lastMsgHasPattern(ctx, /lint|eslint|tsc.*error|type.*error|compilation.*error/i),
      suggest: () => 'Fix the lint/type errors',
    },

    // Rule 7: Error message — suggest trying again
    {
      match: (ctx) =>
        lastMsgType(ctx) === 'error' ||
        (lastMsgType(ctx) === 'assistant' &&
          lastMsgHasPattern(ctx, /(?:error occurred|failed to|couldn't|unable to|exception)/i)),
      suggest: () => 'Can you try a different approach?',
    },

    // Rule 8: Assistant asked a question (last meaningful line ends with ?)
    {
      match: (ctx) =>
        ctx.status !== 'busy' &&
        lastMsgType(ctx) === 'assistant' &&
        lastMsgLastLine(ctx).endsWith('?'),
      suggest: () => 'Yes',
    },

    // Rule 9: After file creation/writing
    {
      match: (ctx) =>
        lastMsgType(ctx) === 'assistant' &&
        lastMsgHasPattern(ctx, /(?:created|wrote|saved|generated)\b/i) &&
        lastMsgHasPattern(ctx, /(?:file|\.ts|\.js|\.py|\.md|\.css|\.html)/i),
      suggest: () => 'Now run the tests to verify',
    },

    // Rule 10: Task completion — assistant says done/complete
    {
      match: (ctx) =>
        ctx.status === 'idle' &&
        lastMsgType(ctx) === 'assistant' &&
        lastMsgHasPattern(ctx, /(?:done|complete|finished|ready|implemented|fixed|updated|applied)/i),
      suggest: () => 'Thanks! Can you run the tests?',
    },

    // Rule 11: General idle with conversation — fallback
    {
      match: (ctx) =>
        ctx.status === 'idle' &&
        ctx.messages.length > 0 &&
        lastMsgType(ctx) === 'assistant',
      suggest: () => 'Continue',
    },
  ];

  /**
   * Generate a suggestion based on conversation context.
   * Returns null if no suggestion is appropriate.
   */
  getSuggestion(context: SuggestionContext): string | null {
    // Don't suggest while busy or when user has typed something
    if (context.status === 'busy' || context.status === 'initializing') {
      return null;
    }

    // Don't suggest if user already has text (prefix matching handled by component)
    if (context.currentText) {
      return null;
    }

    for (const rule of this.rules) {
      if (rule.match(context)) {
        return rule.suggest(context);
      }
    }

    return null;
  }
}
