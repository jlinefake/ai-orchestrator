/**
 * LLM IPC Handlers
 * Handles LLM service operations including streaming responses
 */

import { ipcMain, BrowserWindow, IpcMainInvokeEvent } from 'electron';
import { IPC_CHANNELS, IpcResponse } from '../../shared/types/ipc.types';
import type {
  LLMSummarizePayload,
  LLMSubQueryPayload,
  LLMCancelStreamPayload,
  LLMCountTokensPayload,
  LLMTruncateTokensPayload,
  LLMSetConfigPayload,
} from '../../shared/types/ipc.types';
import { getLLMService, StreamChunk } from '../rlm/llm-service';
import { getTokenCounter } from '../rlm/token-counter';

/**
 * Get the main window for sending events
 */
function getMainWindow(): BrowserWindow | null {
  const windows = BrowserWindow.getAllWindows();
  return windows.length > 0 ? windows[0] : null;
}

/**
 * Send a streaming chunk to the renderer
 */
function sendStreamChunk(chunk: StreamChunk): void {
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.LLM_STREAM_CHUNK, chunk);
  }
}

/**
 * Register all LLM-related IPC handlers
 */
export function registerLLMHandlers(): void {
  const llm = getLLMService();
  const tokenCounter = getTokenCounter();

  // ============================================
  // Non-streaming handlers
  // ============================================

  // Summarize content (non-streaming)
  ipcMain.handle(
    IPC_CHANNELS.LLM_SUMMARIZE,
    async (
      _event: IpcMainInvokeEvent,
      payload: LLMSummarizePayload
    ): Promise<IpcResponse> => {
      try {
        const summary = await llm.summarize({
          requestId: payload.requestId,
          content: payload.content,
          targetTokens: payload.targetTokens,
          preserveKeyPoints: payload.preserveKeyPoints,
        });
        return {
          success: true,
          data: {
            requestId: payload.requestId,
            summary,
            originalTokens: llm.countTokens(payload.content),
            summaryTokens: llm.countTokens(summary),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LLM_SUMMARIZE_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Sub-query (non-streaming)
  ipcMain.handle(
    IPC_CHANNELS.LLM_SUBQUERY,
    async (
      _event: IpcMainInvokeEvent,
      payload: LLMSubQueryPayload
    ): Promise<IpcResponse> => {
      try {
        const response = await llm.subQuery({
          requestId: payload.requestId,
          prompt: payload.prompt,
          context: payload.context,
          depth: payload.depth,
        });
        return {
          success: true,
          data: {
            requestId: payload.requestId,
            response,
            depth: payload.depth,
            tokens: {
              input: llm.countTokens(payload.context + payload.prompt),
              output: llm.countTokens(response),
            },
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LLM_SUBQUERY_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // ============================================
  // Streaming handlers
  // ============================================

  // Summarize with streaming
  // This initiates the stream and returns immediately.
  // Chunks are sent via IPC events to the renderer.
  ipcMain.handle(
    IPC_CHANNELS.LLM_SUMMARIZE_STREAM,
    async (
      _event: IpcMainInvokeEvent,
      payload: LLMSummarizePayload
    ): Promise<IpcResponse> => {
      try {
        // Start streaming in background
        const streamGenerator = llm.summarizeStreaming({
          requestId: payload.requestId,
          content: payload.content,
          targetTokens: payload.targetTokens,
          preserveKeyPoints: payload.preserveKeyPoints,
        });

        // Process stream and send chunks to renderer
        processStreamInBackground(streamGenerator, payload.requestId);

        return {
          success: true,
          data: {
            requestId: payload.requestId,
            streaming: true,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LLM_SUMMARIZE_STREAM_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Sub-query with streaming
  ipcMain.handle(
    IPC_CHANNELS.LLM_SUBQUERY_STREAM,
    async (
      _event: IpcMainInvokeEvent,
      payload: LLMSubQueryPayload
    ): Promise<IpcResponse> => {
      try {
        // Start streaming in background
        const streamGenerator = llm.subQueryStreaming({
          requestId: payload.requestId,
          prompt: payload.prompt,
          context: payload.context,
          depth: payload.depth,
        });

        // Process stream and send chunks to renderer
        processStreamInBackground(streamGenerator, payload.requestId);

        return {
          success: true,
          data: {
            requestId: payload.requestId,
            streaming: true,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LLM_SUBQUERY_STREAM_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Cancel an active stream
  ipcMain.handle(
    IPC_CHANNELS.LLM_CANCEL_STREAM,
    async (
      _event: IpcMainInvokeEvent,
      payload: LLMCancelStreamPayload
    ): Promise<IpcResponse> => {
      try {
        const cancelled = llm.cancelStream(payload.requestId);
        return {
          success: true,
          data: { cancelled, requestId: payload.requestId },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LLM_CANCEL_STREAM_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // ============================================
  // Token counting handlers
  // ============================================

  // Count tokens in text
  ipcMain.handle(
    IPC_CHANNELS.LLM_COUNT_TOKENS,
    async (
      _event: IpcMainInvokeEvent,
      payload: LLMCountTokensPayload
    ): Promise<IpcResponse> => {
      try {
        const count = tokenCounter.countTokens(payload.text, payload.model);
        return {
          success: true,
          data: { count, model: payload.model },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LLM_COUNT_TOKENS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Truncate text to token limit
  ipcMain.handle(
    IPC_CHANNELS.LLM_TRUNCATE_TOKENS,
    async (
      _event: IpcMainInvokeEvent,
      payload: LLMTruncateTokensPayload
    ): Promise<IpcResponse> => {
      try {
        const truncated = tokenCounter.truncateToTokens(
          payload.text,
          payload.maxTokens,
          payload.model
        );
        return {
          success: true,
          data: {
            truncated,
            originalTokens: tokenCounter.countTokens(payload.text, payload.model),
            truncatedTokens: tokenCounter.countTokens(truncated, payload.model),
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LLM_TRUNCATE_TOKENS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // ============================================
  // Configuration handlers
  // ============================================

  // Get LLM configuration
  ipcMain.handle(
    IPC_CHANNELS.LLM_GET_CONFIG,
    async (): Promise<IpcResponse> => {
      try {
        const config = llm.getConfig();
        // Mask API keys for security
        const safeConfig = {
          ...config,
          anthropicApiKey: config.anthropicApiKey ? '***' : undefined,
          openaiApiKey: config.openaiApiKey ? '***' : undefined,
        };
        return { success: true, data: safeConfig };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LLM_GET_CONFIG_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Set LLM configuration
  ipcMain.handle(
    IPC_CHANNELS.LLM_SET_CONFIG,
    async (
      _event: IpcMainInvokeEvent,
      payload: LLMSetConfigPayload
    ): Promise<IpcResponse> => {
      try {
        llm.configure(payload);
        const config = llm.getConfig();
        // Mask API keys for security
        const safeConfig = {
          ...config,
          anthropicApiKey: config.anthropicApiKey ? '***' : undefined,
          openaiApiKey: config.openaiApiKey ? '***' : undefined,
        };
        return { success: true, data: safeConfig };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LLM_SET_CONFIG_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );

  // Get provider status
  ipcMain.handle(
    IPC_CHANNELS.LLM_GET_STATUS,
    async (): Promise<IpcResponse> => {
      try {
        const status = llm.getProviderStatus();
        const available = await llm.isAvailable();
        return {
          success: true,
          data: {
            providers: status,
            available,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LLM_GET_STATUS_FAILED',
            message: (error as Error).message,
            timestamp: Date.now(),
          },
        };
      }
    }
  );
}

/**
 * Process a stream generator in the background and send chunks to renderer
 */
async function processStreamInBackground(
  generator: AsyncGenerator<StreamChunk, string, unknown>,
  requestId: string
): Promise<void> {
  try {
    for await (const chunk of generator) {
      sendStreamChunk(chunk);
    }
  } catch (error) {
    // Send error chunk if stream fails
    sendStreamChunk({
      requestId,
      chunk: '',
      done: true,
      error: (error as Error).message,
    });
  }
}
