/**
 * Verification IPC Handlers
 * Handles Git Worktree, Multi-Agent Verification, and Cascade Supervision
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, IpcResponse } from '../../shared/types/ipc.types';
import type {
  WorktreeCreatePayload,
  WorktreeCompletePayload,
  WorktreePreviewMergePayload,
  WorktreeMergePayload,
  WorktreeCleanupPayload,
  WorktreeAbandonPayload,
  WorktreeGetSessionPayload,
  WorktreeDetectConflictsPayload,
  WorktreeSyncPayload,
  VerifyStartPayload,
  VerifyGetResultPayload,
  VerifyGetActivePayload,
  VerifyCancelPayload,
  VerifyConfigurePayload,
  SupervisionCreateTreePayload,
  SupervisionAddWorkerPayload,
  SupervisionStartWorkerPayload,
  SupervisionStopWorkerPayload,
  SupervisionHandleFailurePayload,
  SupervisionGetTreePayload,
  SupervisionGetHealthPayload,
} from '../../shared/types/ipc.types';
import { getWorktreeManager } from '../git/worktree-manager';
import { getMultiVerifyCoordinator } from '../orchestration/multi-verify-coordinator';
import { getSupervisor } from '../orchestration/supervisor';
import { getAllPersonalities, getPersonalityDescription } from '../orchestration/personalities';
import type { MergeStrategy, WorktreeConfig } from '../../shared/types/worktree.types';
import type { VerificationConfig, PersonalityType, SynthesisStrategy } from '../../shared/types/verification.types';
import type { SupervisorConfig, ChildSpec } from '../../shared/types/supervision.types';

export function registerVerificationHandlers(): void {
  // ============================================
  // Git Worktree Handlers
  // ============================================

  // Create a new worktree session
  ipcMain.handle(
    IPC_CHANNELS.WORKTREE_CREATE,
    async (
      event: IpcMainInvokeEvent,
      payload: WorktreeCreatePayload
    ): Promise<IpcResponse> => {
      try {
        const options = {
          baseBranch: payload.baseBranch,
          ...payload.config,
        };
        const session = await getWorktreeManager().createWorktree(
          payload.instanceId,
          payload.taskDescription,
          options
        );
        return { success: true, data: session };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'WORKTREE_CREATE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Complete a worktree session (mark as ready for merge)
  ipcMain.handle(
    IPC_CHANNELS.WORKTREE_COMPLETE,
    async (
      event: IpcMainInvokeEvent,
      payload: WorktreeCompletePayload
    ): Promise<IpcResponse> => {
      try {
        const session = await getWorktreeManager().completeWorktree(payload.sessionId);
        return { success: true, data: session };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'WORKTREE_COMPLETE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Preview merge for a worktree session
  ipcMain.handle(
    IPC_CHANNELS.WORKTREE_PREVIEW_MERGE,
    async (
      event: IpcMainInvokeEvent,
      payload: WorktreePreviewMergePayload
    ): Promise<IpcResponse> => {
      try {
        const preview = await getWorktreeManager().previewMerge(payload.sessionId);
        return { success: true, data: preview };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'WORKTREE_PREVIEW_MERGE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Merge a worktree session
  ipcMain.handle(
    IPC_CHANNELS.WORKTREE_MERGE,
    async (
      event: IpcMainInvokeEvent,
      payload: WorktreeMergePayload
    ): Promise<IpcResponse> => {
      try {
        const options = {
          strategy: payload.strategy as MergeStrategy | undefined,
          commitMessage: payload.commitMessage,
        };
        const result = await getWorktreeManager().mergeWorktree(
          payload.sessionId,
          options
        );
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'WORKTREE_MERGE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Cleanup a worktree session
  ipcMain.handle(
    IPC_CHANNELS.WORKTREE_CLEANUP,
    async (
      event: IpcMainInvokeEvent,
      payload: WorktreeCleanupPayload
    ): Promise<IpcResponse> => {
      try {
        await getWorktreeManager().cleanupWorktree(payload.sessionId);
        return { success: true, data: null };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'WORKTREE_CLEANUP_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Abandon a worktree session
  ipcMain.handle(
    IPC_CHANNELS.WORKTREE_ABANDON,
    async (
      event: IpcMainInvokeEvent,
      payload: WorktreeAbandonPayload
    ): Promise<IpcResponse> => {
      try {
        const session = await getWorktreeManager().abandonWorktree(
          payload.sessionId,
          payload.reason
        );
        return { success: true, data: session };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'WORKTREE_ABANDON_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Get a worktree session
  ipcMain.handle(
    IPC_CHANNELS.WORKTREE_GET_SESSION,
    async (
      event: IpcMainInvokeEvent,
      payload: WorktreeGetSessionPayload
    ): Promise<IpcResponse> => {
      try {
        const session = getWorktreeManager().getSession(payload.sessionId);
        if (!session) {
          return {
            success: false,
            error: {
              code: 'WORKTREE_SESSION_NOT_FOUND',
              message: `Worktree session not found: ${payload.sessionId}`,
              timestamp: Date.now(),
            },
          };
        }
        return { success: true, data: session };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'WORKTREE_GET_SESSION_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // List all worktree sessions
  ipcMain.handle(
    IPC_CHANNELS.WORKTREE_LIST_SESSIONS,
    async (): Promise<IpcResponse> => {
      try {
        const sessions = getWorktreeManager().listSessions();
        return { success: true, data: sessions };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'WORKTREE_LIST_SESSIONS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Detect cross-worktree conflicts
  ipcMain.handle(
    IPC_CHANNELS.WORKTREE_DETECT_CONFLICTS,
    async (
      event: IpcMainInvokeEvent,
      payload: WorktreeDetectConflictsPayload
    ): Promise<IpcResponse> => {
      try {
        // Get the first session to detect conflicts for
        const sessionId = payload.sessionIds[0];
        if (!sessionId) {
          return { success: true, data: [] };
        }

        const session = getWorktreeManager().getSession(sessionId);
        if (!session) {
          return {
            success: false,
            error: {
              code: 'WORKTREE_SESSION_NOT_FOUND',
              message: `Worktree session not found: ${sessionId}`,
              timestamp: Date.now(),
            },
          };
        }

        // Get the files changed in this session
        const conflicts = await getWorktreeManager().detectCrossWorktreeConflicts(
          sessionId,
          session.filesChanged || []
        );
        return { success: true, data: conflicts };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'WORKTREE_DETECT_CONFLICTS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Sync worktree with remote
  ipcMain.handle(
    IPC_CHANNELS.WORKTREE_SYNC,
    async (
      event: IpcMainInvokeEvent,
      payload: WorktreeSyncPayload
    ): Promise<IpcResponse> => {
      try {
        await getWorktreeManager().syncWithRemote(payload.sessionId);
        return { success: true, data: null };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'WORKTREE_SYNC_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // ============================================
  // Multi-Agent Verification Handlers
  // ============================================

  // Start a verification
  ipcMain.handle(
    IPC_CHANNELS.VERIFY_START,
    async (
      event: IpcMainInvokeEvent,
      payload: VerifyStartPayload
    ): Promise<IpcResponse> => {
      try {
        const config: Partial<VerificationConfig> = {};
        if (payload.config) {
          if (payload.config.minAgents) config.agentCount = payload.config.minAgents;
          if (payload.config.synthesisStrategy) {
            config.synthesisStrategy = payload.config.synthesisStrategy as SynthesisStrategy;
          }
          if (payload.config.personalities) {
            config.personalities = payload.config.personalities as PersonalityType[];
          }
          if (payload.config.confidenceThreshold) {
            config.confidenceThreshold = payload.config.confidenceThreshold;
          }
          if (payload.config.timeoutMs) config.timeout = payload.config.timeoutMs;
          if (payload.config.maxDebateRounds) {
            config.maxDebateRounds = payload.config.maxDebateRounds;
          }
        }

        const verificationId = await getMultiVerifyCoordinator().startVerification(
          payload.instanceId,
          payload.prompt,
          config,
          payload.context,
          payload.taskType
        );
        const result = { verificationId };
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'VERIFY_START_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Get verification result
  ipcMain.handle(
    IPC_CHANNELS.VERIFY_GET_RESULT,
    async (
      event: IpcMainInvokeEvent,
      payload: VerifyGetResultPayload
    ): Promise<IpcResponse> => {
      try {
        const result = getMultiVerifyCoordinator().getResult(payload.verificationId);
        if (!result) {
          return {
            success: false,
            error: {
              code: 'VERIFY_RESULT_NOT_FOUND',
              message: `Verification result not found: ${payload.verificationId}`,
              timestamp: Date.now(),
            },
          };
        }
        return { success: true, data: result };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'VERIFY_GET_RESULT_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Get active verifications
  ipcMain.handle(
    IPC_CHANNELS.VERIFY_GET_ACTIVE,
    async (
      event: IpcMainInvokeEvent,
      payload?: VerifyGetActivePayload
    ): Promise<IpcResponse> => {
      try {
        const active = getMultiVerifyCoordinator().getActiveVerifications();
        return { success: true, data: active };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'VERIFY_GET_ACTIVE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Cancel a verification
  ipcMain.handle(
    IPC_CHANNELS.VERIFY_CANCEL,
    async (
      event: IpcMainInvokeEvent,
      payload: VerifyCancelPayload
    ): Promise<IpcResponse> => {
      try {
        getMultiVerifyCoordinator().cancelVerification(payload.verificationId);
        return { success: true, data: null };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'VERIFY_CANCEL_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Get available personalities
  ipcMain.handle(
    IPC_CHANNELS.VERIFY_GET_PERSONALITIES,
    async (): Promise<IpcResponse> => {
      try {
        const personalities = getAllPersonalities().map((p) => ({
          type: p,
          description: getPersonalityDescription(p),
        }));
        return { success: true, data: personalities };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'VERIFY_GET_PERSONALITIES_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Configure verification defaults
  ipcMain.handle(
    IPC_CHANNELS.VERIFY_CONFIGURE,
    async (
      event: IpcMainInvokeEvent,
      payload: VerifyConfigurePayload
    ): Promise<IpcResponse> => {
      try {
        const config: Partial<VerificationConfig> = {};
        if (payload.config.minAgents) config.agentCount = payload.config.minAgents;
        if (payload.config.synthesisStrategy) {
          config.synthesisStrategy = payload.config.synthesisStrategy as SynthesisStrategy;
        }
        if (payload.config.confidenceThreshold) {
          config.confidenceThreshold = payload.config.confidenceThreshold;
        }
        if (payload.config.timeoutMs) config.timeout = payload.config.timeoutMs;

        getMultiVerifyCoordinator().setDefaultConfig(config);
        return { success: true, data: config };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'VERIFY_CONFIGURE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // ============================================
  // Cascade Supervision Handlers
  // ============================================

  // Create a supervision tree
  ipcMain.handle(
    IPC_CHANNELS.SUPERVISION_CREATE_TREE,
    async (
      event: IpcMainInvokeEvent,
      payload: SupervisionCreateTreePayload
    ): Promise<IpcResponse> => {
      try {
        const config: Partial<SupervisorConfig> = {};
        if (payload.config) {
          if (payload.config.strategy) {
            config.strategy = payload.config.strategy;
          }
          if (payload.config.maxRestarts !== undefined) {
            config.maxRestarts = payload.config.maxRestarts;
          }
          if (payload.config.maxTime !== undefined) {
            config.maxTime = payload.config.maxTime;
          }
          if (payload.config.onExhausted) {
            config.onExhausted = payload.config.onExhausted;
          }
          if (payload.config.backoff) {
            config.backoff = {
              minDelayMs: payload.config.backoff.minDelayMs ?? 100,
              maxDelayMs: payload.config.backoff.maxDelayMs ?? 30000,
              factor: payload.config.backoff.factor ?? 2,
              jitter: payload.config.backoff.jitter ?? true,
              resetAfterMs: 5000,
            };
          }
          if (payload.config.healthCheck) {
            config.healthCheck = {
              intervalMs: payload.config.healthCheck.intervalMs ?? 30000,
              timeoutMs: payload.config.healthCheck.timeoutMs ?? 5000,
              unhealthyThreshold: payload.config.healthCheck.unhealthyThreshold ?? 3,
            };
          }
        }

        const tree = getSupervisor().createTree(payload.instanceId, config);
        return { success: true, data: tree };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SUPERVISION_CREATE_TREE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Add a worker to the supervision tree
  ipcMain.handle(
    IPC_CHANNELS.SUPERVISION_ADD_WORKER,
    async (
      event: IpcMainInvokeEvent,
      payload: SupervisionAddWorkerPayload
    ): Promise<IpcResponse> => {
      try {
        // Create a child spec from the payload
        // Note: startFunc and stopFunc will be resolved from registered functions
        const spec: ChildSpec = {
          id: payload.spec.id,
          name: payload.spec.name,
          restartType: payload.spec.restartType,
          dependencies: payload.spec.dependencies,
          order: payload.spec.order ?? 0,
          // These will be resolved from the function registry
          startFunc: async () => {
            // Placeholder - actual implementation would resolve from function registry
            return `worker-${Date.now()}`;
          },
        };

        const worker = getSupervisor().addWorker(
          payload.instanceId,
          spec,
          payload.parentId
        );
        return { success: true, data: worker };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SUPERVISION_ADD_WORKER_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Start a worker
  ipcMain.handle(
    IPC_CHANNELS.SUPERVISION_START_WORKER,
    async (
      event: IpcMainInvokeEvent,
      payload: SupervisionStartWorkerPayload
    ): Promise<IpcResponse> => {
      try {
        await getSupervisor().startWorker(payload.instanceId, payload.workerId);
        return { success: true, data: null };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SUPERVISION_START_WORKER_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Stop a worker
  ipcMain.handle(
    IPC_CHANNELS.SUPERVISION_STOP_WORKER,
    async (
      event: IpcMainInvokeEvent,
      payload: SupervisionStopWorkerPayload
    ): Promise<IpcResponse> => {
      try {
        await getSupervisor().stopWorker(payload.instanceId, payload.workerId);
        return { success: true, data: null };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SUPERVISION_STOP_WORKER_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Handle a worker failure
  ipcMain.handle(
    IPC_CHANNELS.SUPERVISION_HANDLE_FAILURE,
    async (
      event: IpcMainInvokeEvent,
      payload: SupervisionHandleFailurePayload
    ): Promise<IpcResponse> => {
      try {
        await getSupervisor().handleFailure(
          payload.instanceId,
          payload.childInstanceId,
          payload.error
        );
        return { success: true, data: null };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SUPERVISION_HANDLE_FAILURE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Get the supervision tree
  ipcMain.handle(
    IPC_CHANNELS.SUPERVISION_GET_TREE,
    async (
      event: IpcMainInvokeEvent,
      payload: SupervisionGetTreePayload
    ): Promise<IpcResponse> => {
      try {
        const tree = getSupervisor().getTree(payload.instanceId);
        if (!tree) {
          return {
            success: false,
            error: {
              code: 'SUPERVISION_TREE_NOT_FOUND',
              message: `Supervision tree not found: ${payload.instanceId}`,
              timestamp: Date.now(),
            },
          };
        }
        return { success: true, data: tree };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SUPERVISION_GET_TREE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Get health status
  ipcMain.handle(
    IPC_CHANNELS.SUPERVISION_GET_HEALTH,
    async (
      event: IpcMainInvokeEvent,
      payload: SupervisionGetHealthPayload
    ): Promise<IpcResponse> => {
      try {
        const tree = getSupervisor().getTree(payload.instanceId);
        if (!tree) {
          return {
            success: false,
            error: {
              code: 'SUPERVISION_TREE_NOT_FOUND',
              message: `Supervision tree not found: ${payload.instanceId}`,
              timestamp: Date.now(),
            },
          };
        }
        return { success: true, data: tree.root.healthStatus };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'SUPERVISION_GET_HEALTH_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );
}
