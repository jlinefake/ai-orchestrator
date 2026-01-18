/**
 * Provider Registry - Manages available AI providers
 */

import type {
  ProviderType,
  ProviderConfig,
  ProviderStatus,
} from '../../shared/types/provider.types';
import { BaseProvider, ProviderFactory } from './provider-interface';
import { ClaudeCliProvider } from './claude-cli-provider';

/**
 * Default provider configurations
 */
const DEFAULT_PROVIDER_CONFIGS: Record<ProviderType, ProviderConfig> = {
  'claude-cli': {
    type: 'claude-cli',
    name: 'Claude Code CLI',
    enabled: true,
    defaultModel: 'claude-sonnet-4-20250514',
  },
  'anthropic-api': {
    type: 'anthropic-api',
    name: 'Anthropic API',
    enabled: false,
    defaultModel: 'claude-sonnet-4-20250514',
  },
  'openai': {
    type: 'openai',
    name: 'OpenAI',
    enabled: false,
    defaultModel: 'gpt-4o',
  },
  'openai-compatible': {
    type: 'openai-compatible',
    name: 'OpenAI Compatible',
    enabled: false,
    defaultModel: 'gpt-4o',
  },
  'ollama': {
    type: 'ollama',
    name: 'Ollama',
    enabled: false,
    apiEndpoint: 'http://localhost:11434',
    defaultModel: 'llama3',
  },
  'google': {
    type: 'google',
    name: 'Google AI',
    enabled: false,
    defaultModel: 'gemini-1.5-pro',
  },
  'amazon-bedrock': {
    type: 'amazon-bedrock',
    name: 'Amazon Bedrock',
    enabled: false,
    defaultModel: 'anthropic.claude-3-5-sonnet-20241022-v2:0',
  },
  'azure': {
    type: 'azure',
    name: 'Azure OpenAI',
    enabled: false,
    defaultModel: 'gpt-4o',
  },
};

/**
 * Provider factories for each type
 */
const PROVIDER_FACTORIES: Partial<Record<ProviderType, ProviderFactory>> = {
  'claude-cli': (config) => new ClaudeCliProvider(config),
  // Future providers will be added here:
  // 'anthropic-api': (config) => new AnthropicApiProvider(config),
  // 'openai': (config) => new OpenAiProvider(config),
  // 'ollama': (config) => new OllamaProvider(config),
};

/**
 * Provider Registry - Singleton that manages provider configurations and creation
 */
export class ProviderRegistry {
  private configs: Map<ProviderType, ProviderConfig> = new Map();
  private statusCache: Map<ProviderType, ProviderStatus> = new Map();
  private statusCacheTime: Map<ProviderType, number> = new Map();
  private readonly STATUS_CACHE_TTL = 60000; // 1 minute

  constructor() {
    // Initialize with default configs
    for (const [type, config] of Object.entries(DEFAULT_PROVIDER_CONFIGS)) {
      this.configs.set(type as ProviderType, { ...config });
    }
  }

  /**
   * Get all provider configurations
   */
  getAllConfigs(): ProviderConfig[] {
    return Array.from(this.configs.values());
  }

  /**
   * Get configuration for a specific provider
   */
  getConfig(type: ProviderType): ProviderConfig | undefined {
    return this.configs.get(type);
  }

  /**
   * Update provider configuration
   */
  updateConfig(type: ProviderType, updates: Partial<ProviderConfig>): void {
    const existing = this.configs.get(type);
    if (existing) {
      this.configs.set(type, { ...existing, ...updates });
      // Clear status cache when config changes
      this.statusCache.delete(type);
      this.statusCacheTime.delete(type);
    }
  }

  /**
   * Get enabled providers
   */
  getEnabledProviders(): ProviderConfig[] {
    return Array.from(this.configs.values()).filter((c) => c.enabled);
  }

  /**
   * Check if a provider type is supported (has a factory)
   */
  isSupported(type: ProviderType): boolean {
    return type in PROVIDER_FACTORIES;
  }

  /**
   * Create a provider instance
   */
  createProvider(type: ProviderType, configOverrides?: Partial<ProviderConfig>): BaseProvider {
    const factory = PROVIDER_FACTORIES[type];
    if (!factory) {
      throw new Error(`Provider type '${type}' is not yet implemented`);
    }

    const baseConfig = this.configs.get(type);
    if (!baseConfig) {
      throw new Error(`No configuration found for provider '${type}'`);
    }

    const config = { ...baseConfig, ...configOverrides };
    return factory(config);
  }

  /**
   * Check status of a provider (with caching)
   */
  async checkProviderStatus(type: ProviderType, forceRefresh = false): Promise<ProviderStatus> {
    // Check cache first
    if (!forceRefresh) {
      const cached = this.statusCache.get(type);
      const cachedTime = this.statusCacheTime.get(type);
      if (cached && cachedTime && Date.now() - cachedTime < this.STATUS_CACHE_TTL) {
        return cached;
      }
    }

    // If not supported, return unavailable status
    if (!this.isSupported(type)) {
      const status: ProviderStatus = {
        type,
        available: false,
        authenticated: false,
        error: `Provider '${type}' is not yet implemented`,
      };
      return status;
    }

    // Create temporary provider to check status
    try {
      const provider = this.createProvider(type);
      const status = await provider.checkStatus();

      // Cache the result
      this.statusCache.set(type, status);
      this.statusCacheTime.set(type, Date.now());

      return status;
    } catch (error) {
      const status: ProviderStatus = {
        type,
        available: false,
        authenticated: false,
        error: (error as Error).message,
      };
      return status;
    }
  }

  /**
   * Check status of all providers
   */
  async checkAllProviderStatus(forceRefresh = false): Promise<Map<ProviderType, ProviderStatus>> {
    const results = new Map<ProviderType, ProviderStatus>();

    for (const type of this.configs.keys()) {
      const status = await this.checkProviderStatus(type, forceRefresh);
      results.set(type, status);
    }

    return results;
  }

  /**
   * Get the default provider type
   */
  getDefaultProviderType(): ProviderType {
    // For now, always default to Claude CLI
    return 'claude-cli';
  }
}

// Singleton instance
let registryInstance: ProviderRegistry | null = null;

export function getProviderRegistry(): ProviderRegistry {
  if (!registryInstance) {
    registryInstance = new ProviderRegistry();
  }
  return registryInstance;
}
