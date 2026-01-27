/**
 * Verification Queries - Computed selectors for verification state
 *
 * All read-only computed values derived from verification state.
 */

import { Injectable, inject, computed } from '@angular/core';
import { VerificationStateService } from './verification-state.service';

@Injectable({ providedIn: 'root' })
export class VerificationQueries {
  private stateService = inject(VerificationStateService);

  // ============================================
  // CLI Detection Selectors
  // ============================================

  /** CLI detection result */
  readonly cliDetection = computed(() => this.stateService.state().cliDetection);

  /** Available CLIs */
  readonly availableClis = computed(() =>
    this.stateService.state().cliDetection?.available ?? []
  );

  /** Unavailable CLIs */
  readonly unavailableClis = computed(() =>
    this.stateService.state().cliDetection?.unavailable ?? []
  );

  /** All detected CLIs */
  readonly detectedClis = computed(() =>
    this.stateService.state().cliDetection?.detected ?? []
  );

  /** Is scanning for CLIs */
  readonly isScanning = computed(() => this.stateService.state().isScanning);

  /** Scan error */
  readonly scanError = computed(() => this.stateService.state().scanError);

  // ============================================
  // Session Selectors
  // ============================================

  /** Current verification session */
  readonly currentSession = computed(() => this.stateService.state().currentSession);

  /** Is verification running */
  readonly isRunning = computed(() =>
    this.stateService.state().currentSession?.status === 'running'
  );

  /** Current session status */
  readonly sessionStatus = computed(() =>
    this.stateService.state().currentSession?.status ?? 'idle'
  );

  /** Agent progress as array */
  readonly agentProgressList = computed(() => {
    const session = this.stateService.state().currentSession;
    if (!session) return [];
    return Array.from(session.agentProgress.values());
  });

  /** Current consensus score */
  readonly consensusScore = computed(() =>
    this.stateService.state().currentSession?.consensusScore ?? 0
  );

  /** Current round info */
  readonly roundInfo = computed(() => ({
    current: this.stateService.state().currentSession?.currentRound ?? 0,
    total: this.stateService.state().currentSession?.totalRounds ?? 4,
  }));

  /** Verification result */
  readonly result = computed(() =>
    this.stateService.state().currentSession?.result
  );

  // ============================================
  // History Selectors
  // ============================================

  /** Session history */
  readonly sessions = computed(() => this.stateService.state().sessions);

  /** Recent sessions (last 10) */
  readonly recentSessions = computed(() =>
    this.stateService.state().sessions.slice(0, 10)
  );

  // ============================================
  // Configuration Selectors
  // ============================================

  /** Default configuration */
  readonly defaultConfig = computed(() => this.stateService.state().defaultConfig);

  /** Alias for defaultConfig (used by preferences component) */
  readonly config = computed(() => this.stateService.state().defaultConfig);

  /** Selected agents */
  readonly selectedAgents = computed(() => this.stateService.state().selectedAgents);

  // ============================================
  // UI State Selectors
  // ============================================

  /** Config panel open */
  readonly configPanelOpen = computed(() => this.stateService.state().configPanelOpen);

  /** Selected tab */
  readonly selectedTab = computed(() => this.stateService.state().selectedTab);
}
