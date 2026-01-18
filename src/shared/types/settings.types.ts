/**
 * Settings Types - Application settings configuration
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type CliType = 'claude' | 'gemini' | 'openai' | 'auto';

/**
 * Application settings that are persisted to disk
 */
export interface AppSettings {
  // General
  defaultYoloMode: boolean;
  defaultWorkingDirectory: string;
  defaultCli: CliType;
  theme: ThemeMode;

  // Orchestration
  maxChildrenPerParent: number;
  autoTerminateIdleMinutes: number; // 0 = disabled
  allowNestedOrchestration: boolean;

  // Display
  fontSize: number; // 12-20
  contextWarningThreshold: number; // 0-100 percentage
  showToolMessages: boolean;

  // Advanced
  outputBufferSize: number;
  customModelOverride: string; // empty = use default
}

/**
 * Default settings values
 */
export const DEFAULT_SETTINGS: AppSettings = {
  // General
  defaultYoloMode: true,
  defaultWorkingDirectory: '',
  defaultCli: 'auto',
  theme: 'dark',

  // Orchestration
  maxChildrenPerParent: 10,
  autoTerminateIdleMinutes: 0,
  allowNestedOrchestration: false,

  // Display
  fontSize: 14,
  contextWarningThreshold: 80,
  showToolMessages: true,

  // Advanced
  outputBufferSize: 1000,
  customModelOverride: '',
};

/**
 * Settings metadata for UI rendering
 *
 * FUTURE SETTINGS TO CONSIDER:
 * - Keyboard shortcuts customization
 * - Auto-save/restore sessions
 * - Notification preferences (child completed, errors, etc.)
 * - API key management (though CLIs handle this)
 * - Proxy settings
 * - Log level / debug mode
 * - Export/import settings
 * - Per-project settings overrides
 * - Default instance name template
 * - Auto-scroll behavior
 * - Message timestamp format
 * - Syntax highlighting theme for code blocks
 */
export interface SettingMetadata {
  key: keyof AppSettings;
  label: string;
  description: string;
  type: 'boolean' | 'string' | 'number' | 'select' | 'directory';
  category: 'general' | 'orchestration' | 'display' | 'advanced';
  options?: { value: string | number; label: string }[];
  min?: number;
  max?: number;
  placeholder?: string;
}

export const SETTINGS_METADATA: SettingMetadata[] = [
  // General
  {
    key: 'defaultYoloMode',
    label: 'YOLO Mode by Default',
    description: 'Enable YOLO mode (auto-approve all actions) for new instances',
    type: 'boolean',
    category: 'general',
  },
  {
    key: 'defaultWorkingDirectory',
    label: 'Default Working Directory',
    description: 'Starting folder for new instances (empty = home directory)',
    type: 'directory',
    category: 'general',
    placeholder: '~/Projects',
  },
  {
    key: 'defaultCli',
    label: 'Default CLI',
    description: 'Which AI CLI to use when multiple are available',
    type: 'select',
    category: 'general',
    options: [
      { value: 'auto', label: 'Auto-detect' },
      { value: 'claude', label: 'Claude Code' },
      { value: 'gemini', label: 'Gemini CLI' },
      { value: 'openai', label: 'OpenAI CLI' },
    ],
  },
  {
    key: 'theme',
    label: 'Theme',
    description: 'Application color theme',
    type: 'select',
    category: 'general',
    options: [
      { value: 'dark', label: 'Dark' },
      { value: 'light', label: 'Light' },
      { value: 'system', label: 'System' },
    ],
  },

  // Orchestration
  {
    key: 'maxChildrenPerParent',
    label: 'Max Children per Parent',
    description: 'Maximum number of child instances a parent can spawn',
    type: 'number',
    category: 'orchestration',
    min: 1,
    max: 50,
  },
  {
    key: 'autoTerminateIdleMinutes',
    label: 'Auto-terminate Idle Children',
    description: 'Automatically terminate children after N minutes of inactivity (0 = disabled)',
    type: 'number',
    category: 'orchestration',
    min: 0,
    max: 60,
  },
  {
    key: 'allowNestedOrchestration',
    label: 'Allow Nested Orchestration',
    description: 'Allow child instances to spawn their own children',
    type: 'boolean',
    category: 'orchestration',
  },

  // Display
  {
    key: 'fontSize',
    label: 'Font Size',
    description: 'Base font size for output display',
    type: 'number',
    category: 'display',
    min: 12,
    max: 20,
  },
  {
    key: 'contextWarningThreshold',
    label: 'Context Warning Threshold',
    description: 'Show warning when context usage exceeds this percentage',
    type: 'number',
    category: 'display',
    min: 50,
    max: 100,
  },
  {
    key: 'showToolMessages',
    label: 'Show Tool Messages',
    description: 'Display tool use and tool result messages in output',
    type: 'boolean',
    category: 'display',
  },

  // Advanced
  {
    key: 'outputBufferSize',
    label: 'Output Buffer Size',
    description: 'Maximum number of messages to keep in history per instance',
    type: 'number',
    category: 'advanced',
    min: 100,
    max: 10000,
  },
  {
    key: 'customModelOverride',
    label: 'Custom Model Override',
    description: 'Override the default model (leave empty for CLI default)',
    type: 'string',
    category: 'advanced',
    placeholder: 'e.g., claude-3-opus-20240229',
  },
];
