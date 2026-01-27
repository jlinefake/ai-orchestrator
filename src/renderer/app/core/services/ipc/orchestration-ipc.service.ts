/**
 * Orchestration IPC Service - Orchestration, workflow, debate, and supervision operations
 */

import { Injectable, inject } from '@angular/core';
import { ElectronIpcService, IpcResponse } from './electron-ipc.service';

@Injectable({ providedIn: 'root' })
export class OrchestrationIpcService {
  private base = inject(ElectronIpcService);

  private get api() {
    return this.base.getApi();
  }

  private get ngZone() {
    return this.base.getNgZone();
  }

  // ============================================
  // Workflows
  // ============================================

  /**
   * List available workflow templates
   */
  async workflowListTemplates(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.workflowListTemplates();
  }

  /**
   * Get a specific workflow template
   */
  async workflowGetTemplate(templateId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.workflowGetTemplate(templateId);
  }

  /**
   * Start a workflow
   */
  async workflowStart(payload: {
    instanceId: string;
    templateId: string;
    config?: Record<string, unknown>;
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.workflowStart(payload);
  }

  /**
   * Get workflow execution status
   */
  async workflowGetExecution(executionId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.workflowGetExecution(executionId);
  }

  /**
   * Get workflow execution for instance
   */
  async workflowGetByInstance(instanceId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.workflowGetByInstance(instanceId);
  }

  /**
   * Complete a workflow phase
   */
  async workflowCompletePhase(executionId: string, phaseId: string, result?: unknown): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.workflowCompletePhase(executionId, phaseId, result);
  }

  /**
   * Satisfy a workflow gate
   */
  async workflowSatisfyGate(executionId: string, gateId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.workflowSatisfyGate(executionId, gateId);
  }

  /**
   * Skip a workflow phase
   */
  async workflowSkipPhase(executionId: string, phaseId: string, reason?: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.workflowSkipPhase(executionId, phaseId, reason);
  }

  /**
   * Cancel a workflow
   */
  async workflowCancel(executionId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.workflowCancel(executionId);
  }

  /**
   * Get workflow prompt addition
   */
  async workflowGetPromptAddition(executionId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.workflowGetPromptAddition(executionId);
  }

  // ============================================
  // Review Agents
  // ============================================

  /**
   * List available review agents
   */
  async reviewListAgents(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.reviewListAgents();
  }

  /**
   * Get a specific review agent
   */
  async reviewGetAgent(agentId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.reviewGetAgent(agentId);
  }

  // ============================================
  // Worktrees
  // ============================================

  /**
   * Create a worktree for isolated work
   */
  async worktreeCreate(payload: {
    instanceId: string;
    baseBranch?: string;
    branchName?: string;
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.worktreeCreate(payload);
  }

  /**
   * List worktrees
   */
  async worktreeList(instanceId?: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.worktreeList(instanceId);
  }

  /**
   * Delete a worktree
   */
  async worktreeDelete(worktreeId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.worktreeDelete(worktreeId);
  }

  /**
   * Get worktree status
   */
  async worktreeGetStatus(worktreeId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.worktreeGetStatus(worktreeId);
  }

  // ============================================
  // Specialists
  // ============================================

  /**
   * List all specialist profiles
   */
  async specialistList(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.specialistList();
  }

  /**
   * List built-in specialist profiles
   */
  async specialistListBuiltin(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.specialistListBuiltin();
  }

  /**
   * List custom specialist profiles
   */
  async specialistListCustom(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.specialistListCustom();
  }

  /**
   * Get a specialist profile
   */
  async specialistGet(profileId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.specialistGet(profileId);
  }

  /**
   * Get specialist profiles by category
   */
  async specialistGetByCategory(category: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.specialistGetByCategory(category);
  }

  /**
   * Add a custom specialist profile
   */
  async specialistAddCustom(profile: {
    id: string;
    name: string;
    description: string;
    category: string;
    icon: string;
    color: string;
    systemPromptAddition: string;
    restrictedTools: string[];
    constraints?: {
      readOnlyMode?: boolean;
      maxTokens?: number;
      allowedDirectories?: string[];
      blockedDirectories?: string[];
      requireApprovalFor?: string[];
    };
    tags?: string[];
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.specialistAddCustom(profile);
  }

  /**
   * Update a custom specialist profile
   */
  async specialistUpdateCustom(profileId: string, updates: {
    name?: string;
    description?: string;
    category?: string;
    icon?: string;
    color?: string;
    systemPromptAddition?: string;
    restrictedTools?: string[];
    constraints?: {
      readOnlyMode?: boolean;
      maxTokens?: number;
      allowedDirectories?: string[];
      blockedDirectories?: string[];
      requireApprovalFor?: string[];
    };
    tags?: string[];
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.specialistUpdateCustom(profileId, updates);
  }

  /**
   * Remove a custom specialist profile
   */
  async specialistRemoveCustom(profileId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.specialistRemoveCustom(profileId);
  }

  /**
   * Get specialist recommendations based on context
   */
  async specialistRecommend(context: {
    taskDescription?: string;
    fileTypes?: string[];
    userPreferences?: string[];
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.specialistRecommend(context);
  }

  /**
   * Create a specialist instance
   */
  async specialistCreateInstance(profileId: string, orchestratorInstanceId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.specialistCreateInstance(profileId, orchestratorInstanceId);
  }

  /**
   * Get a specialist instance
   */
  async specialistGetInstance(instanceId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.specialistGetInstance(instanceId);
  }

  /**
   * Get all active specialist instances
   */
  async specialistGetActiveInstances(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.specialistGetActiveInstances();
  }

  /**
   * Update specialist instance status
   */
  async specialistUpdateStatus(instanceId: string, status: 'active' | 'paused' | 'completed' | 'failed'): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.specialistUpdateStatus(instanceId, status);
  }

  /**
   * Add a finding to a specialist instance
   */
  async specialistAddFinding(instanceId: string, finding: {
    id: string;
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
    title: string;
    description: string;
    filePath?: string;
    lineRange?: { start: number; end: number };
    codeSnippet?: string;
    suggestion?: string;
    confidence: number;
    tags?: string[];
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.specialistAddFinding(instanceId, finding);
  }

  /**
   * Update specialist instance metrics
   */
  async specialistUpdateMetrics(instanceId: string, updates: {
    filesAnalyzed?: number;
    linesAnalyzed?: number;
    findingsCount?: number;
    tokensUsed?: number;
    durationMs?: number;
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.specialistUpdateMetrics(instanceId, updates);
  }

  /**
   * Get system prompt addition for a specialist
   */
  async specialistGetPromptAddition(profileId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.specialistGetPromptAddition(profileId);
  }

  // ============================================
  // Supervision
  // ============================================

  /**
   * Get supervision tree
   */
  async supervisionGetTree(rootInstanceId?: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.supervisionGetTree(rootInstanceId);
  }

  /**
   * Get supervision health status
   */
  async supervisionGetHealth(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.supervisionGetHealth();
  }

  // ============================================
  // Debate
  // ============================================

  /**
   * Start a debate
   */
  async debateStart(payload: {
    query: string;
    context?: string;
    config?: Record<string, unknown>;
  }): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.debateStart(payload);
  }

  /**
   * Get debate result
   */
  async debateGetResult(debateId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.debateGetResult(debateId);
  }

  /**
   * Get active debates
   */
  async debateGetActive(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.debateGetActive();
  }

  /**
   * Cancel debate
   */
  async debateCancel(debateId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.debateCancel(debateId);
  }

  /**
   * Get debate stats
   */
  async debateGetStats(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.debateGetStats();
  }

  // ============================================
  // Skills
  // ============================================

  /**
   * Discover skills in a directory
   */
  async skillsDiscover(directory?: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.skillsDiscover(directory);
  }

  /**
   * List available skills
   */
  async skillsList(): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.skillsList();
  }

  /**
   * Get a skill by ID
   */
  async skillsGet(skillId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.skillsGet(skillId);
  }

  /**
   * Load a skill
   */
  async skillsLoad(skillId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.skillsLoad(skillId);
  }

  /**
   * Unload a skill
   */
  async skillsUnload(skillId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.skillsUnload(skillId);
  }

  /**
   * Load reference documentation for a skill
   */
  async skillsLoadReference(skillId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.skillsLoadReference(skillId);
  }

  /**
   * Load example for a skill
   */
  async skillsLoadExample(skillId: string, exampleId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.skillsLoadExample(skillId, exampleId);
  }

  /**
   * Match skills to a query
   */
  async skillsMatch(query: string, maxResults?: number): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.skillsMatch(query, maxResults);
  }

  /**
   * Get skill memory
   */
  async skillsGetMemory(skillId: string): Promise<IpcResponse> {
    if (!this.api) return { success: false, error: { message: 'Not in Electron' } };
    return this.api.skillsGetMemory(skillId);
  }
}
