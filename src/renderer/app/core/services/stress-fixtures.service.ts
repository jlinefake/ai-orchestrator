/**
 * Stress Fixtures Service
 *
 * Generates synthetic data for stress-testing the operator workspace.
 * Covers scenarios identified in the performance doctrine:
 * - Long markdown transcripts
 * - Many tool events
 * - Image attachments
 * - Multiple active sessions
 * - Mixed content types
 *
 * Usage: Inject and call generate methods, or access via the dev console:
 *   window.__stressFixtures?.generateLargeTranscript(500)
 */

import { Injectable } from '@angular/core';
import type { OutputMessage } from '../../core/state/instance/instance.types';

export interface StressFixtureConfig {
  messageCount: number;
  includeThinking: boolean;
  includeToolCalls: boolean;
  includeImages: boolean;
  includeCodeBlocks: boolean;
  includeTables: boolean;
  longMarkdown: boolean;
}

const DEFAULT_CONFIG: StressFixtureConfig = {
  messageCount: 200,
  includeThinking: true,
  includeToolCalls: true,
  includeImages: false,
  includeCodeBlocks: true,
  includeTables: true,
  longMarkdown: true,
};

@Injectable({ providedIn: 'root' })
export class StressFixturesService {
  private counter = 0;

  // ============================================
  // Message Generators
  // ============================================

  /**
   * Generate a large transcript of OutputMessages for testing.
   */
  generateTranscript(count: number, config: Partial<StressFixtureConfig> = {}): OutputMessage[] {
    const cfg = { ...DEFAULT_CONFIG, ...config, messageCount: count };
    const messages: OutputMessage[] = [];
    const baseTime = Date.now() - count * 2000; // Space messages 2s apart

    for (let i = 0; i < count; i++) {
      const timestamp = baseTime + i * 2000;
      const msgType = this.pickMessageType(i, cfg);

      switch (msgType) {
        case 'user':
          messages.push(this.generateUserMessage(i, timestamp));
          break;
        case 'assistant':
          messages.push(this.generateAssistantMessage(i, timestamp, cfg));
          break;
        case 'tool_use':
          messages.push(this.generateToolUseMessage(i, timestamp));
          messages.push(this.generateToolResultMessage(i, timestamp + 500));
          break;
        case 'thinking':
          messages.push(this.generateThinkingMessage(i, timestamp));
          break;
        case 'system':
          messages.push(this.generateSystemMessage(i, timestamp));
          break;
      }
    }

    return messages;
  }

  /**
   * Generate a transcript focused on long markdown content.
   */
  generateLongMarkdownTranscript(count: number): OutputMessage[] {
    return this.generateTranscript(count, {
      longMarkdown: true,
      includeCodeBlocks: true,
      includeTables: true,
      includeToolCalls: false,
    });
  }

  /**
   * Generate a transcript focused on tool calls (many tool events).
   */
  generateToolHeavyTranscript(count: number): OutputMessage[] {
    return this.generateTranscript(count, {
      includeToolCalls: true,
      longMarkdown: false,
      includeThinking: false,
    });
  }

  /**
   * Generate a transcript with mixed heavy content.
   */
  generateMixedHeavyTranscript(count: number): OutputMessage[] {
    return this.generateTranscript(count, {
      includeThinking: true,
      includeToolCalls: true,
      includeCodeBlocks: true,
      includeTables: true,
      longMarkdown: true,
    });
  }

  // ============================================
  // Content Generators
  // ============================================

  private generateUserMessage(index: number, timestamp: number): OutputMessage {
    const prompts = [
      'Can you refactor the authentication module to use JWT tokens?',
      'Please fix the performance issue in the dashboard component.',
      'Add unit tests for the new validation logic.',
      'Review the API response handling and suggest improvements.',
      `Update the database schema to support multi-tenancy.\n\nHere's the current schema:\n\`\`\`sql\nCREATE TABLE users (\n  id SERIAL PRIMARY KEY,\n  email VARCHAR(255) NOT NULL,\n  name VARCHAR(255)\n);\n\`\`\``,
      'Can you explain how the event system works? I need to understand the flow from emit to handler.',
      'Please implement the file upload feature with drag and drop support, progress tracking, and error handling.',
    ];

    return {
      id: this.nextId(),
      timestamp,
      type: 'user',
      content: prompts[index % prompts.length],
    };
  }

  private generateAssistantMessage(index: number, timestamp: number, cfg: StressFixtureConfig): OutputMessage {
    let content = '';

    if (cfg.longMarkdown) {
      content = this.generateLongMarkdown(index);
    } else {
      content = this.generateShortResponse(index);
    }

    if (cfg.includeCodeBlocks && index % 3 === 0) {
      content += '\n\n' + this.generateCodeBlock(index);
    }

    if (cfg.includeTables && index % 5 === 0) {
      content += '\n\n' + this.generateTable();
    }

    return {
      id: this.nextId(),
      timestamp,
      type: 'assistant',
      content,
    };
  }

  private generateThinkingMessage(index: number, timestamp: number): OutputMessage {
    return {
      id: this.nextId(),
      timestamp,
      type: 'assistant',
      content: this.generateShortResponse(index),
      thinking: [
        {
          id: `think-${this.nextId()}`,
          content: `Let me analyze this step by step.\n\nFirst, I need to understand the current implementation. The code uses a ${index % 2 === 0 ? 'factory pattern' : 'singleton pattern'} which means...\n\nI should consider:\n1. Performance implications of the change\n2. Backward compatibility\n3. Test coverage requirements\n4. Edge cases around null values and empty arrays\n\nAfter careful analysis, I believe the best approach is to refactor the ${index % 3 === 0 ? 'service layer' : 'controller'} to use dependency injection more effectively. This will make the code more testable and maintainable.`,
          format: 'structured' as const,
        },
      ],
    };
  }

  private generateToolUseMessage(index: number, timestamp: number): OutputMessage {
    const tools = [
      { name: 'Read', input: { file_path: `/src/components/Dashboard.tsx` } },
      { name: 'Edit', input: { file_path: `/src/utils/auth.ts`, old_string: 'const token = getToken()', new_string: 'const token = await getJWTToken()' } },
      { name: 'Bash', input: { command: 'npm run test -- --coverage' } },
      { name: 'Grep', input: { pattern: 'TODO|FIXME|HACK', path: 'src/' } },
      { name: 'Write', input: { file_path: '/src/types/api.ts', content: 'export interface ApiResponse<T> { data: T; error?: string; }' } },
      { name: 'Glob', input: { pattern: 'src/**/*.spec.ts' } },
    ];

    const tool = tools[index % tools.length];

    return {
      id: this.nextId(),
      timestamp,
      type: 'tool_use',
      content: '',
      metadata: {
        name: tool.name,
        input: tool.input,
      },
    };
  }

  private generateToolResultMessage(index: number, timestamp: number): OutputMessage {
    const results = [
      '// File contents displayed successfully\nimport { Component } from \'@angular/core\';\n\n@Component({\n  selector: \'app-dashboard\',\n  template: `<div>Dashboard content</div>`\n})\nexport class DashboardComponent {}',
      'Edit applied successfully.',
      'PASS src/utils/auth.spec.ts\n  Authentication\n    ✓ should generate valid JWT (12ms)\n    ✓ should reject expired tokens (8ms)\n    ✓ should handle refresh tokens (15ms)\n\nTest Suites: 1 passed, 1 total\nTests: 3 passed, 3 total',
      'src/utils/helpers.ts:42: // TODO: optimize this loop\nsrc/services/api.ts:118: // FIXME: handle timeout',
      'File written successfully.',
      'src/auth/auth.spec.ts\nsrc/utils/helpers.spec.ts\nsrc/services/api.spec.ts',
    ];

    return {
      id: this.nextId(),
      timestamp,
      type: 'tool_result',
      content: results[index % results.length],
      metadata: { status: 'success' },
    };
  }

  private generateSystemMessage(index: number, timestamp: number): OutputMessage {
    const systemMessages = [
      'Context window usage: 45% (90,000 / 200,000 tokens)',
      'Instance restarted due to context overflow.',
      'Auto-compaction triggered at 80% context usage.',
    ];

    return {
      id: this.nextId(),
      timestamp,
      type: 'system',
      content: systemMessages[index % systemMessages.length],
    };
  }

  // ============================================
  // Content Templates
  // ============================================

  private generateLongMarkdown(index: number): string {
    const sections = [
      `## Analysis of Component ${index}\n\nAfter reviewing the codebase, I've identified several areas that need attention. The current implementation has **${3 + (index % 5)} critical issues** that should be addressed before the next release.\n\n### Key Findings\n\n1. **Memory Leak**: The subscription in \`useEffect\` is not being cleaned up properly\n2. **Race Condition**: Multiple concurrent API calls can result in stale state\n3. **Type Safety**: Several \`any\` types should be replaced with proper interfaces\n\n> **Note:** These issues are particularly impactful in production environments with high traffic.\n\nThe recommended approach is to:\n- First, add proper cleanup in the effect hooks\n- Then, implement request cancellation using AbortController\n- Finally, define strict TypeScript interfaces for all API responses`,

      `### Implementation Plan\n\nHere's a detailed breakdown of the changes needed:\n\n#### Phase 1: Foundation\n- Set up the new module structure\n- Create base interfaces and types\n- Add configuration for the feature flags\n\n#### Phase 2: Core Logic\n- Implement the main processing pipeline\n- Add validation and error handling\n- Create unit tests for all business logic\n\n#### Phase 3: Integration\n- Wire up the UI components\n- Add E2E tests\n- Update documentation\n\n---\n\nEach phase should take approximately 2-3 days. The total estimated effort is **1 week** for a single developer.`,

      `### Performance Optimization Results\n\nI've completed the performance audit. Here are the results:\n\n| Metric | Before | After | Improvement |\n|--------|--------|-------|-------------|\n| First Paint | 2.4s | 0.8s | 67% |\n| TTI | 4.1s | 1.2s | 71% |\n| Bundle Size | 450KB | 180KB | 60% |\n| Memory (peak) | 128MB | 45MB | 65% |\n\nThe most impactful changes were:\n1. Code splitting the dashboard module\n2. Lazy loading images below the fold\n3. Replacing moment.js with date-fns\n4. Implementing virtual scrolling for long lists`,
    ];

    return sections[index % sections.length];
  }

  private generateShortResponse(index: number): string {
    const responses = [
      'I\'ll make that change now. Let me update the file.',
      'Good point. Let me check the implementation.',
      'The tests are passing. Here\'s what I changed.',
      'I found the issue. It\'s in the event handler.',
      'Done. The refactoring is complete.',
    ];
    return responses[index % responses.length];
  }

  private generateCodeBlock(index: number): string {
    const blocks = [
      '```typescript\nexport class AuthService {\n  private tokenCache = new Map<string, Token>();\n\n  async authenticate(credentials: Credentials): Promise<AuthResult> {\n    const existing = this.tokenCache.get(credentials.userId);\n    if (existing && !this.isExpired(existing)) {\n      return { token: existing, cached: true };\n    }\n\n    const token = await this.provider.generateToken(credentials);\n    this.tokenCache.set(credentials.userId, token);\n    return { token, cached: false };\n  }\n\n  private isExpired(token: Token): boolean {\n    return Date.now() > token.expiresAt;\n  }\n}\n```',

      '```python\ndef process_batch(items: list[dict], batch_size: int = 100) -> list[Result]:\n    """Process items in batches with retry logic."""\n    results = []\n    for i in range(0, len(items), batch_size):\n        batch = items[i:i + batch_size]\n        try:\n            batch_results = api.submit(batch)\n            results.extend(batch_results)\n        except RateLimitError:\n            time.sleep(60)\n            batch_results = api.submit(batch)\n            results.extend(batch_results)\n    return results\n```',

      '```css\n.workspace-layout {\n  display: grid;\n  grid-template-columns: 280px 1fr;\n  grid-template-rows: auto 1fr auto;\n  height: 100vh;\n  gap: 0;\n}\n\n.sidebar {\n  grid-row: 1 / -1;\n  background: var(--bg-secondary);\n  border-right: 1px solid var(--border-color);\n  overflow-y: auto;\n}\n\n.transcript {\n  grid-column: 2;\n  grid-row: 2;\n  overflow-y: auto;\n  padding: var(--spacing-lg);\n}\n```',
    ];

    return blocks[index % blocks.length];
  }

  private generateTable(): string {
    return `| File | Lines Changed | Status |\n|------|--------------|--------|\n| src/auth/service.ts | +45 / -12 | Modified |\n| src/auth/types.ts | +22 / -0 | Added |\n| src/auth/service.spec.ts | +89 / -0 | Added |\n| src/config/auth.config.ts | +8 / -3 | Modified |`;
  }

  // ============================================
  // Message Type Selection
  // ============================================

  private pickMessageType(index: number, cfg: StressFixtureConfig): string {
    // Conversation pattern: user -> [thinking] -> assistant -> [tools] -> repeat
    const phase = index % 10;

    if (phase === 0) return 'user';
    if (phase === 1 && cfg.includeThinking) return 'thinking';
    if (phase >= 2 && phase <= 4 && cfg.includeToolCalls) return 'tool_use';
    if (phase === 9) return 'system';
    return 'assistant';
  }

  // ============================================
  // Utilities
  // ============================================

  private nextId(): string {
    return `stress-${Date.now()}-${this.counter++}`;
  }

  /**
   * Get preset configurations for common stress scenarios.
   */
  getPresets(): Record<string, { description: string; messageCount: number; config: Partial<StressFixtureConfig> }> {
    return {
      'light': {
        description: 'Light load: 50 mixed messages',
        messageCount: 50,
        config: {},
      },
      'medium': {
        description: 'Medium load: 200 mixed messages with code and tools',
        messageCount: 200,
        config: { includeCodeBlocks: true, includeToolCalls: true },
      },
      'heavy-markdown': {
        description: 'Heavy markdown: 500 messages with long content',
        messageCount: 500,
        config: { longMarkdown: true, includeTables: true, includeCodeBlocks: true },
      },
      'heavy-tools': {
        description: 'Heavy tools: 500 messages mostly tool calls',
        messageCount: 500,
        config: { includeToolCalls: true, longMarkdown: false },
      },
      'extreme': {
        description: 'Extreme: 2000 mixed heavy messages',
        messageCount: 2000,
        config: { longMarkdown: true, includeToolCalls: true, includeThinking: true, includeCodeBlocks: true, includeTables: true },
      },
    };
  }
}
