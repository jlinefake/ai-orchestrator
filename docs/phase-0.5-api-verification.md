# Phase 0.5: API Verification Results

**Date:** 2026-01-28
**Status:** COMPLETE

This document verifies the Anthropic API syntax for prompt caching and context editing against the current official documentation.

---

## 1. Prompt Caching

### Verified Syntax

**Status:** CORRECT - The plan's syntax matches current API

```typescript
// Correct syntax for prompt caching
const response = await client.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 1024,
  system: [
    {
      type: "text",
      text: "System prompt content",
      cache_control: { type: "ephemeral" }  // 5-minute default TTL
    }
  ],
  messages: [...]
});

// Optional: Extended 1-hour TTL (at additional cost)
cache_control: { type: "ephemeral", ttl: "1h" }
```

### Cache Control Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `type` | `"ephemeral"` | Only supported cache type |
| `ttl` | `"5m"` \| `"1h"` | Optional TTL (5 minutes default, 1 hour costs 2x) |

### Response Usage Fields

```typescript
interface CacheUsage {
  cache_creation_input_tokens: number;  // Tokens written to cache
  cache_read_input_tokens: number;      // Tokens read from cache
  input_tokens: number;                 // Non-cached input tokens
  output_tokens: number;

  // Extended info for mixed TTLs
  cache_creation?: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  }
}
```

### Minimum Token Requirements

| Model | Minimum Cacheable Tokens |
|-------|-------------------------|
| Claude Opus 4.5 | 4,096 |
| Claude Opus 4.1/4 | 1,024 |
| Claude Sonnet 4.5/4 | 1,024 |
| Claude Haiku 4.5 | 4,096 |

### Key Constraints

- Maximum 4 cache breakpoints per request
- Cache is organization-isolated (workspace-isolated starting Feb 5, 2026)
- Cache refreshes automatically when content is reused within TTL
- Thinking blocks cannot be explicitly cached, but get cached alongside other content

---

## 2. Context Editing

### Verified Syntax

**Status:** DIFFERS FROM PLAN - Significant syntax changes required

#### Plan's Proposed Syntax (INCORRECT)
```typescript
// WRONG - This will NOT work
client.beta.messages.create({
  context_compaction: {
    strategy: 'clear_tool_uses_20250919',
    threshold_tokens: 180_000
  }
});
```

#### Correct Syntax
```typescript
// CORRECT syntax
const response = await client.beta.messages.create({
  model: "claude-sonnet-4-5",
  max_tokens: 4096,
  messages: [...],
  tools: [...],
  betas: ["context-management-2025-06-27"],  // Required beta header
  context_management: {  // NOT context_compaction
    edits: [
      {
        type: "clear_tool_uses_20250919",
        trigger: {
          type: "input_tokens",
          value: 100000  // NOT threshold_tokens
        },
        keep: {
          type: "tool_uses",
          value: 3
        },
        clear_at_least: {
          type: "input_tokens",
          value: 5000
        },
        exclude_tools: ["web_search"]
      }
    ]
  }
});
```

### Key Differences from Plan

| Plan Says | Actual API |
|-----------|------------|
| `context_compaction` | `context_management` |
| `strategy: 'clear_tool_uses_20250919'` | `edits: [{ type: "clear_tool_uses_20250919", ... }]` |
| `threshold_tokens: 180000` | `trigger: { type: "input_tokens", value: 180000 }` |
| N/A | `keep: { type: "tool_uses", value: 3 }` |
| N/A | `clear_at_least: { type: "input_tokens", value: 5000 }` |

### Available Strategies

1. **Tool Result Clearing** (`clear_tool_uses_20250919`)
   - Clears oldest tool results when threshold exceeded
   - Can optionally clear tool inputs with `clear_tool_inputs: true`

2. **Thinking Block Clearing** (`clear_thinking_20251015`)
   - Manages thinking blocks in extended thinking conversations
   - Default: keeps only last assistant turn's thinking

### Configuration Options for Tool Result Clearing

| Option | Default | Description |
|--------|---------|-------------|
| `trigger` | 100,000 tokens | When to activate (input_tokens or tool_uses) |
| `keep` | 3 tool uses | How many recent tool uses to preserve |
| `clear_at_least` | None | Minimum tokens to clear (helps with cache invalidation) |
| `exclude_tools` | None | Tool names to never clear |
| `clear_tool_inputs` | false | Also clear tool call parameters |

### Configuration Options for Thinking Block Clearing

| Option | Default | Description |
|--------|---------|-------------|
| `keep` | `{ type: "thinking_turns", value: 1 }` | How many turns to keep thinking for |
| `keep` | `"all"` | Alternative: keep all thinking blocks |

### Response Structure

```typescript
interface ContextManagementResponse {
  context_management: {
    applied_edits: Array<{
      type: string;
      cleared_tool_uses?: number;
      cleared_thinking_turns?: number;
      cleared_input_tokens: number;
    }>;
  };
}
```

### Combining Strategies

When using both strategies, `clear_thinking_20251015` must be listed first:

```typescript
context_management: {
  edits: [
    { type: "clear_thinking_20251015", keep: { type: "thinking_turns", value: 2 } },
    { type: "clear_tool_uses_20250919", trigger: { type: "input_tokens", value: 50000 } }
  ]
}
```

---

## 3. SDK Client-Side Compaction

The SDK also offers client-side compaction (separate from server-side context editing):

```typescript
// Using tool_runner with compaction
const runner = client.beta.messages.toolRunner({
  model: 'claude-sonnet-4-5',
  max_tokens: 4096,
  tools: [...],
  messages: [...],
  compactionControl: {
    enabled: true,
    contextTokenThreshold: 100000,
    model: 'claude-haiku-4-5',  // Optional: use cheaper model for summaries
    summaryPrompt: '...'  // Optional: custom prompt
  }
});
```

This generates LLM summaries rather than just clearing content.

---

## 4. Supported Models

Both prompt caching and context editing are available on:
- Claude Opus 4.5 (`claude-opus-4-5-20251101`)
- Claude Opus 4.1 (`claude-opus-4-1-20250805`)
- Claude Opus 4 (`claude-opus-4-20250514`)
- Claude Sonnet 4.5 (`claude-sonnet-4-5-20250929`)
- Claude Sonnet 4 (`claude-sonnet-4-20250514`)
- Claude Haiku 4.5 (`claude-haiku-4-5-20251001`)

---

## 5. Checklist Status

- [x] Verify `cache_control: { type: 'ephemeral' }` syntax - **CORRECT**
- [x] Verify beta header name for context editing - **CORRECT: `context-management-2025-06-27`**
- [x] Verify `context_compaction` parameter structure - **NEEDS UPDATE: Use `context_management` with `edits` array**
- [ ] Write integration tests against actual API
- [ ] Document any syntax differences from plan - **THIS DOCUMENT**

---

## 6. Required Plan Updates

The following code in `newplan.md` needs correction:

### Section 1.2 Context Editing API

**Before:**
```typescript
async createMessageWithClearing(
  client: Anthropic,
  messages: Anthropic.MessageParam[]
): Promise<Anthropic.Message> {
  return client.beta.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    betas: [this.BETA_HEADER],
    context_compaction: {
      strategy: 'clear_tool_uses_20250919',
      threshold_tokens: 180_000
    },
    messages
  });
}
```

**After:**
```typescript
async createMessageWithClearing(
  client: Anthropic,
  messages: Anthropic.MessageParam[],
  tools: Anthropic.Tool[]
): Promise<Anthropic.Message> {
  return client.beta.messages.create({
    model: 'claude-sonnet-4-5-20250929',
    max_tokens: 4096,
    betas: [this.BETA_HEADER],
    tools,
    messages,
    context_management: {
      edits: [
        {
          type: 'clear_tool_uses_20250919',
          trigger: {
            type: 'input_tokens',
            value: 180_000
          },
          keep: {
            type: 'tool_uses',
            value: 3
          },
          clear_at_least: {
            type: 'input_tokens',
            value: 10_000  // Ensure cache invalidation is worthwhile
          }
        }
      ]
    }
  });
}
```

---

## Sources

- [Prompt Caching - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)
- [Context Editing - Claude API Docs](https://platform.claude.com/docs/en/build-with-claude/context-editing)
- [Automatic Context Compaction Cookbook](https://platform.claude.com/cookbook/tool-use-automatic-context-compaction)
