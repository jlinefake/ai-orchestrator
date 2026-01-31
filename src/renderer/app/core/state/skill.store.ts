/**
 * Skill Store - State management for skills integration with command palette
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { OrchestrationIpcService } from '../services/ipc/orchestration-ipc.service';
import type { SkillBundle, SkillMatch } from '../../../../shared/types/skill.types';

export interface SkillCommand {
  id: string;
  name: string;
  description: string;
  trigger: string;
  category?: string;
  icon?: string;
  isSkill: true;
}

@Injectable({ providedIn: 'root' })
export class SkillStore {
  private ipcService = inject(OrchestrationIpcService);

  // State
  private _skills = signal<SkillBundle[]>([]);
  private _loading = signal(false);
  private _error = signal<string | null>(null);
  private _activeSkills = signal<Set<string>>(new Set());

  // Selectors
  skills = this._skills.asReadonly();
  loading = this._loading.asReadonly();
  error = this._error.asReadonly();
  activeSkills = this._activeSkills.asReadonly();

  /**
   * Get skills formatted as commands for the command palette
   */
  skillCommands = computed((): SkillCommand[] => {
    return this._skills().flatMap(skill =>
      skill.metadata.triggers.map(trigger => ({
        id: `skill:${skill.id}:${trigger}`,
        name: trigger.replace(/^\//, ''), // Remove leading slash if present
        description: skill.metadata.description,
        trigger,
        category: skill.metadata.category,
        icon: skill.metadata.icon,
        isSkill: true as const,
      }))
    );
  });

  /**
   * Get count of active skills
   */
  activeSkillCount = computed(() => this._activeSkills().size);

  /**
   * Discover and load available skills
   */
  async discoverSkills(): Promise<void> {
    this._loading.set(true);
    this._error.set(null);

    try {
      const response = await this.ipcService.skillsDiscover();
      if (response.success && 'data' in response && response.data) {
        this._skills.set(response.data as SkillBundle[]);
      } else {
        const errorMsg = 'error' in response ? response.error?.message : 'Failed to discover skills';
        this._error.set(errorMsg || 'Failed to discover skills');
      }
    } catch (err) {
      this._error.set((err as Error).message);
    } finally {
      this._loading.set(false);
    }
  }

  /**
   * Match input text against skill triggers
   */
  async matchSkill(text: string): Promise<SkillMatch | null> {
    try {
      const response = await this.ipcService.skillsMatch(text);
      if (response.success && 'data' in response && response.data) {
        return response.data as SkillMatch;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * Load a skill (activate it)
   */
  async loadSkill(skillId: string): Promise<boolean> {
    try {
      const response = await this.ipcService.skillsLoad(skillId);
      if (response.success) {
        this._activeSkills.update(set => {
          const newSet = new Set(set);
          newSet.add(skillId);
          return newSet;
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Unload a skill (deactivate it)
   */
  async unloadSkill(skillId: string): Promise<boolean> {
    try {
      const response = await this.ipcService.skillsUnload(skillId);
      if (response.success) {
        this._activeSkills.update(set => {
          const newSet = new Set(set);
          newSet.delete(skillId);
          return newSet;
        });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Get a skill by ID
   */
  getSkillById(skillId: string): SkillBundle | undefined {
    return this._skills().find(s => s.id === skillId);
  }

  /**
   * Get skills by category
   */
  getSkillsByCategory(category: string): SkillBundle[] {
    return this._skills().filter(s => s.metadata.category === category);
  }

  /**
   * Check if a skill is active
   */
  isSkillActive(skillId: string): boolean {
    return this._activeSkills().has(skillId);
  }

  /**
   * Get active skill bundles
   */
  getActiveSkillBundles(): SkillBundle[] {
    const activeIds = this._activeSkills();
    return this._skills().filter(s => activeIds.has(s.id));
  }
}
