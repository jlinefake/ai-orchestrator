/**
 * Instance Lifecycle Manager - Create, terminate, restart, and mode management
 */

import { EventEmitter } from 'events';
import { app } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ClaudeCliAdapter } from '../cli/claude-cli-adapter';
import {
  createCliAdapter,
  resolveCliType,
  getCliDisplayName,
  type UnifiedSpawnOptions,
  type CliAdapter
} from '../cli/adapters/adapter-factory';
import type { CliType } from '../cli/cli-detection';
import { getSettingsManager } from '../core/config/settings-manager';
import { getHistoryManager } from '../history';
import { getMemoryMonitor, getOutputStorageManager } from '../memory';
import { getSupervisorTree } from '../process';
import { getAgentById, getDefaultAgent } from '../../shared/types/agent.types';
import { getDisallowedTools } from '../../shared/utils/permission-mapper';
import { generateId } from '../../shared/utils/id-generator';
import { LIMITS } from '../../shared/constants/limits';
import {
  createDefaultContextInheritance,
  type ContextInheritanceConfig,
  type TerminationPolicy,
} from '../../shared/types/supervision.types';
import type {
  Instance,
  InstanceCreateConfig,
  InstanceStatus,
  ContextUsage,
  OutputMessage
} from '../../shared/types/instance.types';

/**
 * Dependencies required by the lifecycle manager
 */
export interface LifecycleDependencies {
  getInstance: (id: string) => Instance | undefined;
  setInstance: (instance: Instance) => void;
  deleteInstance: (id: string) => boolean;
  getAdapter: (id: string) => CliAdapter | undefined;
  setAdapter: (id: string, adapter: CliAdapter) => void;
  deleteAdapter: (id: string) => boolean;
  getInstanceCount: () => number;
  forEachInstance: (callback: (instance: Instance, id: string) => void) => void;
  queueUpdate: (instanceId: string, status: InstanceStatus, contextUsage?: ContextUsage) => void;
  serializeForIpc: (instance: Instance) => Record<string, unknown>;
  setupAdapterEvents: (instanceId: string, adapter: CliAdapter) => void;
  initializeRlm: (instance: Instance) => Promise<void>;
  endRlmSession: (instanceId: string) => void;
  ingestInitialOutputToRlm: (instance: Instance, messages: OutputMessage[]) => Promise<void>;
  registerOrchestration: (instanceId: string, workingDirectory: string, parentId: string | null) => void;
  unregisterOrchestration: (instanceId: string) => void;
  markInterrupted: (instanceId: string) => void;
  clearInterrupted: (instanceId: string) => void;
  addToOutputBuffer: (instance: Instance, message: OutputMessage) => void;
  clearFirstMessageTracking: (instanceId: string) => void;
  markFirstMessageReceived: (instanceId: string) => void;
}

export class InstanceLifecycleManager extends EventEmitter {
  private settings = getSettingsManager();
  private memoryMonitor = getMemoryMonitor();
  private outputStorage = getOutputStorageManager();
  private idleCheckTimer: NodeJS.Timeout | null = null;
  private deps: LifecycleDependencies;

  constructor(deps: LifecycleDependencies) {
    super();
    this.deps = deps;
    this.startIdleCheckTimer();
    this.setupMemoryMonitoring();
  }

  // ============================================
  // CLAUDE.md Prompt Loading
  // ============================================

  /**
   * Parse frontmatter from CLAUDE.md file
   */
  private parseClaudeMdFrontmatter(content: string): Record<string, string> {
    const metadata: Record<string, string> = {};

    // Parse YAML frontmatter
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (frontmatterMatch) {
      const frontmatter = frontmatterMatch[1];

      // Simple YAML parsing
      const lines = frontmatter.split('\n');
      for (const line of lines) {
        const [key, ...valueParts] = line.split(':');
        const value = valueParts.join(':').trim();

        if (key && value) {
          metadata[key.trim()] = value;
        }
      }
    }

    return metadata;
  }

  /**
   * Load CLAUDE.md prompt hierarchy
   * Returns array of prompt contents (global first, then project)
   */
  private async loadPromptHierarchy(workDir: string): Promise<string[]> {
    const prompts: string[] = [];

    // Load global CLAUDE.md from ~/.claude/CLAUDE.md
    try {
      const homeDir = app.getPath('home');
      const globalClaudeMdPath = path.join(homeDir, '.claude', 'CLAUDE.md');
      const globalContent = await fs.readFile(globalClaudeMdPath, 'utf-8');

      // Remove frontmatter for inclusion in system prompt
      const contentWithoutFrontmatter = globalContent.replace(/^---\n[\s\S]*?\n---\n/, '');
      if (contentWithoutFrontmatter.trim()) {
        prompts.push(contentWithoutFrontmatter.trim());
      }

      console.log(`[CLAUDE.md] Loaded global prompt from ${globalClaudeMdPath}`);
    } catch (error) {
      // Global CLAUDE.md is optional
      console.log('[CLAUDE.md] No global CLAUDE.md found (this is optional)');
    }

    // Load project CLAUDE.md from {workDir}/.claude/CLAUDE.md
    try {
      const projectClaudeMdPath = path.join(workDir, '.claude', 'CLAUDE.md');
      const projectContent = await fs.readFile(projectClaudeMdPath, 'utf-8');

      // Remove frontmatter for inclusion in system prompt
      const contentWithoutFrontmatter = projectContent.replace(/^---\n[\s\S]*?\n---\n/, '');
      if (contentWithoutFrontmatter.trim()) {
        prompts.push(contentWithoutFrontmatter.trim());
      }

      console.log(`[CLAUDE.md] Loaded project prompt from ${projectClaudeMdPath}`);
    } catch (error) {
      // Project CLAUDE.md is optional
      console.log('[CLAUDE.md] No project CLAUDE.md found (this is optional)');
    }

    return prompts;
  }

  // ============================================
  // Instance Creation
  // ============================================

  /**
   * Create a new instance
   */
  async createInstance(config: InstanceCreateConfig): Promise<Instance> {
    console.log('InstanceLifecycleManager: Creating instance with config:', config);

    // Resolve agent profile
    const agent = config.agentId
      ? getAgentById(config.agentId)
      : getDefaultAgent();
    const resolvedAgent = agent || getDefaultAgent();

    // Resolve context inheritance (merge with defaults)
    const defaultInheritance = createDefaultContextInheritance();
    const contextInheritance: ContextInheritanceConfig = {
      ...defaultInheritance,
      ...config.contextInheritance,
    };

    // Calculate depth based on parent
    let depth = 0;
    let resolvedWorkingDir = config.workingDirectory;
    let resolvedYoloMode = config.yoloMode ?? false;
    let resolvedAgentId = resolvedAgent.id;

    if (config.parentId) {
      const parent = this.deps.getInstance(config.parentId);
      if (parent) {
        depth = parent.depth + 1;

        // Apply context inheritance from parent
        if (contextInheritance.inheritWorkingDirectory && !config.workingDirectory) {
          resolvedWorkingDir = parent.workingDirectory;
        }
        if (contextInheritance.inheritYoloMode && config.yoloMode === undefined) {
          resolvedYoloMode = parent.yoloMode;
        }
        if (contextInheritance.inheritAgentSettings && !config.agentId) {
          resolvedAgentId = parent.agentId;
        }
      }
    }

    // Resolve termination policy
    const terminationPolicy: TerminationPolicy = config.terminationPolicy || 'terminate-children';

    // Create instance object
    const instance: Instance = {
      id: generateId(),
      displayName: config.displayName || `Instance ${Date.now()}`,
      createdAt: Date.now(),

      parentId: config.parentId || null,
      childrenIds: [],
      supervisorNodeId: '',
      workerNodeId: undefined,
      depth,

      // Phase 2: Termination & Inheritance
      terminationPolicy,
      contextInheritance,

      agentId: resolvedAgentId,
      agentMode: resolvedAgent.mode,

      planMode: {
        enabled: false,
        state: 'off'
      },

      status: 'initializing',
      contextUsage: {
        used: 0,
        total: LIMITS.DEFAULT_MAX_CONTEXT_TOKENS,
        percentage: 0
      },
      lastActivity: Date.now(),

      processId: null,
      sessionId: config.sessionId || generateId(),
      workingDirectory: resolvedWorkingDir,
      yoloMode: resolvedYoloMode,
      provider: config.provider || 'auto',

      outputBuffer: config.initialOutputBuffer || [],
      outputBufferMaxSize: LIMITS.OUTPUT_BUFFER_MAX_SIZE,

      communicationTokens: new Map(),
      subscribedTo: [],

      totalTokensUsed: 0,
      requestCount: 0,
      errorCount: 0,
      restartCount: 0
    };

    if (instance.yoloMode) {
      console.warn('[Security] YOLO mode enabled for instance', {
        instanceId: instance.id,
        parentId: instance.parentId,
        provider: instance.provider
      });
    }

    // Store instance
    this.deps.setInstance(instance);

    // If has parent, update parent's children list
    if (instance.parentId) {
      const parent = this.deps.getInstance(instance.parentId);
      if (parent) {
        parent.childrenIds.push(instance.id);
      }
    }

    // Register with supervisor tree
    const supervisorTree = getSupervisorTree();
    const { supervisorNodeId, workerNodeId } = supervisorTree.registerInstance(
      instance.id,
      instance.parentId,
      instance.workingDirectory,
      instance.displayName,
      instance.terminationPolicy,
      instance.contextInheritance
    );
    instance.supervisorNodeId = supervisorNodeId;
    instance.workerNodeId = workerNodeId;

    // Initialize RLM
    await this.deps.initializeRlm(instance);

    // Ingest initial output buffer to RLM
    if (config.initialOutputBuffer && config.initialOutputBuffer.length > 0) {
      this.deps.ingestInitialOutputToRlm(instance, config.initialOutputBuffer);
    }

    // Get disallowed tools based on agent permissions
    const disallowedTools = getDisallowedTools(resolvedAgent.permissions);

    // Load CLAUDE.md prompt hierarchy
    const claudeMdPrompts = await this.loadPromptHierarchy(instance.workingDirectory);

    // Build system prompt with CLAUDE.md content prepended
    let systemPrompt = resolvedAgent.systemPrompt || '';
    if (claudeMdPrompts.length > 0) {
      const claudeMdSection = claudeMdPrompts.join('\n\n---\n\n');
      systemPrompt = `${claudeMdSection}\n\n---\n\n${systemPrompt}`;
      console.log(`[CLAUDE.md] Prepended ${claudeMdPrompts.length} prompt(s) to system prompt`);
    }

    // Resolve CLI provider type
    const settingsAll = this.settings.getAll();
    console.log(
      `[InstanceLifecycleManager] Requested provider: ${config.provider}, default: ${settingsAll.defaultCli}`
    );
    const resolvedCliType = await resolveCliType(
      config.provider,
      settingsAll.defaultCli
    );
    instance.provider = resolvedCliType as any;
    console.log(
      `[InstanceLifecycleManager] Resolved CLI provider: ${resolvedCliType} (${getCliDisplayName(resolvedCliType)})`
    );

    // Default allowed tools for non-YOLO mode
    const defaultAllowedTools = instance.yoloMode ? undefined : [
      'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
      'Task', 'TaskOutput', 'TodoWrite', 'WebFetch', 'WebSearch',
      'NotebookEdit', 'AskUserQuestion', 'Skill', 'EnterPlanMode', 'ExitPlanMode'
    ];

    if (!instance.yoloMode && defaultAllowedTools) {
      console.log('[InstanceLifecycleManager] Non-YOLO mode: Pre-allowing tools:', defaultAllowedTools.join(', '));
    }

    // Create CLI adapter
    const modelOverride = config.modelOverride || resolvedAgent.modelOverride;
    const spawnOptions: UnifiedSpawnOptions = {
      sessionId: instance.sessionId,
      workingDirectory: config.workingDirectory,
      systemPrompt: systemPrompt,
      model: modelOverride,
      yoloMode: instance.yoloMode,
      allowedTools: defaultAllowedTools,
      disallowedTools: disallowedTools.length > 0 ? disallowedTools : undefined
    };

    const adapter = createCliAdapter(resolvedCliType, spawnOptions);

    // Set up adapter events
    this.deps.setupAdapterEvents(instance.id, adapter);

    // Store adapter
    this.deps.setAdapter(instance.id, adapter);

    // Spawn the CLI process
    try {
      console.log('InstanceLifecycleManager: Spawning CLI process for provider:', resolvedCliType);
      const pid = await adapter.spawn();
      instance.processId = pid;
      instance.status = 'idle';
      console.log('InstanceLifecycleManager: CLI spawned with PID:', pid);

      // Send initial prompt if provided
      if (config.initialPrompt) {
        const userMessage = {
          id: generateId(),
          timestamp: Date.now(),
          type: 'user' as const,
          content: config.initialPrompt,
          attachments: config.attachments?.map((a) => ({
            name: a.name,
            type: a.type,
            size: a.size,
            data: a.data
          }))
        };
        this.deps.addToOutputBuffer(instance, userMessage);
        await adapter.sendInput(config.initialPrompt, config.attachments);
      }
    } catch (error) {
      instance.status = 'error';
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('InstanceLifecycleManager: Failed to spawn/initialize CLI:', errorMessage);

      const errorOutput = {
        id: generateId(),
        timestamp: Date.now(),
        type: 'error' as const,
        content: `Failed to initialize ${getCliDisplayName(resolvedCliType)}: ${errorMessage}`
      };
      this.deps.addToOutputBuffer(instance, errorOutput);
    }

    // Register with orchestration handler
    this.deps.registerOrchestration(
      instance.id,
      instance.workingDirectory,
      instance.parentId
    );

    // Emit creation event
    console.log('InstanceLifecycleManager: Emitting instance:created event');
    this.emit('created', this.deps.serializeForIpc(instance));

    return instance;
  }

  // ============================================
  // Instance Termination
  // ============================================

  /**
   * Terminate an instance
   */
  async terminateInstance(
    instanceId: string,
    graceful: boolean = true
  ): Promise<void> {
    const adapter = this.deps.getAdapter(instanceId);
    const instance = this.deps.getInstance(instanceId);

    if (adapter) {
      await adapter.terminate(graceful);
      this.deps.deleteAdapter(instanceId);
    }

    if (instance) {
      // Archive to history before cleanup (only for root instances with messages)
      if (!instance.parentId && instance.outputBuffer.length > 0) {
        try {
          const history = getHistoryManager();
          const status = instance.status === 'error' ? 'error' : 'completed';
          await history.archiveInstance(instance, status);
        } catch (error) {
          console.error(
            `Failed to archive instance ${instanceId} to history:`,
            error
          );
        }
      }

      instance.status = 'terminated';
      instance.processId = null;

      // Remove from parent's children list
      if (instance.parentId) {
        const parent = this.deps.getInstance(instance.parentId);
        if (parent) {
          parent.childrenIds = parent.childrenIds.filter(
            (id) => id !== instanceId
          );
        }
      }

      // Handle children based on termination policy
      const childrenToTerminate: string[] = [];
      const childrenToOrphan: string[] = [];

      switch (instance.terminationPolicy) {
        case 'terminate-children':
          // Terminate all children (default behavior)
          childrenToTerminate.push(...instance.childrenIds);
          break;

        case 'orphan-children':
          // Leave children running without parent
          childrenToOrphan.push(...instance.childrenIds);
          for (const childId of childrenToOrphan) {
            const child = this.deps.getInstance(childId);
            if (child) {
              child.parentId = null;
              console.log(`[Supervision] Orphaned child instance ${childId}`);
            }
          }
          break;

        case 'reparent-to-root':
          // Reparent children to root (no parent)
          for (const childId of instance.childrenIds) {
            const child = this.deps.getInstance(childId);
            if (child) {
              child.parentId = null;
              child.depth = 0;
              console.log(`[Supervision] Reparented child instance ${childId} to root`);
            }
          }
          break;
      }

      // Terminate children that need to be terminated
      for (const childId of childrenToTerminate) {
        await this.terminateInstance(childId, graceful);
      }

      // Clear the children list
      instance.childrenIds = [];

      // Unregister from supervisor tree
      const supervisorTree = getSupervisorTree();
      supervisorTree.unregisterInstance(instanceId);

      // Unregister from orchestration
      this.deps.unregisterOrchestration(instanceId);
      this.deps.clearFirstMessageTracking(instanceId);

      // End RLM session
      this.deps.endRlmSession(instanceId);

      // Clean up disk storage
      this.outputStorage.deleteInstance(instanceId).catch((err) => {
        console.error(`Failed to clean up storage for ${instanceId}:`, err);
      });

      this.emit('removed', instanceId);
      this.deps.deleteInstance(instanceId);
    }
  }

  /**
   * Terminate all instances
   */
  async terminateAll(): Promise<void> {
    const instanceIds: string[] = [];
    this.deps.forEachInstance((_, id) => instanceIds.push(id));

    const promises = instanceIds.map((id) =>
      this.terminateInstance(id, false)
    );
    await Promise.all(promises);
  }

  // ============================================
  // Instance Restart
  // ============================================

  /**
   * Restart an instance
   */
  async restartInstance(instanceId: string): Promise<void> {
    const instance = this.deps.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    // Terminate existing adapter
    const oldAdapter = this.deps.getAdapter(instanceId);
    if (oldAdapter) {
      await oldAdapter.terminate(true);
    }

    // Generate new session ID
    const newSessionId = generateId();
    instance.sessionId = newSessionId;
    instance.outputBuffer = [];
    instance.contextUsage = {
      used: 0,
      total: LIMITS.DEFAULT_MAX_CONTEXT_TOKENS,
      percentage: 0
    };
    instance.totalTokensUsed = 0;

    // Reset first message tracking
    this.deps.clearFirstMessageTracking(instanceId);

    // Create new adapter
    const cliType =
      instance.provider === 'auto' || instance.provider === 'openai'
        ? instance.provider === 'openai'
          ? 'codex'
          : 'claude'
        : (instance.provider as CliType);

    const spawnOptions: UnifiedSpawnOptions = {
      sessionId: newSessionId,
      workingDirectory: instance.workingDirectory,
      yoloMode: instance.yoloMode
    };

    const adapter = createCliAdapter(cliType, spawnOptions);

    this.deps.setupAdapterEvents(instanceId, adapter);
    this.deps.setAdapter(instanceId, adapter);

    // Spawn new process
    instance.status = 'initializing';
    instance.restartCount++;

    try {
      const pid = await adapter.spawn();
      instance.processId = pid;
      instance.status = 'idle';
    } catch (error) {
      instance.status = 'error';
      console.error('Failed to restart CLI:', error);
    }

    this.deps.queueUpdate(instanceId, instance.status, instance.contextUsage);
  }

  // ============================================
  // Agent Mode Change
  // ============================================

  /**
   * Change the agent mode for an instance while preserving conversation context
   */
  async changeAgentMode(instanceId: string, newAgentId: string): Promise<Instance> {
    const instance = this.deps.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    if (instance.status === 'busy') {
      throw new Error('Cannot change agent mode while instance is busy. Please wait for the current operation to complete.');
    }

    if (instance.agentId === newAgentId) {
      return instance;
    }

    const newAgent = getAgentById(newAgentId);
    if (!newAgent) {
      throw new Error(`Agent ${newAgentId} not found`);
    }

    const oldAgentId = instance.agentId;
    console.log(`[InstanceLifecycleManager] Changing agent mode for ${instanceId}: ${oldAgentId} -> ${newAgentId}`);

    // Terminate existing adapter
    const oldAdapter = this.deps.getAdapter(instanceId);
    if (oldAdapter) {
      await oldAdapter.terminate(true);
      this.deps.deleteAdapter(instanceId);
    }

    // Update instance with new agent
    instance.agentId = newAgentId;
    instance.agentMode = newAgent.mode;
    instance.status = 'initializing';

    const disallowedTools = getDisallowedTools(newAgent.permissions);
    const defaultAllowedTools = instance.yoloMode ? undefined : [
      'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
      'Task', 'TaskOutput', 'TodoWrite', 'WebFetch', 'WebSearch',
      'NotebookEdit', 'AskUserQuestion', 'Skill', 'EnterPlanMode', 'ExitPlanMode'
    ];

    const cliType =
      instance.provider === 'auto' || instance.provider === 'openai'
        ? instance.provider === 'openai'
          ? 'codex'
          : 'claude'
        : (instance.provider as CliType);

    const spawnOptions: UnifiedSpawnOptions = {
      sessionId: instance.sessionId,
      workingDirectory: instance.workingDirectory,
      systemPrompt: newAgent.systemPrompt,
      yoloMode: instance.yoloMode,
      allowedTools: defaultAllowedTools,
      disallowedTools: disallowedTools.length > 0 ? disallowedTools : undefined,
      resume: true
    };

    const adapter = createCliAdapter(cliType, spawnOptions);

    this.deps.setupAdapterEvents(instanceId, adapter);
    this.deps.setAdapter(instanceId, adapter);

    try {
      const pid = await adapter.spawn();
      instance.processId = pid;
      instance.status = 'idle';
      console.log(`[InstanceLifecycleManager] Agent mode changed successfully, PID: ${pid}`);

      const modeChangeMessage = `[System: Agent mode changed to ${newAgent.name}. ${newAgent.description || ''}]`;
      await adapter.sendInput(modeChangeMessage);
    } catch (error) {
      instance.status = 'error';
      console.error('[InstanceLifecycleManager] Failed to change agent mode:', error);
      throw error;
    }

    this.deps.queueUpdate(instanceId, instance.status, instance.contextUsage);
    this.emit('agent-changed', {
      instanceId,
      oldAgentId,
      newAgentId,
      agentName: newAgent.name
    });

    return instance;
  }

  // ============================================
  // YOLO Mode Toggle
  // ============================================

  /**
   * Toggle YOLO mode for an instance while preserving conversation context
   */
  async toggleYoloMode(instanceId: string): Promise<Instance> {
    const instance = this.deps.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    if (instance.status === 'busy') {
      throw new Error('Cannot toggle YOLO mode while instance is busy. Please wait for the current operation to complete.');
    }

    const newYoloMode = !instance.yoloMode;
    console.log(`[InstanceLifecycleManager] Toggling YOLO mode for ${instanceId}: ${instance.yoloMode} -> ${newYoloMode}`);
    console.log(`[InstanceLifecycleManager] Current adapter exists: ${!!this.deps.getAdapter(instanceId)}`);

    // Check if there's actually a conversation to resume
    // If outputBuffer is empty (or only contains system messages), start fresh instead of resuming
    const hasConversation = instance.outputBuffer.some(
      (msg) => msg.type === 'user' || msg.type === 'assistant'
    );
    console.log(`[InstanceLifecycleManager] Has conversation to resume: ${hasConversation}, outputBuffer length: ${instance.outputBuffer.length}`);

    // Terminate existing adapter
    const oldAdapter = this.deps.getAdapter(instanceId);
    if (oldAdapter) {
      console.log(`[InstanceLifecycleManager] Terminating old adapter for ${instanceId}`);
      // Delete from map FIRST to prevent race condition with exit handler
      this.deps.deleteAdapter(instanceId);
      console.log(`[InstanceLifecycleManager] Old adapter deleted from map, now terminating`);
      await oldAdapter.terminate(true);
      console.log(`[InstanceLifecycleManager] Old adapter terminated`);
    }

    instance.yoloMode = newYoloMode;
    instance.status = 'initializing';

    if (newYoloMode) {
      console.warn('[Security] YOLO mode enabled for instance', {
        instanceId: instance.id,
        parentId: instance.parentId,
        provider: instance.provider
      });
    }

    const agent = getAgentById(instance.agentId) || getDefaultAgent();
    const disallowedTools = getDisallowedTools(agent.permissions);
    const allowedTools = newYoloMode ? undefined : [
      'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
      'Task', 'TaskOutput', 'TodoWrite', 'WebFetch', 'WebSearch',
      'NotebookEdit', 'AskUserQuestion', 'Skill', 'EnterPlanMode', 'ExitPlanMode'
    ];

    const cliType =
      instance.provider === 'auto' || instance.provider === 'openai'
        ? instance.provider === 'openai'
          ? 'codex'
          : 'claude'
        : (instance.provider as CliType);

    const spawnOptions: UnifiedSpawnOptions = {
      sessionId: instance.sessionId,
      workingDirectory: instance.workingDirectory,
      systemPrompt: agent.systemPrompt,
      yoloMode: newYoloMode,
      allowedTools,
      disallowedTools: disallowedTools.length > 0 ? disallowedTools : undefined,
      // Only resume if there's actually a conversation to continue
      resume: hasConversation
    };
    console.log(`[InstanceLifecycleManager] Spawn options: resume=${spawnOptions.resume}, sessionId=${spawnOptions.sessionId}`);

    const adapter = createCliAdapter(cliType, spawnOptions);

    console.log(`[InstanceLifecycleManager] Setting up adapter events for ${instanceId}`);
    this.deps.setupAdapterEvents(instanceId, adapter);
    console.log(`[InstanceLifecycleManager] Storing new adapter for ${instanceId}`);
    this.deps.setAdapter(instanceId, adapter);
    console.log(`[InstanceLifecycleManager] New adapter stored, adapter exists: ${!!this.deps.getAdapter(instanceId)}`);

    try {
      console.log(`[InstanceLifecycleManager] Spawning new adapter for ${instanceId}`);
      const pid = await adapter.spawn();
      instance.processId = pid;
      instance.status = 'idle';
      console.log(`[InstanceLifecycleManager] YOLO mode toggled successfully, PID: ${pid}`);
      console.log(`[InstanceLifecycleManager] Adapter still exists after spawn: ${!!this.deps.getAdapter(instanceId)}`);

      const modeMessage = newYoloMode
        ? '[System: YOLO mode enabled - all tool permissions are now auto-approved.]'
        : '[System: YOLO mode disabled - tool permissions will now require approval.]';
      console.log(`[InstanceLifecycleManager] Sending mode message to adapter`);
      await adapter.sendInput(modeMessage);
      console.log(`[InstanceLifecycleManager] Mode message sent, adapter exists: ${!!this.deps.getAdapter(instanceId)}`);
    } catch (error) {
      instance.status = 'error';
      console.error('[InstanceLifecycleManager] Failed to toggle YOLO mode:', error);
      throw error;
    }

    this.deps.queueUpdate(instanceId, instance.status, instance.contextUsage);
    this.emit('yolo-toggled', {
      instanceId,
      yoloMode: newYoloMode
    });

    console.log(`[InstanceLifecycleManager] toggleYoloMode complete, final adapter check: ${!!this.deps.getAdapter(instanceId)}`);
    return instance;
  }

  // ============================================
  // Instance Interrupt
  // ============================================

  /**
   * Interrupt an instance (like Ctrl+C)
   */
  interruptInstance(instanceId: string): boolean {
    const adapter = this.deps.getAdapter(instanceId);
    const instance = this.deps.getInstance(instanceId);

    if (!adapter || !instance) {
      console.warn(`Cannot interrupt instance ${instanceId}: not found`);
      return false;
    }

    if (instance.status !== 'busy') {
      console.warn(
        `Cannot interrupt instance ${instanceId}: not busy (status: ${instance.status})`
      );
      return false;
    }

    this.deps.markInterrupted(instanceId);

    const success = adapter.interrupt();
    if (success) {
      const message = {
        id: generateId(),
        type: 'system' as const,
        content: 'Interrupted by user - resuming session...',
        timestamp: Date.now()
      };
      this.deps.addToOutputBuffer(instance, message);
      this.emit('output', { instanceId, message });

      instance.status = 'initializing';
      instance.lastActivity = Date.now();
      this.deps.queueUpdate(instanceId, 'initializing', instance.contextUsage);
    } else {
      this.deps.clearInterrupted(instanceId);
    }

    return success;
  }

  /**
   * Respawn an instance after interrupt to continue the session
   */
  async respawnAfterInterrupt(instanceId: string): Promise<void> {
    console.log(`respawnAfterInterrupt: Starting for instance ${instanceId}`);

    const instance = this.deps.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    const sessionId = instance.sessionId;
    console.log(`respawnAfterInterrupt: Session ID = ${sessionId}`);

    if (!sessionId) {
      throw new Error(`Instance ${instanceId} has no session ID to resume`);
    }

    const newSessionId = generateId();
    instance.sessionId = newSessionId;

    const cliType =
      instance.provider === 'auto' || instance.provider === 'openai'
        ? instance.provider === 'openai'
          ? 'codex'
          : 'claude'
        : (instance.provider as CliType);

    let adapter: CliAdapter;
    if (cliType === 'claude') {
      adapter = new ClaudeCliAdapter({
        workingDirectory: instance.workingDirectory,
        sessionId: sessionId,
        yoloMode: instance.yoloMode,
        resume: true,
        forkSession: true
      });
    } else {
      const spawnOptions: UnifiedSpawnOptions = {
        sessionId: newSessionId,
        workingDirectory: instance.workingDirectory,
        yoloMode: instance.yoloMode
      };
      adapter = createCliAdapter(cliType, spawnOptions);
    }
    this.deps.setupAdapterEvents(instanceId, adapter);
    this.deps.setAdapter(instanceId, adapter);

    try {
      console.log(`respawnAfterInterrupt: Spawning new process...`);
      const pid = await adapter.spawn();
      console.log(`respawnAfterInterrupt: Process spawned with PID ${pid}`);

      instance.processId = pid;
      instance.status = 'idle';
      instance.lastActivity = Date.now();

      const message = {
        id: generateId(),
        type: 'system' as const,
        content: 'Session resumed - ready for input',
        timestamp: Date.now()
      };
      this.deps.addToOutputBuffer(instance, message);
      this.emit('output', { instanceId, message });

      this.deps.queueUpdate(instanceId, 'idle', instance.contextUsage);
      console.log(`respawnAfterInterrupt: Complete, instance is now idle`);
    } catch (error) {
      console.error(`respawnAfterInterrupt: Failed to spawn`, error);
      instance.status = 'error';
      instance.processId = null;
      this.deps.queueUpdate(instanceId, 'error');
      throw error;
    }
  }

  // ============================================
  // Plan Mode Management
  // ============================================

  /**
   * Enter plan mode for an instance
   */
  enterPlanMode(instanceId: string): Instance {
    const instance = this.deps.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    instance.planMode = {
      enabled: true,
      state: 'planning',
      planContent: undefined,
      approvedAt: undefined
    };

    this.emit('state-update', {
      instanceId,
      status: instance.status,
      planMode: instance.planMode
    });

    console.log(`Entered plan mode for instance ${instanceId}`);
    return instance;
  }

  /**
   * Exit plan mode
   */
  exitPlanMode(instanceId: string, force = false): Instance {
    const instance = this.deps.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    if (!instance.planMode.enabled) {
      throw new Error('Instance is not in plan mode');
    }

    if (!force && instance.planMode.state !== 'approved') {
      throw new Error('Plan must be approved before exiting plan mode');
    }

    instance.planMode = {
      enabled: false,
      state: 'off',
      planContent: undefined,
      approvedAt: undefined
    };

    this.emit('state-update', {
      instanceId,
      status: instance.status,
      planMode: instance.planMode
    });

    console.log(`Exited plan mode for instance ${instanceId}`);
    return instance;
  }

  /**
   * Approve a plan in plan mode
   */
  approvePlan(instanceId: string, planContent?: string): Instance {
    const instance = this.deps.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    if (!instance.planMode.enabled) {
      throw new Error('Instance is not in plan mode');
    }

    instance.planMode = {
      enabled: true,
      state: 'approved',
      planContent: planContent || instance.planMode.planContent,
      approvedAt: Date.now()
    };

    this.emit('state-update', {
      instanceId,
      status: instance.status,
      planMode: instance.planMode
    });

    console.log(`Approved plan for instance ${instanceId}`);
    return instance;
  }

  /**
   * Update plan content while in planning mode
   */
  updatePlanContent(instanceId: string, planContent: string): Instance {
    const instance = this.deps.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    if (!instance.planMode.enabled) {
      throw new Error('Instance is not in plan mode');
    }

    instance.planMode.planContent = planContent;

    this.emit('state-update', {
      instanceId,
      status: instance.status,
      planMode: instance.planMode
    });

    return instance;
  }

  /**
   * Get plan mode state for an instance
   */
  getPlanModeState(instanceId: string): {
    enabled: boolean;
    state: string;
    planContent?: string;
  } {
    const instance = this.deps.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    return {
      enabled: instance.planMode.enabled,
      state: instance.planMode.state,
      planContent: instance.planMode.planContent
    };
  }

  // ============================================
  // Instance Rename
  // ============================================

  /**
   * Rename an instance
   */
  renameInstance(instanceId: string, displayName: string): void {
    const instance = this.deps.getInstance(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    instance.displayName = displayName;
    this.deps.queueUpdate(instanceId, instance.status, instance.contextUsage);
  }

  // ============================================
  // Idle Instance Management
  // ============================================

  private startIdleCheckTimer(): void {
    this.idleCheckTimer = setInterval(() => {
      this.checkIdleInstances();
      this.cleanupZombieProcesses();
    }, 60000);
  }

  private checkIdleInstances(): void {
    const settingsAll = this.settings.getAll();
    const idleMinutes = settingsAll.autoTerminateIdleMinutes;

    if (idleMinutes <= 0) return;

    const idleThreshold = idleMinutes * 60 * 1000;
    const now = Date.now();

    this.deps.forEachInstance((instance) => {
      if (!instance.parentId) return;

      if (
        instance.status === 'idle' &&
        now - instance.lastActivity > idleThreshold
      ) {
        console.log(
          `Auto-terminating idle instance ${instance.id} (${instance.displayName})`
        );
        this.terminateInstance(instance.id, true);
      }
    });
  }

  private terminateIdleInstances(): void {
    const idleInstances: Instance[] = [];
    this.deps.forEachInstance((instance) => {
      if (instance.status === 'idle' && instance.parentId) {
        idleInstances.push(instance);
      }
    });

    idleInstances.sort((a, b) => a.lastActivity - b.lastActivity);

    const toTerminate = Math.ceil(idleInstances.length / 2);
    for (let i = 0; i < toTerminate && i < idleInstances.length; i++) {
      console.log(
        `Terminating idle instance ${idleInstances[i].id} due to memory pressure`
      );
      this.terminateInstance(idleInstances[i].id, true);
    }
  }

  private cleanupZombieProcesses(): void {
    const adapterEntriesToCleanup: string[] = [];

    // First pass: identify adapters to cleanup
    this.deps.forEachInstance((instance, instanceId) => {
      const adapter = this.deps.getAdapter(instanceId);

      if (adapter && (instance.status === 'error' || instance.status === 'terminated')) {
        if (adapter.isRunning()) {
          console.log(`Found zombie process for ${instance.status} instance ${instanceId}, force killing`);
          adapterEntriesToCleanup.push(instanceId);
        } else {
          this.deps.deleteAdapter(instanceId);
        }
      }

      if (instance.processId && !this.deps.getAdapter(instanceId)) {
        console.log(`Instance ${instanceId} claims PID ${instance.processId} but has no adapter, clearing PID`);
        instance.processId = null;
        if (instance.status === 'busy' || instance.status === 'initializing') {
          instance.status = 'error';
          this.deps.queueUpdate(instanceId, 'error');
        }
      }
    });

    // Second pass: cleanup adapters
    for (const instanceId of adapterEntriesToCleanup) {
      this.forceCleanupAdapter(instanceId).catch((err) => {
        console.error(`Failed to cleanup zombie process ${instanceId}:`, err);
      });
    }
  }

  private async forceCleanupAdapter(instanceId: string): Promise<void> {
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

  // ============================================
  // Memory Monitoring
  // ============================================

  private setupMemoryMonitoring(): void {
    this.memoryMonitor.on('warning', (stats) => {
      console.log('Memory warning:', stats);
      this.emit('memory:warning', stats);
    });

    this.memoryMonitor.on('critical', (stats) => {
      console.log('Memory critical:', stats);
      this.emit('memory:critical', stats);

      const settingsAll = this.settings.getAll();
      if (settingsAll.autoTerminateOnMemoryPressure) {
        this.terminateIdleInstances();
      }
    });

    this.memoryMonitor.on('stats', (stats) => {
      this.emit('memory:stats', stats);
    });

    this.memoryMonitor.start();
  }

  /**
   * Get memory statistics
   */
  getMemoryStats() {
    return {
      process: this.memoryMonitor.getStats(),
      storage: this.outputStorage.getTotalStats(),
      pressureLevel: this.memoryMonitor.getPressureLevel()
    };
  }

  // ============================================
  // Cleanup
  // ============================================

  /**
   * Cleanup on shutdown
   */
  destroy(): void {
    if (this.idleCheckTimer) {
      clearInterval(this.idleCheckTimer);
      this.idleCheckTimer = null;
    }
    this.memoryMonitor.stop();
  }
}
