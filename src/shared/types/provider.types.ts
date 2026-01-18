/**
 * Provider Types - Abstractions for AI providers
 */

/**
 * Supported provider types
 */
export type ProviderType =
  | 'claude-cli'      // Claude Code CLI (current implementation)
  | 'anthropic-api'   // Direct Anthropic API
  | 'openai'          // OpenAI API
  | 'openai-compatible' // OpenAI-compatible APIs (local, etc.)
  | 'ollama'          // Ollama local models
  | 'google'          // Google AI (Gemini)
  | 'amazon-bedrock'  // AWS Bedrock
  | 'azure';          // Azure OpenAI

/**
 * Provider capability flags
 */
export interface ProviderCapabilities {
  /** Can execute tools (file read/write, bash, etc.) */
  toolExecution: boolean;
  /** Can stream responses */
  streaming: boolean;
  /** Supports multi-turn conversations */
  multiTurn: boolean;
  /** Can process images */
  vision: boolean;
  /** Can process files/documents */
  fileAttachments: boolean;
  /** Supports function calling */
  functionCalling: boolean;
  /** Has built-in code tools (like Claude Code) */
  builtInCodeTools: boolean;
}

/**
 * Model information
 */
export interface ModelInfo {
  id: string;
  name: string;
  provider: ProviderType;
  contextWindow: number;
  maxOutputTokens: number;
  inputPricePerMillion: number;  // USD per million tokens
  outputPricePerMillion: number;
  capabilities: Partial<ProviderCapabilities>;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  type: ProviderType;
  name: string;
  enabled: boolean;
  apiKey?: string;
  apiEndpoint?: string;
  defaultModel?: string;
  models?: ModelInfo[];
  options?: Record<string, unknown>;
}

/**
 * Provider status
 */
export interface ProviderStatus {
  type: ProviderType;
  available: boolean;
  authenticated: boolean;
  error?: string;
  models?: ModelInfo[];
}

/**
 * Message for provider communication
 */
export interface ProviderMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: ProviderAttachment[];
}

/**
 * Attachment for provider messages
 */
export interface ProviderAttachment {
  type: 'image' | 'file' | 'code';
  name: string;
  mimeType: string;
  data: string; // base64 for binary, raw for text
}

/**
 * Provider response events (for streaming)
 */
export type ProviderEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_use'; tool: string; input: unknown }
  | { type: 'tool_result'; toolUseId: string; result: string; isError?: boolean }
  | { type: 'error'; message: string; code?: string }
  | { type: 'done'; usage?: ProviderUsage };

/**
 * Usage statistics from provider
 */
export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  totalTokens: number;
  estimatedCost?: number;
}

/**
 * Provider session options
 */
export interface ProviderSessionOptions {
  model?: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  workingDirectory: string;
  sessionId?: string;
  resume?: boolean;
  toolsEnabled?: boolean;
  yoloMode?: boolean;
}

/**
 * Default models for each provider
 */
export const DEFAULT_MODELS: Record<ProviderType, string> = {
  'claude-cli': 'claude-sonnet-4-20250514',
  'anthropic-api': 'claude-sonnet-4-20250514',
  'openai': 'gpt-4o',
  'openai-compatible': 'gpt-4o',
  'ollama': 'llama3',
  'google': 'gemini-1.5-pro',
  'amazon-bedrock': 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  'azure': 'gpt-4o',
};

/**
 * Known model pricing (USD per million tokens)
 */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // Claude models
  'claude-sonnet-4-20250514': { input: 3.0, output: 15.0 },
  'claude-opus-4-20250514': { input: 15.0, output: 75.0 },
  'claude-3-5-sonnet-20241022': { input: 3.0, output: 15.0 },
  'claude-3-5-haiku-20241022': { input: 0.8, output: 4.0 },
  // OpenAI models
  'gpt-4o': { input: 2.5, output: 10.0 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4-turbo': { input: 10.0, output: 30.0 },
  // Google models
  'gemini-1.5-pro': { input: 1.25, output: 5.0 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
};
