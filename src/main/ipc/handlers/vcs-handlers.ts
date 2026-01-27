/**
 * VCS IPC Handlers
 * Handles Git/version control system operations
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, IpcResponse } from '../../../shared/types/ipc.types';
import type {
  VcsIsRepoPayload,
  VcsGetStatusPayload,
  VcsGetBranchesPayload,
  VcsGetCommitsPayload,
  VcsGetDiffPayload,
  VcsGetFileHistoryPayload,
  VcsGetFileAtCommitPayload,
  VcsGetBlamePayload
} from '../../../shared/types/ipc.types';
import { createVcsManager, isGitAvailable } from '../../workspace/git/vcs-manager';

export function registerVcsHandlers(): void {
  // Check if working directory is a git repository
  ipcMain.handle(
    IPC_CHANNELS.VCS_IS_REPO,
    async (
      event: IpcMainInvokeEvent,
      payload: VcsIsRepoPayload
    ): Promise<IpcResponse> => {
      try {
        if (!isGitAvailable()) {
          return {
            success: true,
            data: { isRepo: false, gitAvailable: false }
          };
        }
        const vcs = createVcsManager(payload.workingDirectory);
        const isRepo = vcs.isGitRepository();
        const gitRoot = isRepo ? vcs.findGitRoot() : null;
        return {
          success: true,
          data: { isRepo, gitRoot, gitAvailable: true }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'VCS_IS_REPO_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get git status
  ipcMain.handle(
    IPC_CHANNELS.VCS_GET_STATUS,
    async (
      event: IpcMainInvokeEvent,
      payload: VcsGetStatusPayload
    ): Promise<IpcResponse> => {
      try {
        const vcs = createVcsManager(payload.workingDirectory);
        const status = vcs.getStatus();
        return {
          success: true,
          data: status
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'VCS_GET_STATUS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get branches
  ipcMain.handle(
    IPC_CHANNELS.VCS_GET_BRANCHES,
    async (
      event: IpcMainInvokeEvent,
      payload: VcsGetBranchesPayload
    ): Promise<IpcResponse> => {
      try {
        const vcs = createVcsManager(payload.workingDirectory);
        const branches = vcs.getBranches();
        const currentBranch = vcs.getCurrentBranch();
        return {
          success: true,
          data: { branches, currentBranch }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'VCS_GET_BRANCHES_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get recent commits
  ipcMain.handle(
    IPC_CHANNELS.VCS_GET_COMMITS,
    async (
      event: IpcMainInvokeEvent,
      payload: VcsGetCommitsPayload
    ): Promise<IpcResponse> => {
      try {
        const vcs = createVcsManager(payload.workingDirectory);
        const commits = vcs.getRecentCommits(payload.limit || 50);
        return {
          success: true,
          data: commits
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'VCS_GET_COMMITS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get diff
  ipcMain.handle(
    IPC_CHANNELS.VCS_GET_DIFF,
    async (
      event: IpcMainInvokeEvent,
      payload: VcsGetDiffPayload
    ): Promise<IpcResponse> => {
      try {
        const vcs = createVcsManager(payload.workingDirectory);
        let diff;

        if (payload.filePath) {
          diff = vcs.getFileDiff(payload.filePath, payload.type === 'staged');
        } else if (payload.type === 'staged') {
          diff = vcs.getStagedDiff();
        } else if (payload.type === 'unstaged') {
          diff = vcs.getUnstagedDiff();
        } else if (
          payload.type === 'between' &&
          payload.fromRef &&
          payload.toRef
        ) {
          diff = vcs.getDiffBetween(payload.fromRef, payload.toRef);
        } else {
          diff = vcs.getUnstagedDiff();
        }

        const stats = vcs.getDiffStats(payload.type === 'staged');

        return {
          success: true,
          data: { diff, stats }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'VCS_GET_DIFF_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get file history
  ipcMain.handle(
    IPC_CHANNELS.VCS_GET_FILE_HISTORY,
    async (
      event: IpcMainInvokeEvent,
      payload: VcsGetFileHistoryPayload
    ): Promise<IpcResponse> => {
      try {
        const vcs = createVcsManager(payload.workingDirectory);
        const history = vcs.getFileHistory(
          payload.filePath,
          payload.limit || 20
        );
        const isTracked = vcs.isFileTracked(payload.filePath);
        return {
          success: true,
          data: { history, isTracked }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'VCS_GET_FILE_HISTORY_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get file at specific commit
  ipcMain.handle(
    IPC_CHANNELS.VCS_GET_FILE_AT_COMMIT,
    async (
      event: IpcMainInvokeEvent,
      payload: VcsGetFileAtCommitPayload
    ): Promise<IpcResponse> => {
      try {
        const vcs = createVcsManager(payload.workingDirectory);
        const content = vcs.getFileAtCommit(
          payload.filePath,
          payload.commitHash
        );
        return {
          success: true,
          data: { content }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'VCS_GET_FILE_AT_COMMIT_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );

  // Get blame for file
  ipcMain.handle(
    IPC_CHANNELS.VCS_GET_BLAME,
    async (
      event: IpcMainInvokeEvent,
      payload: VcsGetBlamePayload
    ): Promise<IpcResponse> => {
      try {
        const vcs = createVcsManager(payload.workingDirectory);
        const blame = vcs.getBlame(payload.filePath);
        return {
          success: true,
          data: { blame }
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'VCS_GET_BLAME_FAILED',
            message: (error as Error).message,
            timestamp: Date.now()
          }
        };
      }
    }
  );
}
