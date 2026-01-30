/**
 * Permission IPC Server
 *
 * Handles IPC communication between the Permission MCP Server and the main orchestrator.
 * Each instance gets its own IPC server on a dynamically allocated port.
 */

import { EventEmitter } from 'events';
import * as net from 'net';
import { generateId } from '../../shared/utils/id-generator';

export interface PermissionRequestPayload {
  type: 'permission_request';
  requestId: string;
  instanceId: string;
  toolName: string;
  input: Record<string, unknown>;
  timestamp: number;
}

export interface PermissionResponsePayload {
  type: 'permission_response';
  requestId: string;
  response: {
    behavior: 'allow' | 'deny';
    updatedInput?: Record<string, unknown>;
    message?: string;
  };
}

export interface PermissionIpcServerEvents {
  'permission:requested': (request: PermissionRequestPayload & { respond: (response: PermissionResponsePayload['response']) => void }) => void;
  'error': (error: Error) => void;
  'client:connected': () => void;
  'client:disconnected': () => void;
}

export class PermissionIpcServer extends EventEmitter {
  private server: net.Server | null = null;
  private client: net.Socket | null = null;
  private port: number = 0;
  private instanceId: string;
  private buffer: string = '';

  constructor(instanceId: string) {
    super();
    this.instanceId = instanceId;
  }

  /**
   * Start the IPC server and return the port it's listening on
   */
  async start(): Promise<number> {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        console.log(`[PermissionIPC] Client connected for instance ${this.instanceId}`);
        this.client = socket;
        this.emit('client:connected');

        socket.on('data', (data) => {
          this.handleData(data);
        });

        socket.on('close', () => {
          console.log(`[PermissionIPC] Client disconnected for instance ${this.instanceId}`);
          this.client = null;
          this.emit('client:disconnected');
        });

        socket.on('error', (error) => {
          console.error(`[PermissionIPC] Socket error for instance ${this.instanceId}:`, error);
          this.emit('error', error);
        });
      });

      this.server.on('error', (error) => {
        console.error(`[PermissionIPC] Server error for instance ${this.instanceId}:`, error);
        reject(error);
      });

      // Listen on port 0 to get a dynamically allocated port
      this.server.listen(0, '127.0.0.1', () => {
        const address = this.server?.address();
        if (address && typeof address === 'object') {
          this.port = address.port;
          console.log(`[PermissionIPC] Server listening on port ${this.port} for instance ${this.instanceId}`);
          resolve(this.port);
        } else {
          reject(new Error('Failed to get server address'));
        }
      });
    });
  }

  /**
   * Handle incoming data from the client
   */
  private handleData(data: Buffer): void {
    this.buffer += data.toString();

    // Process complete messages (newline-delimited)
    let newlineIndex: number;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);

      if (!line.trim()) continue;

      try {
        const message = JSON.parse(line);
        this.handleMessage(message);
      } catch (error) {
        console.error('[PermissionIPC] Error parsing message:', error);
      }
    }
  }

  /**
   * Handle a parsed message
   */
  private handleMessage(message: unknown): void {
    const payload = message as PermissionRequestPayload;

    if (payload.type === 'permission_request') {
      console.log(`[PermissionIPC] Permission request for ${payload.toolName} from instance ${payload.instanceId}`);

      // Create a respond function that sends the response back to the client
      const respond = (response: PermissionResponsePayload['response']) => {
        this.sendResponse(payload.requestId, response);
      };

      this.emit('permission:requested', {
        ...payload,
        respond
      });
    }
  }

  /**
   * Send a response back to the client
   */
  sendResponse(requestId: string, response: PermissionResponsePayload['response']): boolean {
    if (!this.client?.writable) {
      console.error('[PermissionIPC] Cannot send response - no client connected');
      return false;
    }

    const payload: PermissionResponsePayload = {
      type: 'permission_response',
      requestId,
      response
    };

    this.client.write(JSON.stringify(payload) + '\n');
    console.log(`[PermissionIPC] Sent permission response for request ${requestId}: ${response.behavior}`);
    return true;
  }

  /**
   * Get the port the server is listening on
   */
  getPort(): number {
    return this.port;
  }

  /**
   * Check if a client is connected
   */
  isClientConnected(): boolean {
    return this.client !== null && this.client.writable;
  }

  /**
   * Stop the IPC server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.client) {
        this.client.destroy();
        this.client = null;
      }

      if (this.server) {
        this.server.close(() => {
          console.log(`[PermissionIPC] Server stopped for instance ${this.instanceId}`);
          this.server = null;
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

// Factory function
export function createPermissionIpcServer(instanceId: string): PermissionIpcServer {
  return new PermissionIpcServer(instanceId);
}
