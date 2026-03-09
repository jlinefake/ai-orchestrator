/**
 * Root Application Component
 */

import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ElectronIpcService } from './core/services/ipc';
import { PerfInstrumentationService } from './core/services/perf-instrumentation.service';
import { StressFixturesService } from './core/services/stress-fixtures.service';
import { InstanceStateService } from './core/state/instance/instance-state.service';
import type { Instance, OutputMessage } from './core/state/instance/instance.types';

type BenchmarkPresetName = 'light' | 'medium' | 'heavy-markdown' | 'heavy-tools' | 'extreme';

interface WorkspaceBenchmarkHarness {
  clear(): void;
  loadPreset(preset?: BenchmarkPresetName): Promise<Record<string, unknown>>;
  runThreadSwitchBenchmark(iterations?: number): Promise<Record<string, unknown>>;
  runWorkspaceBaseline(preset?: BenchmarkPresetName, iterations?: number): Promise<Record<string, unknown>>;
}

declare global {
  interface Window {
    __perfService?: PerfInstrumentationService;
    __stressFixtures?: StressFixturesService;
    __workspaceBench?: WorkspaceBenchmarkHarness;
  }
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="app-container" [class.macos]="isMacOS">
      <!-- Draggable title bar area for macOS -->
      @if (isMacOS) {
        <div class="title-bar-drag-area"></div>
      }

      <main class="app-main">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .app-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      width: 100vw;
      background: var(--bg-primary);
    }

    .app-container.macos {
      padding-top: 52px; /* Space for traffic lights (40px) + padding */
    }

    .title-bar-drag-area {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      height: 52px;
      -webkit-app-region: drag;
      z-index: 1000;
      /* Allow clicks on buttons within the drag area */
    }

    .app-main {
      flex: 1;
      display: flex;
      overflow: hidden;
    }

    .app-main > router-outlet {
      flex: 0 0 0;
      width: 0;
      height: 0;
      overflow: hidden;
      display: contents;
    }

    /* Ensure routed components fill the container */
    .app-main > * {
      flex: 1;
      display: flex;
      height: 100%;
      width: 100%;
    }
  `],
})
export class AppComponent implements OnInit {
  private ipcService = inject(ElectronIpcService);
  private perfService = inject(PerfInstrumentationService);
  private stressFixtures = inject(StressFixturesService);
  private instanceState = inject(InstanceStateService);

  isMacOS = false;

  async ngOnInit(): Promise<void> {
    // Check platform - use Electron API if available, fallback to navigator
    const electronPlatform = this.ipcService.platform;
    if (electronPlatform && electronPlatform !== 'browser') {
      this.isMacOS = electronPlatform === 'darwin';
    } else {
      // Fallback detection for when Electron API isn't available
      this.isMacOS = navigator.platform?.toLowerCase().includes('mac') ?? false;
    }

    console.log('Platform detected:', this.isMacOS ? 'macOS' : 'other', '(source:', electronPlatform, ')');

    // Expose dev tools on window for console access (referenced in workspace-benchmarks.md)
    window.__perfService = this.perfService;
    window.__stressFixtures = this.stressFixtures;
    window.__workspaceBench = {
      clear: () => this.clearWorkspaceBenchmarks(),
      loadPreset: (preset = 'medium') => this.loadBenchmarkPreset(preset),
      runThreadSwitchBenchmark: (iterations = 12) => this.runThreadSwitchBenchmark(iterations),
      runWorkspaceBaseline: (preset = 'heavy-markdown', iterations = 12) =>
        this.runWorkspaceBaseline(preset, iterations),
    };

    // Signal app ready
    await this.ipcService.appReady();
    console.log('AI Orchestrator UI ready');
  }

  private async runWorkspaceBaseline(
    preset: BenchmarkPresetName,
    iterations: number
  ): Promise<Record<string, unknown>> {
    await this.loadBenchmarkPreset(preset);
    return this.runThreadSwitchBenchmark(iterations);
  }

  private async loadBenchmarkPreset(
    preset: BenchmarkPresetName
  ): Promise<Record<string, unknown>> {
    const instanceId = `benchmark:${preset}`;
    const messages = this.generatePresetMessages(preset);
    this.ensureBenchmarkInstance(instanceId, preset);

    this.perfService.enable();
    this.perfService.clear();
    this.instanceState.updateInstance(instanceId, {
      outputBuffer: messages,
      lastActivity: Date.now(),
    });
    this.instanceState.setSelectedInstance(instanceId);
    await this.waitForPaint();

    return {
      preset,
      instanceId,
      messageCount: messages.length,
      summaries: this.perfService.getAllSummaries(),
      budgets: this.perfService.checkBudgets(),
    };
  }

  private async runThreadSwitchBenchmark(
    iterations: number
  ): Promise<Record<string, unknown>> {
    const firstInstanceId = 'benchmark:switch-a';
    const secondInstanceId = 'benchmark:switch-b';

    this.ensureBenchmarkInstance(firstInstanceId, 'light');
    this.ensureBenchmarkInstance(secondInstanceId, 'medium');

    this.instanceState.updateInstance(firstInstanceId, {
      outputBuffer: this.generatePresetMessages('light'),
      lastActivity: Date.now(),
    });
    this.instanceState.updateInstance(secondInstanceId, {
      outputBuffer: this.generatePresetMessages('medium'),
      lastActivity: Date.now(),
    });

    this.perfService.enable();
    this.perfService.clear();
    this.instanceState.setSelectedInstance(firstInstanceId);
    await this.waitForPaint();

    for (let i = 0; i < iterations; i += 1) {
      this.instanceState.setSelectedInstance(secondInstanceId);
      await this.waitForPaint();
      this.instanceState.setSelectedInstance(firstInstanceId);
      await this.waitForPaint();
    }

    return {
      iterations,
      summaries: this.perfService.getAllSummaries(),
      budgets: this.perfService.checkBudgets(),
    };
  }

  private clearWorkspaceBenchmarks(): void {
    for (const instanceId of Array.from(this.instanceState.state().instances.keys())) {
      if (instanceId.startsWith('benchmark:')) {
        this.instanceState.removeInstance(instanceId);
      }
    }
    this.instanceState.setSelectedInstance(null);
    this.perfService.clear();
  }

  private ensureBenchmarkInstance(instanceId: string, preset: BenchmarkPresetName): void {
    if (this.instanceState.getInstance(instanceId)) {
      return;
    }

    const messages = this.generatePresetMessages(preset);
    const now = Date.now();
    const instance: Instance = {
      id: instanceId,
      displayName: `Benchmark ${preset}`,
      createdAt: now,
      parentId: null,
      childrenIds: [],
      agentId: 'build',
      agentMode: 'build',
      provider: 'claude',
      status: 'idle',
      contextUsage: {
        used: 0,
        total: 200000,
        percentage: 0,
      },
      lastActivity: now,
      sessionId: instanceId,
      workingDirectory: '/benchmark',
      yoloMode: false,
      currentModel: 'benchmark',
      outputBuffer: messages,
    };

    this.instanceState.addInstance(instance);
  }

  private generatePresetMessages(preset: BenchmarkPresetName): OutputMessage[] {
    switch (preset) {
      case 'light':
        return this.stressFixtures.generateTranscript(50);
      case 'medium':
        return this.stressFixtures.generateTranscript(200, {
          includeCodeBlocks: true,
          includeToolCalls: true,
        });
      case 'heavy-markdown':
        return this.stressFixtures.generateLongMarkdownTranscript(500);
      case 'heavy-tools':
        return this.stressFixtures.generateToolHeavyTranscript(500);
      case 'extreme':
        return this.stressFixtures.generateMixedHeavyTranscript(2000);
    }
  }

  private async waitForPaint(): Promise<void> {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });
  }
}
