/**
 * View Layout Service - Manages panel sizes and layout persistence
 * Debounces save operations to avoid excessive localStorage writes
 */

import { Injectable, signal } from '@angular/core';

export interface ViewLayout {
  sidebarWidth: number;
  fileExplorerWidth: number;
}

const DEFAULT_LAYOUT: ViewLayout = {
  sidebarWidth: 320,
  fileExplorerWidth: 260,
};

const STORAGE_KEY = 'view-layout';
const DEBOUNCE_MS = 500;

@Injectable({
  providedIn: 'root',
})
export class ViewLayoutService {
  private layout = signal<ViewLayout>(this.load());
  private saveTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Get current sidebar width */
  get sidebarWidth(): number {
    return this.layout().sidebarWidth;
  }

  /** Get current file explorer width */
  get fileExplorerWidth(): number {
    return this.layout().fileExplorerWidth;
  }

  /** Update sidebar width with debounced persistence */
  setSidebarWidth(width: number): void {
    const clamped = Math.max(250, Math.min(460, width));
    this.layout.update(l => ({ ...l, sidebarWidth: clamped }));
    this.debounceSave();
  }

  /** Update file explorer width with debounced persistence */
  setFileExplorerWidth(width: number): void {
    const clamped = Math.max(180, Math.min(500, width));
    this.layout.update(l => ({ ...l, fileExplorerWidth: clamped }));
    this.debounceSave();
  }

  /** Reset all layout to defaults */
  reset(): void {
    this.layout.set({ ...DEFAULT_LAYOUT });
    this.saveNow();

    // Also clear the individual localStorage keys that components may have set
    try {
      localStorage.removeItem('sidebarWidth');
      localStorage.removeItem('file-explorer-width');
      localStorage.removeItem('instance-list-order');
    } catch {
      // Ignore storage errors
    }
  }

  /** Load layout from localStorage */
  private load(): ViewLayout {
    try {
      // Try the unified key first
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
      return {
        sidebarWidth:
          parsed.sidebarWidth === 390
            ? DEFAULT_LAYOUT.sidebarWidth
            : parsed.sidebarWidth ?? DEFAULT_LAYOUT.sidebarWidth,
        fileExplorerWidth: parsed.fileExplorerWidth ?? DEFAULT_LAYOUT.fileExplorerWidth,
      };
      }

      // Fall back to individual keys for migration
      const sidebarWidth = localStorage.getItem('sidebarWidth');
      const fileExplorerWidth = localStorage.getItem('file-explorer-width');

      return {
        sidebarWidth:
          sidebarWidth && parseInt(sidebarWidth, 10) !== 390
            ? parseInt(sidebarWidth, 10)
            : DEFAULT_LAYOUT.sidebarWidth,
        fileExplorerWidth: fileExplorerWidth ? parseInt(fileExplorerWidth, 10) : DEFAULT_LAYOUT.fileExplorerWidth,
      };
    } catch {
      return { ...DEFAULT_LAYOUT };
    }
  }

  /** Debounced save to localStorage */
  private debounceSave(): void {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }
    this.saveTimeout = setTimeout(() => {
      this.saveNow();
    }, DEBOUNCE_MS);
  }

  /** Save immediately to localStorage */
  private saveNow(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.layout()));

      // Also update the individual keys for backwards compatibility
      localStorage.setItem('sidebarWidth', this.layout().sidebarWidth.toString());
      localStorage.setItem('file-explorer-width', this.layout().fileExplorerWidth.toString());
    } catch {
      // Ignore storage errors
    }
  }
}
