/**
 * Main Process Entry Point
 * Initializes the Electron application and all core services
 */

import { app, BrowserWindow } from 'electron';
import * as path from 'path';
import { WindowManager } from './window-manager';
import { IpcMainHandler } from './ipc/ipc-main-handler';
import { InstanceManager } from './instance/instance-manager';
import { getHookManager } from './hooks/hook-manager';
import { registerDefaultMultiVerifyInvoker, registerDefaultReviewInvoker, registerDefaultDebateInvoker } from './orchestration/default-invokers';
import { getOrchestratorPluginManager } from './plugins/plugin-manager';
import { getObservationIngestor, getObserverAgent, getReflectorAgent } from './observation';
import { initializePathValidator } from './security/path-validator';
import { getLogger } from './logging/logger';

const logger = getLogger('App');

class AIOrchestratorApp {
  private windowManager: WindowManager;
  private ipcHandler: IpcMainHandler;
  private instanceManager: InstanceManager;
  private handlersRegistered = false;

  constructor() {
    this.windowManager = new WindowManager();
    this.instanceManager = new InstanceManager();
    this.ipcHandler = new IpcMainHandler(
      this.instanceManager,
      this.windowManager
    );
  }

  async initialize(): Promise<void> {
    logger.info('Initializing AI Orchestrator');

    // Only register once — handlers persist across window recreation
    if (!this.handlersRegistered) {
      const criticalSteps = new Set(['IPC handlers', 'Event forwarding']);

      const steps: Array<{ name: string; fn: () => Promise<void> | void }> = [
        { name: 'IPC handlers', fn: () => this.ipcHandler.registerHandlers() },
        { name: 'Hook approvals', fn: () => getHookManager().loadApprovals() },
        { name: 'Event forwarding', fn: () => this.setupInstanceEventForwarding() },
        { name: 'Verification invokers', fn: () => registerDefaultMultiVerifyInvoker(this.instanceManager) },
        { name: 'Review invokers', fn: () => registerDefaultReviewInvoker(this.instanceManager) },
        { name: 'Debate invokers', fn: () => registerDefaultDebateInvoker(this.instanceManager) },
        { name: 'Plugin manager', fn: () => getOrchestratorPluginManager().initialize(this.instanceManager) },
        { name: 'Observation ingestor', fn: () => getObservationIngestor().initialize(this.instanceManager) },
        { name: 'Observer agent', fn: () => { getObserverAgent(); } },
        { name: 'Reflector agent', fn: () => { getReflectorAgent(); } },
        { name: 'Path validator', fn: () => initializePathValidator() },
      ];

      for (const step of steps) {
        try {
          logger.info(`Initializing: ${step.name}`);
          await step.fn();
          logger.info(`Initialized: ${step.name}`);
        } catch (error) {
          logger.error(`Failed to initialize: ${step.name}`, error instanceof Error ? error : undefined);
          if (criticalSteps.has(step.name)) {
            throw error;
          }
        }
      }

      this.handlersRegistered = true;
    }

    // Create main window (this loads the renderer which may call IPC)
    await this.windowManager.createMainWindow();

    logger.info('AI Orchestrator initialized');
  }

  private setupInstanceEventForwarding(): void {
    // Forward instance events to renderer
    this.instanceManager.on('instance:created', (instance) => {
      this.windowManager.sendToRenderer('instance:created', instance);
    });

    this.instanceManager.on('instance:removed', (instanceId) => {
      this.windowManager.sendToRenderer('instance:removed', instanceId);
    });

    this.instanceManager.on('instance:state-update', (update) => {
      this.windowManager.sendToRenderer('instance:state-update', update);
    });

    this.instanceManager.on('instance:output', (output) => {
      this.windowManager.sendToRenderer('instance:output', output);
    });

    this.instanceManager.on('instance:batch-update', (updates) => {
      this.windowManager.sendToRenderer('instance:batch-update', updates);
    });

    // Forward input-required events (permission prompts) to renderer
    this.instanceManager.on('instance:input-required', (payload) => {
      this.windowManager.sendToRenderer('instance:input-required', payload);
    });

    // Forward user action requests from orchestrator to renderer
    const orchestration = this.instanceManager.getOrchestrationHandler();
    orchestration.on('user-action-request', (request) => {
      logger.info('Forwarding user action request to renderer', { requestId: request.id });
      this.windowManager.sendToRenderer('user-action:request', request);

      // Notify the user for all request types so questions don't get lost
      let title: string;
      switch (request.requestType) {
        case 'switch_mode': {
          const modeLabel = request.targetMode
            ? `${request.targetMode.charAt(0).toUpperCase()}${request.targetMode.slice(1)}`
            : 'requested';
          title = `Approval Needed: Switch to ${modeLabel} Mode`;
          break;
        }
        case 'ask_questions':
          title = 'Questions from AI Instance';
          break;
        case 'approve_action':
          title = 'Approval Needed';
          break;
        default:
          title = 'Input Needed';
          break;
      }
      this.windowManager.notifyUserActionRequest(
        title,
        request.message || 'An AI instance is waiting for your response.'
      );
    });
  }

  cleanup(): void {
    logger.info('Cleaning up');
    this.instanceManager.terminateAll();
  }
}

// Application instance
let orchestratorApp: AIOrchestratorApp | null = null;

// App ready handler
app.whenReady().then(async () => {
  // Set dock icon on macOS (only in development mode - packaged app uses icon from Info.plist)
  if (process.platform === 'darwin' && app.dock && !app.isPackaged) {
    try {
      const iconPath = path.join(__dirname, '../../build/icon.png');
      app.dock.setIcon(iconPath);
    } catch {
      // Icon not found, ignore - packaged app uses Info.plist icon
    }
  }

  orchestratorApp = new AIOrchestratorApp();
  await orchestratorApp.initialize();

  // macOS: Re-create window when dock icon is clicked
  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await orchestratorApp?.initialize();
    }
  });
});

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up before quit
app.on('before-quit', () => {
  orchestratorApp?.cleanup();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error instanceof Error ? error : undefined);
});

process.on('unhandledRejection', (reason, _promise) => {
  logger.error('Unhandled rejection', reason instanceof Error ? reason : undefined, { reason: String(reason) });
});
