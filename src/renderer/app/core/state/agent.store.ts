/**
 * Agent Store - Manages agent profile state in the renderer
 */

import { Injectable, signal, computed } from '@angular/core';
import {
  AgentProfile,
  BUILTIN_AGENTS,
  getDefaultAgent,
  getAgentById,
} from '../../../../shared/types/agent.types';

@Injectable({ providedIn: 'root' })
export class AgentStore {
  // State
  private readonly _selectedAgentId = signal<string>(getDefaultAgent().id);
  private readonly _customAgents = signal<AgentProfile[]>([]);

  // Computed values
  readonly selectedAgentId = this._selectedAgentId.asReadonly();
  readonly customAgents = this._customAgents.asReadonly();

  /**
   * All available agents (built-in + custom)
   */
  readonly allAgents = computed(() => [...BUILTIN_AGENTS, ...this._customAgents()]);

  /**
   * Currently selected agent profile
   */
  readonly selectedAgent = computed(() => {
    const id = this._selectedAgentId();
    return getAgentById(id) || this._customAgents().find((a) => a.id === id) || getDefaultAgent();
  });

  /**
   * Select an agent by ID
   */
  selectAgent(agentId: string): void {
    const agent = getAgentById(agentId) || this._customAgents().find((a) => a.id === agentId);
    if (agent) {
      this._selectedAgentId.set(agentId);
    }
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): AgentProfile | undefined {
    return getAgentById(agentId) || this._customAgents().find((a) => a.id === agentId);
  }

  /**
   * Add a custom agent
   */
  addCustomAgent(agent: AgentProfile): void {
    if (agent.builtin) {
      throw new Error('Cannot add a built-in agent as custom');
    }
    this._customAgents.update((agents) => [...agents, agent]);
  }

  /**
   * Remove a custom agent
   */
  removeCustomAgent(agentId: string): void {
    this._customAgents.update((agents) => agents.filter((a) => a.id !== agentId));
    // If the removed agent was selected, switch to default
    if (this._selectedAgentId() === agentId) {
      this._selectedAgentId.set(getDefaultAgent().id);
    }
  }

  /**
   * Reset to default agent
   */
  resetToDefault(): void {
    this._selectedAgentId.set(getDefaultAgent().id);
  }
}
