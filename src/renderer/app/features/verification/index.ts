/**
 * Verification Module Exports
 *
 * Organized into subdomains:
 * - dashboard/ - Main verification dashboard
 * - config/    - Verification rule configuration, CLI settings, API keys
 * - execution/ - Running verification, progress tracking
 * - results/   - Displaying results, export, analysis
 * - history/   - Historical runs, comparison (future)
 * - shared/    - Shared components, services
 */

// === Dashboard ===
export { VerificationDashboardComponent } from './dashboard/verification-dashboard.component';

// === Config ===
export { CliSettingsPanelComponent } from './config/cli-settings-panel.component';
export { ApiKeyManagerComponent } from './config/api-key-manager.component';
export { VerificationPreferencesComponent } from './config/verification-preferences.component';
export { AgentConfigPanelComponent } from './config/agent-config-panel.component';
export { AgentPersonalityPickerComponent } from './config/agent-personality-picker.component';
export { CliDetectionPanelComponent } from './config/cli-detection-panel.component';

// === Execution ===
export { VerificationLauncherComponent } from './execution/verification-launcher.component';
export { VerificationMonitorComponent } from './execution/verification-monitor.component';
export { AgentSelectorComponent } from './execution/agent-selector.component';
export { AgentResponseStreamComponent } from './execution/agent-response-stream.component';
export { ProgressTrackerComponent } from './execution/progress-tracker.component';

// === Results ===
export { VerificationResultsComponent } from './results/verification-results.component';
export { ConsensusHeatmapComponent } from './results/consensus-heatmap.component';
export { SynthesisViewerComponent } from './results/synthesis-viewer.component';
export { DebateRoundViewerComponent } from './results/debate-round-viewer.component';
export { ExportPanelComponent, type ExportFormat } from './results/export-panel.component';

// === Shared Components ===
export { CliStatusIndicatorComponent } from './shared/components/cli-status-indicator.component';
export { AgentCapabilityBadgesComponent } from './shared/components/agent-capability-badges.component';
export { AgentCardComponent } from './shared/components/agent-card.component';

// === Shared Services ===
export { VerificationService } from './shared/services/verification.service';
export { AgentStreamService } from './shared/services/agent-stream.service';
export { CliDetectionService } from './shared/services/cli-detection.service';
