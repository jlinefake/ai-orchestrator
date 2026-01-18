/**
 * CLI Detector - Detects available AI CLI tools
 */

import { spawn } from 'child_process';

export interface CliInfo {
  name: string;
  command: string;
  displayName: string;
  available: boolean;
  version?: string;
  error?: string;
}

export type CliType = 'claude' | 'gemini' | 'openai';

const CLI_CONFIGS: Record<CliType, Omit<CliInfo, 'available' | 'version' | 'error'>> = {
  claude: {
    name: 'claude',
    command: 'claude',
    displayName: 'Claude Code',
  },
  gemini: {
    name: 'gemini',
    command: 'gemini',
    displayName: 'Gemini CLI',
  },
  openai: {
    name: 'openai',
    command: 'openai',
    displayName: 'OpenAI CLI',
  },
};

/**
 * Check if a CLI command is available
 */
async function checkCli(config: typeof CLI_CONFIGS[CliType]): Promise<CliInfo> {
  return new Promise((resolve) => {
    const result: CliInfo = {
      ...config,
      available: false,
    };

    try {
      // Try to get version to verify CLI exists
      const proc = spawn(config.command, ['--version'], {
        shell: true,
        timeout: 5000,
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0 || stdout.trim()) {
          result.available = true;
          result.version = stdout.trim().split('\n')[0];
        } else {
          result.error = stderr.trim() || 'Command failed';
        }
        resolve(result);
      });

      proc.on('error', (err) => {
        result.error = err.message;
        resolve(result);
      });

      // Timeout fallback
      setTimeout(() => {
        proc.kill();
        result.error = 'Timeout checking CLI';
        resolve(result);
      }, 5000);
    } catch (err) {
      result.error = (err as Error).message;
      resolve(result);
    }
  });
}

/**
 * Detect all available CLIs
 */
export async function detectAvailableClis(): Promise<CliInfo[]> {
  const checks = Object.values(CLI_CONFIGS).map(checkCli);
  return Promise.all(checks);
}

/**
 * Check if a specific CLI is available
 */
export async function isCliAvailable(type: CliType): Promise<CliInfo> {
  return checkCli(CLI_CONFIGS[type]);
}

/**
 * Get the first available CLI
 */
export async function getDefaultCli(): Promise<CliInfo | null> {
  const clis = await detectAvailableClis();
  return clis.find((cli) => cli.available) || null;
}

/**
 * Get CLI config for a type
 */
export function getCliConfig(type: CliType): typeof CLI_CONFIGS[CliType] {
  return CLI_CONFIGS[type];
}
