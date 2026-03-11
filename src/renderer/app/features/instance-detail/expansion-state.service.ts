/**
 * Tracks expand/collapse state for tool groups and thought processes
 * per instance, so state persists across instance switches.
 *
 * Uses a signal-based version counter so Angular's change detection
 * picks up mutations to the underlying Map/Set data.
 */

import { Injectable, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ExpansionStateService {
  // instanceId -> Set of expanded item IDs
  private expandedItems = new Map<string, Set<string>>();

  // Signal version counter — bumped on every mutation so computed() consumers re-evaluate
  private version = signal(0);

  isExpanded(instanceId: string, itemId: string): boolean {
    // Read the version signal to create a reactive dependency
    this.version();
    return this.expandedItems.get(instanceId)?.has(itemId) ?? false;
  }

  setExpanded(instanceId: string, itemId: string, expanded: boolean): void {
    let set = this.expandedItems.get(instanceId);
    if (!set) {
      set = new Set();
      this.expandedItems.set(instanceId, set);
    }
    if (expanded) {
      set.add(itemId);
    } else {
      set.delete(itemId);
    }
    this.version.update(v => v + 1);
  }

  toggleExpanded(instanceId: string, itemId: string): boolean {
    const current = this.expandedItems.get(instanceId)?.has(itemId) ?? false;
    this.setExpanded(instanceId, itemId, !current);
    return !current;
  }

  clearInstance(instanceId: string): void {
    this.expandedItems.delete(instanceId);
    this.version.update(v => v + 1);
  }
}
