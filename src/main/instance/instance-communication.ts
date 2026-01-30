/**
 * Instance Communication Manager - Handles adapter events and message passing
 */

import { EventEmitter } from 'events';
import type { CliAdapter } from '../cli/adapters/adapter-factory';
import { getHistoryManager } from '../history';
import { getSettingsManager } from '../core/config/settings-manager';
import { getOutputStorageManager } from '../memory';
import type {
  Instance,
  InstanceStatus,
  ContextUsage,
  OutputMessage
} from '../../shared/types/instance.types';
import { generateId } from '../../shared/utils/id-generator';

/**
 * Dependencies required by the communication manager
 */
export interface CommunicationDependencies {
  getInstance: (id: string) => Instance | undefined;
  getAdapter: (id: string) => CliAdapter | undefined;
  setAdapter: (id: string, adapter: CliAdapter) => void;
  deleteAdapter: (id: string) => boolean;
  queueUpdate: (instanceId: string, status: InstanceStatus, contextUsage?: ContextUsage) => void;
  processOrchestrationOutput: (instanceId: string, content: string) => void;
  onInterruptedExit: (instanceId: string) => Promise<void>;
  ingestToRLM: (instanceId: string, message: OutputMessage) => void;
  ingestToUnifiedMemory: (instance: Instance, message: OutputMessage) => void;
}

export class InstanceCommunicationManager extends EventEmitter {
  private settings = getSettingsManager();
  private outputStorage = getOutputStorageManager();
  private deps: CommunicationDependencies;
  private interruptedInstances: Set<string> = new Set();

  constructor(deps: CommunicationDependencies) {
    super();
    this.deps = deps;
  }

  // ============================================
  // Message Sending
  // ============================================

  /**
   * Send input to an instance
   */
  async sendInput(
    instanceId: string,
    message: string,
    attachments?: any[],
    contextBlock?: string | null
  ): Promise<void> {
    console.log(`[InstanceCommunicationManager] sendInput called for ${instanceId}`);
    const instance = this.deps.getInstance(instanceId);
    const adapter = this.deps.getAdapter(instanceId);

    console.log(`[InstanceCommunicationManager] Instance exists: ${!!instance}, Adapter exists: ${!!adapter}`);

    if (!adapter) {
      console.error(`[InstanceCommunicationManager] No adapter found for ${instanceId}`);
      throw new Error(`Instance ${instanceId} not found`);
    }

    if (instance?.status === 'error') {
      throw new Error(`Instance ${instanceId} is in error state and cannot accept input`);
    }

    const finalMessage = contextBlock ? `${contextBlock}\n\n${message}` : message;

    console.log('InstanceCommunicationManager: Sending message to adapter...');
    await adapter.sendInput(finalMessage, attachments);
    console.log('InstanceCommunicationManager: Message sent to adapter');
  }

  /**
   * Send a raw input response (for permission prompts, etc.)
   */
  async sendInputResponse(
    instanceId: string,
    response: string,
    permissionKey?: string
  ): Promise<void> {
    const adapter = this.deps.getAdapter(instanceId);
    if (!adapter) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    const instance = this.deps.getInstance(instanceId);
    if (instance) {
      instance.lastActivity = Date.now();
    }

    console.log(`InstanceCommunicationManager: Sending input response to ${instanceId}: ${response}`);
    if (permissionKey) {
      console.log(`InstanceCommunicationManager: Permission key: ${permissionKey}`);
    }

    if ('sendRaw' in adapter && typeof (adapter as any).sendRaw === 'function') {
      await (adapter as any).sendRaw(response, permissionKey);
    } else {
      await adapter.sendInput(response);
    }
  }

  // ============================================
  // Adapter Event Setup
  // ============================================

  /**
   * Set up event handlers for a CLI adapter
   */
  setupAdapterEvents(instanceId: string, adapter: CliAdapter): void {
    adapter.on('output', (message: OutputMessage) => {
      const instance = this.deps.getInstance(instanceId);
      if (instance) {
        this.addToOutputBuffer(instance, message);
        this.emit('output', { instanceId, message });

        // Check for orchestration commands in assistant output
        if (message.type === 'assistant' && message.content) {
          this.deps.processOrchestrationOutput(instanceId, message.content);
        }
      }
    });

    adapter.on('status', (status: InstanceStatus) => {
      const instance = this.deps.getInstance(instanceId);
      if (instance && instance.status !== status) {
        instance.status = status;
        instance.lastActivity = Date.now();
        this.deps.queueUpdate(instanceId, status, instance.contextUsage);
      }
    });

    adapter.on('context', (usage: ContextUsage) => {
      const instance = this.deps.getInstance(instanceId);
      if (instance) {
        instance.contextUsage = usage;
        instance.totalTokensUsed = usage.used;
        this.deps.queueUpdate(instanceId, instance.status, usage);
      }
    });

    adapter.on('input_required', (payload: { id: string; prompt: string; timestamp: number; metadata?: Record<string, unknown> }) => {
      console.log('=== [InstanceCommunicationManager] INPUT_REQUIRED EVENT RECEIVED ===');
      console.log('[InstanceCommunicationManager] Instance ID:', instanceId);
      console.log('[InstanceCommunicationManager] Payload:', JSON.stringify(payload, null, 2));

      this.emit('input-required', {
        instanceId,
        requestId: payload.id,
        prompt: payload.prompt,
        timestamp: payload.timestamp,
        metadata: payload.metadata
      });

      console.log('[InstanceCommunicationManager] input-required event emitted');
    });

    adapter.on('error', (error: Error) => {
      const instance = this.deps.getInstance(instanceId);
      if (instance) {
        instance.errorCount++;
        instance.status = 'error';
        this.deps.queueUpdate(instanceId, 'error');
      }
      console.error(`Instance ${instanceId} error:`, error);

      this.forceCleanupAdapter(instanceId).catch((cleanupErr) => {
        console.error(`Failed to cleanup adapter for ${instanceId} after error:`, cleanupErr);
      });
    });

    adapter.on('exit', (code: number | null, signal: string | null) => {
      console.log(
        `Adapter exit event for instance ${instanceId}: code=${code}, signal=${signal}`
      );

      const instance = this.deps.getInstance(instanceId);
      if (!instance) {
        console.log(`Adapter exit event for ${instanceId} but instance not found - ignoring`);
        return;
      }

      // Check if this adapter is still the current adapter for this instance
      // If not, a new adapter has been set (e.g., during YOLO toggle) and we should
      // not delete it or modify instance state
      const currentAdapter = this.deps.getAdapter(instanceId);
      console.log(`Adapter exit check: currentAdapter=${currentAdapter ? 'exists' : 'undefined'}, adapter=${adapter ? 'exists' : 'undefined'}, same=${currentAdapter === adapter}`);
      if (currentAdapter !== adapter) {
        console.log(
          `Adapter exit event for ${instanceId} but adapter has been replaced - ignoring`
        );
        return;
      }

      // Check if this was an interrupted instance that needs respawning
      if (this.interruptedInstances.has(instanceId)) {
        console.log(
          `Instance ${instanceId} was interrupted, will respawn with --resume`
        );
        this.interruptedInstances.delete(instanceId);
        this.deps.onInterruptedExit(instanceId).catch((err) => {
          console.error(
            `Failed to respawn instance ${instanceId} after interrupt:`,
            err
          );
          instance.status = 'error';
          instance.processId = null;
          this.deps.queueUpdate(instanceId, 'error');
        });
        return;
      }

      if (instance.status !== 'terminated') {
        const newStatus = code === 0 ? 'terminated' : 'error';
        console.log(
          `Instance ${instanceId} exited unexpectedly, marking as ${newStatus}`
        );
        instance.status = newStatus;
        instance.processId = null;
        this.deps.queueUpdate(instanceId, instance.status);

        this.deps.deleteAdapter(instanceId);

        // Archive crashed/unexpectedly terminated instances to history
        if (!instance.parentId && instance.outputBuffer.length > 0) {
          const history = getHistoryManager();
          history.archiveInstance(instance, newStatus === 'error' ? 'error' : 'completed')
            .catch((err) => {
              console.error(`Failed to archive crashed instance ${instanceId} to history:`, err);
            });
        }
      }
    });
  }

  // ============================================
  // Interrupt Handling
  // ============================================

  /**
   * Mark an instance as interrupted
   */
  markInterrupted(instanceId: string): void {
    this.interruptedInstances.add(instanceId);
  }

  /**
   * Remove interrupt marking
   */
  clearInterrupted(instanceId: string): void {
    this.interruptedInstances.delete(instanceId);
  }

  /**
   * Check if an instance was interrupted
   */
  isInterrupted(instanceId: string): boolean {
    return this.interruptedInstances.has(instanceId);
  }

  // ============================================
  // Output Buffer Management
  // ============================================

  /**
   * Add message to instance output buffer
   */
  addToOutputBuffer(instance: Instance, message: OutputMessage): void {
    const isStreaming = message.metadata && 'streaming' in message.metadata && message.metadata['streaming'] === true;

    if (isStreaming) {
      const existingIndex = instance.outputBuffer.findIndex(m => m.id === message.id);
      if (existingIndex >= 0) {
        const accumulatedContent = message.metadata && 'accumulatedContent' in message.metadata
          ? String(message.metadata['accumulatedContent'])
          : message.content;
        instance.outputBuffer[existingIndex] = {
          ...instance.outputBuffer[existingIndex],
          content: accumulatedContent,
          metadata: message.metadata
        };
        this.emit('output', {
          instanceId: instance.id,
          message: instance.outputBuffer[existingIndex]
        });
        return;
      }
    }

    instance.outputBuffer.push(message);

    const settings = this.settings.getAll();
    const bufferSize = settings.outputBufferSize;

    if (instance.outputBuffer.length > bufferSize) {
      if (settings.enableDiskStorage) {
        const overflow = instance.outputBuffer.slice(
          0,
          instance.outputBuffer.length - bufferSize
        );
        this.outputStorage.storeMessages(instance.id, overflow).catch((err) => {
          console.error(
            `Failed to store output to disk for ${instance.id}:`,
            err
          );
        });
      }

      instance.outputBuffer = instance.outputBuffer.slice(-bufferSize);
    }

    // Ingest to context systems
    this.deps.ingestToRLM(instance.id, message);
    this.deps.ingestToUnifiedMemory(instance, message);
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Force cleanup an adapter when errors occur
   */
  async forceCleanupAdapter(instanceId: string): Promise<void> {
    const adapter = this.deps.getAdapter(instanceId);
    if (!adapter) return;

    console.log(`Force cleaning up adapter for instance ${instanceId}`);

    try {
      await adapter.terminate(false);
    } catch (error) {
      console.error(`Error during force cleanup of ${instanceId}:`, error);
    } finally {
      this.deps.deleteAdapter(instanceId);
    }
  }
}
