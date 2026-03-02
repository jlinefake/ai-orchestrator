/**
 * Application Routes
 *
 * Main routes for the application including Phase 6-9 feature components:
 * - Workflows, Hooks, Skills (Phase 6)
 * - Specialists, Worktrees, Supervision (Phase 7)
 * - Memory Browser (Phase 8-9)
 * - Review Results (Phase 6)
 */

import { Routes } from '@angular/router';

export const routes: Routes = [
  // Default dashboard
  {
    path: '',
    loadComponent: () =>
      import('./features/dashboard/dashboard.component').then(
        (m) => m.DashboardComponent
      ),
  },

  // Settings
  {
    path: 'settings',
    loadComponent: () =>
      import('./features/settings/settings.component').then(
        (m) => m.SettingsComponent
      ),
  },

  // Phase 6: Workflows
  {
    path: 'workflows',
    loadComponent: () =>
      import('./features/workflow/workflow-page.component').then(
        (m) => m.WorkflowPageComponent
      ),
  },

  // Phase 6: Hooks Configuration
  {
    path: 'hooks',
    loadComponent: () =>
      import('./features/hooks/hooks-page.component').then(
        (m) => m.HooksPageComponent
      ),
  },

  // Phase 6: Skills Browser
  {
    path: 'skills',
    loadComponent: () =>
      import('./features/skills/skills-page.component').then(
        (m) => m.SkillsPageComponent
      ),
  },

  // Phase 6: Review Results
  {
    path: 'reviews',
    loadComponent: () =>
      import('./features/review/reviews-page.component').then(
        (m) => m.ReviewsPageComponent
      ),
  },

  // Phase 7: Specialists Picker
  {
    path: 'specialists',
    loadComponent: () =>
      import('./features/specialists/specialists-page.component').then(
        (m) => m.SpecialistsPageComponent
      ),
  },

  // Phase 7: Worktree Panel
  {
    path: 'worktrees',
    loadComponent: () =>
      import('./features/worktree/worktree-page.component').then(
        (m) => m.WorktreePageComponent
      ),
  },

  // Phase 7: Supervision Tree View
  {
    path: 'supervision',
    loadComponent: () =>
      import('./features/supervision/supervision-page.component').then(
        (m) => m.SupervisionPageComponent
      ),
  },

  // Phase 8: RLM Context Browser
  {
    path: 'rlm',
    loadComponent: () =>
      import('./features/rlm/rlm-page.component').then(
        (m) => m.RlmPageComponent
      ),
  },

  // Phase 8: GRPO Training Dashboard
  {
    path: 'training',
    loadComponent: () =>
      import('./features/training/training-page.component').then(
        (m) => m.TrainingPageComponent
      ),
  },

  // Phase 9: Memory Browser
  {
    path: 'memory',
    loadComponent: () =>
      import('./features/memory/memory-page.component').then(
        (m) => m.MemoryPageComponent
      ),
  },

  // Phase 9: Memory Stats
  {
    path: 'memory/stats',
    loadComponent: () =>
      import('./features/memory/memory-stats.component').then(
        (m) => m.MemoryStatsComponent
      ),
  },

  // Phase 9: Debate Visualization
  {
    path: 'debate',
    loadComponent: () =>
      import('./features/debate/debate-page.component').then(
        (m) => m.DebatePageComponent
      ),
  },

  // Multi-Agent Verification
  {
    path: 'verification',
    loadComponent: () =>
      import('./features/verification/dashboard/verification-dashboard.component').then(
        (m) => m.VerificationDashboardComponent
      ),
  },

  // Verification: CLI Settings
  {
    path: 'verification/settings',
    loadComponent: () =>
      import('./features/verification/config/cli-settings-panel.component').then(
        (m) => m.CliSettingsPanelComponent
      ),
  },

  // Catch-all redirect to dashboard
  {
    path: '**',
    redirectTo: '',
  },
];
