/**
 * Instance Store - Angular Signals-based state management
 */

import { Injectable, inject, signal, computed, OnDestroy } from '@angular/core';
import { ElectronIpcService } from '../services/electron-ipc.service';
import { UpdateBatcherService, StateUpdate } from '../services/update-batcher.service';

// Types
export type InstanceStatus =
  | 'initializing'
  | 'idle'
  | 'busy'
  | 'waiting_for_input'
  | 'error'
  | 'terminated';

export interface ContextUsage {
  used: number;
  total: number;
  percentage: number;
}

export interface OutputMessage {
  id: string;
  timestamp: number;
  type: 'assistant' | 'user' | 'system' | 'tool_use' | 'tool_result' | 'error';
  content: string;
  metadata?: Record<string, unknown>;
}

export interface Instance {
  id: string;
  displayName: string;
  createdAt: number;
  parentId: string | null;
  childrenIds: string[];
  status: InstanceStatus;
  contextUsage: ContextUsage;
  lastActivity: number;
  sessionId: string;
  workingDirectory: string;
  yoloMode: boolean;
  outputBuffer: OutputMessage[];
}

interface StoreState {
  instances: Map<string, Instance>;
  selectedInstanceId: string | null;
  loading: boolean;
  error: string | null;
}

@Injectable({ providedIn: 'root' })
export class InstanceStore implements OnDestroy {
  private ipc = inject(ElectronIpcService);
  private batcher = inject(UpdateBatcherService);
  private unsubscribes: (() => void)[] = [];

  // Private mutable state
  private state = signal<StoreState>({
    instances: new Map(),
    selectedInstanceId: null,
    loading: false,
    error: null,
  });

  // ============================================
  // Public Computed Selectors
  // ============================================

  /** All instances as array */
  readonly instances = computed(() =>
    Array.from(this.state().instances.values())
  );

  /** Instances as Map for direct lookup */
  readonly instancesMap = computed(() => this.state().instances);

  /** Selected instance ID */
  readonly selectedInstanceId = computed(() =>
    this.state().selectedInstanceId
  );

  /** Selected instance object */
  readonly selectedInstance = computed(() => {
    const id = this.state().selectedInstanceId;
    return id ? this.state().instances.get(id) || null : null;
  });

  /** Loading state */
  readonly loading = computed(() => this.state().loading);

  /** Error state */
  readonly error = computed(() => this.state().error);

  /** Instance count */
  readonly instanceCount = computed(() => this.state().instances.size);

  /** Instances grouped by status */
  readonly instancesByStatus = computed(() => {
    const grouped = new Map<InstanceStatus, Instance[]>();
    for (const instance of this.instances()) {
      const list = grouped.get(instance.status) || [];
      list.push(instance);
      grouped.set(instance.status, list);
    }
    return grouped;
  });

  /** Total context usage across all instances */
  readonly totalContextUsage = computed(() => {
    let used = 0;
    let total = 0;
    for (const instance of this.instances()) {
      used += instance.contextUsage.used;
      total += instance.contextUsage.total;
    }
    return {
      used,
      total,
      percentage: total > 0 ? (used / total) * 100 : 0,
    };
  });

  /** Root instances (no parent) */
  readonly rootInstances = computed(() =>
    this.instances().filter((i) => !i.parentId)
  );

  constructor() {
    this.setupIpcListeners();
    this.setupBatcher();
    this.loadInitialInstances();
  }

  ngOnDestroy(): void {
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    this.batcher.destroy();
  }

  // ============================================
  // Setup Methods
  // ============================================

  private setupIpcListeners(): void {
    // Listen for new instances
    this.unsubscribes.push(
      this.ipc.onInstanceCreated((data) => {
        this.addInstance(data as Instance);
      })
    );

    // Listen for removed instances
    this.unsubscribes.push(
      this.ipc.onInstanceRemoved((instanceId) => {
        this.removeInstance(instanceId);
      })
    );

    // Listen for state updates (critical ones bypass batching)
    this.unsubscribes.push(
      this.ipc.onInstanceStateUpdate((update: any) => {
        if (update.status === 'error' || update.status === 'terminated') {
          this.applyUpdate(update);
        } else {
          this.batcher.queueUpdate(update);
        }
      })
    );

    // Listen for output
    this.unsubscribes.push(
      this.ipc.onInstanceOutput((data: any) => {
        this.addOutput(data.instanceId, data.message);
      })
    );

    // Listen for batch updates
    this.unsubscribes.push(
      this.ipc.onBatchUpdate((data: any) => {
        if (data.updates) {
          this.batcher.queueUpdates(data.updates);
        }
      })
    );
  }

  private setupBatcher(): void {
    this.unsubscribes.push(
      this.batcher.onFlush((updates) => {
        this.applyBatchUpdates(updates);
      })
    );
  }

  private async loadInitialInstances(): Promise<void> {
    this.state.update((s) => ({ ...s, loading: true }));

    try {
      const response = await this.ipc.listInstances() as { success: boolean; data?: unknown[] };
      if (response.success && response.data && Array.isArray(response.data)) {
        const instances = new Map<string, Instance>();
        for (const data of response.data) {
          const item = data as Record<string, unknown>;
          instances.set(item['id'] as string, this.deserializeInstance(item));
        }
        this.state.update((s) => ({
          ...s,
          instances,
          loading: false,
        }));
      }
    } catch (error) {
      this.state.update((s) => ({
        ...s,
        loading: false,
        error: 'Failed to load instances',
      }));
    }
  }

  // ============================================
  // State Mutation Methods
  // ============================================

  private addInstance(data: any): void {
    const instance = this.deserializeInstance(data);

    this.state.update((current) => {
      const newMap = new Map(current.instances);
      newMap.set(instance.id, instance);

      return {
        ...current,
        instances: newMap,
        loading: false,
        selectedInstanceId: instance.id, // Auto-select new instance
      };
    });
  }

  private removeInstance(instanceId: string): void {
    this.state.update((current) => {
      const newMap = new Map(current.instances);
      newMap.delete(instanceId);

      return {
        ...current,
        instances: newMap,
        selectedInstanceId:
          current.selectedInstanceId === instanceId
            ? null
            : current.selectedInstanceId,
      };
    });
  }

  private applyUpdate(update: StateUpdate): void {
    this.state.update((current) => {
      const newMap = new Map(current.instances);
      const instance = newMap.get(update.instanceId);

      if (instance) {
        newMap.set(update.instanceId, {
          ...instance,
          status: (update.status as InstanceStatus) || instance.status,
          contextUsage: update.contextUsage || instance.contextUsage,
          lastActivity: Date.now(),
        });
      }

      return { ...current, instances: newMap };
    });
  }

  private applyBatchUpdates(updates: StateUpdate[]): void {
    this.state.update((current) => {
      const newMap = new Map(current.instances);

      for (const update of updates) {
        const instance = newMap.get(update.instanceId);
        if (instance) {
          newMap.set(update.instanceId, {
            ...instance,
            status: (update.status as InstanceStatus) || instance.status,
            contextUsage: update.contextUsage || instance.contextUsage,
            lastActivity: Date.now(),
          });
        }
      }

      return { ...current, instances: newMap };
    });
  }

  private addOutput(instanceId: string, message: OutputMessage): void {
    this.state.update((current) => {
      const newMap = new Map(current.instances);
      const instance = newMap.get(instanceId);

      if (instance) {
        const outputBuffer = [...instance.outputBuffer, message];
        // Keep buffer trimmed
        const trimmed = outputBuffer.length > 1000
          ? outputBuffer.slice(-1000)
          : outputBuffer;

        newMap.set(instanceId, {
          ...instance,
          outputBuffer: trimmed,
          lastActivity: Date.now(),
        });
      }

      return { ...current, instances: newMap };
    });
  }

  // ============================================
  // Public Actions
  // ============================================

  /** Get instance by ID */
  getInstance(id: string): Instance | undefined {
    return this.state().instances.get(id);
  }

  /** Set selected instance */
  setSelectedInstance(id: string | null): void {
    this.state.update((s) => ({ ...s, selectedInstanceId: id }));
  }

  /** Create a new instance */
  async createInstance(config: {
    workingDirectory?: string;
    displayName?: string;
    parentId?: string;
    yoloMode?: boolean;
  }): Promise<void> {
    console.log('InstanceStore: createInstance called with:', config);
    this.state.update((s) => ({ ...s, loading: true }));

    try {
      const result = await this.ipc.createInstance({
        workingDirectory: config.workingDirectory || '.',
        displayName: config.displayName,
        parentInstanceId: config.parentId,
        yoloMode: config.yoloMode,
      });
      console.log('InstanceStore: createInstance result:', result);
    } catch (error) {
      console.error('InstanceStore: createInstance error:', error);
      this.state.update((s) => ({
        ...s,
        loading: false,
        error: 'Failed to create instance',
      }));
    }
  }

  /** Create a child instance */
  async createChildInstance(parentId: string): Promise<void> {
    const parent = this.getInstance(parentId);
    if (!parent) return;

    await this.createInstance({
      workingDirectory: parent.workingDirectory,
      displayName: `${parent.displayName} > Child`,
      parentId,
    });
  }

  /** Send input to an instance */
  async sendInput(instanceId: string, message: string, files?: File[]): Promise<void> {
    console.log('InstanceStore: sendInput called', { instanceId, message, filesCount: files?.length });

    // Convert files to base64 for IPC
    const attachments = files && files.length > 0
      ? await Promise.all(files.map((f) => this.fileToAttachment(f)))
      : undefined;

    // Optimistically update status
    this.state.update((current) => {
      const newMap = new Map(current.instances);
      const instance = newMap.get(instanceId);
      if (instance) {
        newMap.set(instanceId, { ...instance, status: 'busy' });
      }
      return { ...current, instances: newMap };
    });

    const result = await this.ipc.sendInput(instanceId, message, attachments);
    console.log('InstanceStore: sendInput result', result);
  }

  /** Terminate an instance */
  async terminateInstance(instanceId: string): Promise<void> {
    await this.ipc.terminateInstance(instanceId);
  }

  /** Restart an instance */
  async restartInstance(instanceId: string): Promise<void> {
    await this.ipc.restartInstance(instanceId);
  }

  /** Rename an instance */
  async renameInstance(instanceId: string, displayName: string): Promise<void> {
    // Optimistic update
    this.state.update((current) => {
      const newMap = new Map(current.instances);
      const instance = newMap.get(instanceId);
      if (instance) {
        newMap.set(instanceId, { ...instance, displayName });
      }
      return { ...current, instances: newMap };
    });

    await this.ipc.renameInstance(instanceId, displayName);
  }

  /** Terminate all instances */
  async terminateAllInstances(): Promise<void> {
    await this.ipc.terminateAllInstances();
  }

  /** Open folder picker and change working directory for an instance */
  async selectWorkingDirectory(instanceId: string): Promise<void> {
    const instance = this.getInstance(instanceId);
    if (!instance) return;

    const folder = await this.ipc.selectFolder();
    if (!folder) return; // User cancelled

    // Terminate old instance and create new one with new working directory
    const { displayName, parentId, yoloMode } = instance;

    await this.terminateInstance(instanceId);

    await this.createInstance({
      workingDirectory: folder,
      displayName,
      parentId: parentId || undefined,
      yoloMode,
    });
  }

  /** Toggle YOLO mode for an instance (requires restart) */
  async toggleYoloMode(instanceId: string): Promise<void> {
    const instance = this.getInstance(instanceId);
    if (!instance) return;

    // Terminate and recreate with opposite YOLO setting
    const { displayName, parentId, workingDirectory, yoloMode } = instance;

    await this.terminateInstance(instanceId);

    await this.createInstance({
      workingDirectory,
      displayName,
      parentId: parentId || undefined,
      yoloMode: !yoloMode,
    });
  }

  /** Clear error state */
  clearError(): void {
    this.state.update((s) => ({ ...s, error: null }));
  }

  // ============================================
  // Helpers
  // ============================================

  private deserializeInstance(data: any): Instance {
    return {
      id: data.id,
      displayName: data.displayName,
      createdAt: data.createdAt,
      parentId: data.parentId,
      childrenIds: data.childrenIds || [],
      status: data.status,
      contextUsage: data.contextUsage || { used: 0, total: 200000, percentage: 0 },
      lastActivity: data.lastActivity,
      sessionId: data.sessionId,
      workingDirectory: data.workingDirectory,
      yoloMode: data.yoloMode ?? true,
      outputBuffer: data.outputBuffer || [],
    };
  }

  private async fileToAttachment(file: File): Promise<{
    name: string;
    type: string;
    size: number;
    data: string;
  }> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve({
          name: file.name,
          type: file.type,
          size: file.size,
          data: reader.result as string,
        });
      };
      reader.readAsDataURL(file);
    });
  }
}
