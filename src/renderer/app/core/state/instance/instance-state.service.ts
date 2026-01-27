/**
 * Instance State Service - Shared state holder for instance sub-stores
 *
 * This service holds the single source of truth for instance state.
 * All sub-stores inject this service to read/update state.
 */

import { Injectable, signal } from '@angular/core';
import type {
  InstanceStoreState,
  Instance,
  OutputMessage,
  QueuedMessage,
} from './instance.types';

@Injectable({ providedIn: 'root' })
export class InstanceStateService {
  // ============================================
  // Main State Signal
  // ============================================

  readonly state = signal<InstanceStoreState>({
    instances: new Map(),
    selectedInstanceId: null,
    loading: false,
    error: null,
  });

  // ============================================
  // Output Throttling State (private to output store)
  // ============================================

  readonly outputThrottleTimers = new Map<string, ReturnType<typeof setTimeout>>();
  readonly pendingOutputMessages = new Map<string, OutputMessage[]>();

  // ============================================
  // Message Queue State (reactive signal)
  // ============================================

  readonly messageQueue = signal(new Map<string, QueuedMessage[]>());

  // ============================================
  // State Update Helpers
  // ============================================

  /**
   * Update the loading state
   */
  setLoading(loading: boolean): void {
    this.state.update((s) => ({ ...s, loading }));
  }

  /**
   * Set an error message
   */
  setError(error: string | null): void {
    this.state.update((s) => ({ ...s, error }));
  }

  /**
   * Update a specific instance
   */
  updateInstance(instanceId: string, updates: Partial<Instance>): void {
    this.state.update((current) => {
      const newMap = new Map(current.instances);
      const instance = newMap.get(instanceId);
      if (instance) {
        newMap.set(instanceId, { ...instance, ...updates });
      }
      return { ...current, instances: newMap };
    });
  }

  /**
   * Add an instance to the store
   */
  addInstance(instance: Instance, autoSelect: boolean = false): void {
    this.state.update((current) => {
      const newMap = new Map(current.instances);
      newMap.set(instance.id, instance);
      return {
        ...current,
        instances: newMap,
        loading: false,
        selectedInstanceId: autoSelect ? instance.id : current.selectedInstanceId,
      };
    });
  }

  /**
   * Remove an instance from the store
   */
  removeInstance(instanceId: string): void {
    this.state.update((current) => {
      const newMap = new Map(current.instances);
      newMap.delete(instanceId);
      return {
        ...current,
        instances: newMap,
        selectedInstanceId:
          current.selectedInstanceId === instanceId ? null : current.selectedInstanceId,
      };
    });
  }

  /**
   * Set the selected instance
   */
  setSelectedInstance(id: string | null): void {
    this.state.update((s) => ({ ...s, selectedInstanceId: id }));
  }

  /**
   * Get an instance by ID
   */
  getInstance(id: string): Instance | undefined {
    return this.state().instances.get(id);
  }

  /**
   * Set all instances (for initial load)
   */
  setInstances(instances: Map<string, Instance>): void {
    this.state.update((s) => ({
      ...s,
      instances,
      loading: false,
    }));
  }
}
