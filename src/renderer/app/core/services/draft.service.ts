/**
 * Draft Service - Manages message drafts across different views
 *
 * Provides persistent draft storage keyed by context (instanceId, 'verification', etc.)
 * so users don't lose their typed text when switching between views.
 */

import { Injectable, signal } from '@angular/core';

// Special context keys for non-instance views
export const VERIFICATION_DRAFT_KEY = '__verification__';

@Injectable({
  providedIn: 'root'
})
export class DraftService {
  // Storage for drafts keyed by context
  private drafts = new Map<string, string>();

  // Signal to notify when any draft changes (for reactive updates)
  private draftVersion = signal(0);

  /**
   * Get the draft for a given context
   */
  getDraft(contextKey: string): string {
    return this.drafts.get(contextKey) || '';
  }

  /**
   * Set the draft for a given context
   */
  setDraft(contextKey: string, text: string): void {
    if (text) {
      this.drafts.set(contextKey, text);
    } else {
      this.drafts.delete(contextKey);
    }
    this.draftVersion.update(v => v + 1);
  }

  /**
   * Clear the draft for a given context
   */
  clearDraft(contextKey: string): void {
    this.drafts.delete(contextKey);
    this.draftVersion.update(v => v + 1);
  }

  /**
   * Check if a draft exists for a context
   */
  hasDraft(contextKey: string): boolean {
    const draft = this.drafts.get(contextKey);
    return !!draft && draft.length > 0;
  }

  /**
   * Get all contexts with drafts (useful for debugging)
   */
  getAllDraftKeys(): string[] {
    return Array.from(this.drafts.keys());
  }
}
