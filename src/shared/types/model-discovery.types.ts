/**
 * Model Discovery Types
 * Dynamic discovery and configuration of available models from providers
 */

export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openrouter'
  | 'ollama'
  | 'azure'
  | 'aws-bedrock'
  | 'custom';

export interface DiscoveredModel {
  id: string;
  provider: ProviderType;
  name: string;
  displayName: string;
  description?: string;

  // Capabilities
  capabilities: ModelCapabilities;

  // Pricing (per 1M tokens)
  pricing?: ModelPricing;

  // Limits
  contextWindow: number;
  maxOutputTokens?: number;

  // Availability
  available: boolean;
  availabilityReason?: string;

  // Metadata
  lastVerified: number;
  version?: string;
  deprecated?: boolean;
  deprecationDate?: string;

  // Performance hints
  latencyTier?: 'fast' | 'standard' | 'slow';
  qualityTier?: 'economy' | 'standard' | 'premium';
}

export interface ModelCapabilities {
  chat: boolean;
  completion?: boolean;
  vision: boolean;
  functionCalling: boolean;
  streaming: boolean;
  jsonMode?: boolean;

  // Advanced capabilities
  reasoning?: boolean;
  codeExecution?: boolean;
  webSearch?: boolean;
  imageGeneration?: boolean;

  // Extended thinking support
  extendedThinking?: boolean;
  maxThinkingTokens?: number;
}

export interface ModelPricing {
  inputCostPer1M: number;
  outputCostPer1M: number;
  currency: string;

  // Optional tiered pricing
  cachedInputCostPer1M?: number;
  batchInputCostPer1M?: number;
  batchOutputCostPer1M?: number;

  // Extended thinking pricing
  thinkingCostPer1M?: number;
}

export interface ProviderConfig {
  type: ProviderType;
  name: string;
  enabled: boolean;

  // Connection details
  apiKey?: string;
  apiKeyEnvVar?: string;
  baseUrl?: string;
  organization?: string;

  // Discovery settings
  autoDiscover: boolean;
  discoveryInterval?: number; // ms between discovery runs
  lastDiscovery?: number;

  // Model overrides (for manual configuration)
  modelOverrides?: Record<string, Partial<DiscoveredModel>>;

  // Provider-specific config
  providerConfig?: Record<string, unknown>;
}

export interface ModelRegistry {
  providers: ProviderConfig[];
  models: DiscoveredModel[];
  lastFullScan: number;
  version: string;
}

// Discovery events
export interface DiscoveryEvent {
  type: 'started' | 'completed' | 'error' | 'model_found' | 'model_removed';
  provider: ProviderType;
  timestamp: number;
  details?: Record<string, unknown>;
}

// Model selection
export interface ModelSelectionCriteria {
  // Required capabilities
  requiredCapabilities?: (keyof ModelCapabilities)[];

  // Performance requirements
  minContextWindow?: number;
  maxLatency?: 'fast' | 'standard' | 'slow';

  // Cost constraints
  maxCostPer1MInput?: number;
  maxCostPer1MOutput?: number;

  // Quality preference
  preferQuality?: 'economy' | 'standard' | 'premium';

  // Provider preference
  preferredProviders?: ProviderType[];
  excludeProviders?: ProviderType[];

  // Model preference
  preferredModels?: string[];
  excludeModels?: string[];
}

export interface ModelRecommendation {
  model: DiscoveredModel;
  score: number; // 0-1 match score
  reasoning: string[];
  alternatives: { model: DiscoveredModel; score: number }[];
}

// Hardcoded models (for providers without discovery APIs)
export interface HardcodedModelInfo {
  provider: ProviderType;
  models: Omit<DiscoveredModel, 'available' | 'lastVerified'>[];
  lastUpdated: string; // ISO date
}

// IPC Payloads
export interface DiscoverModelsPayload {
  provider?: ProviderType; // If not specified, discover all
  force?: boolean; // Force re-discovery even if recent
}

export interface GetModelsPayload {
  provider?: ProviderType;
  capabilities?: (keyof ModelCapabilities)[];
  onlyAvailable?: boolean;
}

export interface SelectModelPayload {
  criteria: ModelSelectionCriteria;
  taskType?: string; // Optional task context for better selection
}

export interface ConfigureProviderPayload {
  provider: ProviderType;
  config: Partial<ProviderConfig>;
}

export interface VerifyModelPayload {
  modelId: string;
  provider: ProviderType;
}

export interface GetProviderStatusPayload {
  provider: ProviderType;
}

export interface SetModelOverridePayload {
  provider: ProviderType;
  modelId: string;
  overrides: Partial<DiscoveredModel>;
}

export interface RemoveModelOverridePayload {
  provider: ProviderType;
  modelId: string;
}

// Response types
export interface DiscoveryResult {
  provider: ProviderType;
  success: boolean;
  modelsFound: number;
  modelsRemoved: number;
  errors?: string[];
  duration: number;
}

export interface ProviderStatus {
  provider: ProviderType;
  enabled: boolean;
  configured: boolean;
  connected: boolean;
  lastDiscovery?: number;
  modelCount: number;
  errors?: string[];
}

export interface ModelDiscoveryStats {
  totalProviders: number;
  enabledProviders: number;
  connectedProviders: number;
  totalModels: number;
  availableModels: number;
  lastFullScan?: number;
  providerStatus: ProviderStatus[];
}
