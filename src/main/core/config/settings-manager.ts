/**
 * Settings Manager - Manages application settings with persistence
 */

import ElectronStore from 'electron-store';
import { EventEmitter } from 'events';
import type { AppSettings } from '../../../shared/types/settings.types';
import { DEFAULT_SETTINGS } from '../../../shared/types/settings.types';

// Type for the internal store with the methods we need
interface Store<T> {
  store: T;
  path: string;
  get<K extends keyof T>(key: K): T[K];
  set<K extends keyof T>(key: K, value: T[K]): void;
  set(object: Partial<T>): void;
  clear(): void;
}

export class SettingsManager extends EventEmitter {
  private store: Store<AppSettings>;

  constructor() {
    super();
    // Cast to our Store interface to work around ESM type resolution issues
    this.store = new ElectronStore<AppSettings>({
      name: 'settings',
      defaults: DEFAULT_SETTINGS,
    }) as unknown as Store<AppSettings>;
  }

  /**
   * Get all settings
   */
  getAll(): AppSettings {
    return this.store.store;
  }

  /**
   * Get a single setting value
   */
  get<K extends keyof AppSettings>(key: K): AppSettings[K] {
    return this.store.get(key);
  }

  /**
   * Set a single setting value
   */
  set<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.store.set(key, value);
    this.emit('setting-changed', key, value);
    this.emit(`setting:${key}`, value);
  }

  /**
   * Update multiple settings at once
   */
  update(settings: Partial<AppSettings>): void {
    for (const [key, value] of Object.entries(settings)) {
      this.store.set(key as keyof AppSettings, value as AppSettings[keyof AppSettings]);
      this.emit('setting-changed', key, value);
    }
    this.emit('settings-updated', this.getAll());
  }

  /**
   * Reset all settings to defaults
   */
  reset(): void {
    this.store.clear();
    for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
      this.store.set(key as keyof AppSettings, value as AppSettings[keyof AppSettings]);
    }
    this.emit('settings-reset', DEFAULT_SETTINGS);
  }

  /**
   * Reset a single setting to default
   */
  resetOne<K extends keyof AppSettings>(key: K): void {
    this.store.set(key, DEFAULT_SETTINGS[key]);
    this.emit('setting-changed', key, DEFAULT_SETTINGS[key]);
  }

  /**
   * Get the storage file path (useful for debugging)
   */
  getPath(): string {
    return this.store.path;
  }
}

// Singleton instance
let settingsManager: SettingsManager | null = null;

export function getSettingsManager(): SettingsManager {
  if (!settingsManager) {
    settingsManager = new SettingsManager();
  }
  return settingsManager;
}
