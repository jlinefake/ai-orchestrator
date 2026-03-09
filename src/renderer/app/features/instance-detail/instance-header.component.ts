/**
 * Instance Header Component - Header with status, badges, and actions
 */

import {
  Component,
  input,
  output,
  computed,
  inject,
  effect,
  signal,
  viewChild,
  ElementRef,
  OnInit,
  ChangeDetectionStrategy
} from '@angular/core';
import { StatusIndicatorComponent } from '../instance-list/status-indicator.component';
import { RecentDirectoriesDropdownComponent } from '../../shared/components/recent-directories-dropdown/recent-directories-dropdown.component';
import { SkillStore } from '../../core/state/skill.store';
import { HookStore } from '../../core/state/hook.store';
import { FileIpcService } from '../../core/services/ipc/file-ipc.service';
import { ElectronIpcService } from '../../core/services/ipc/electron-ipc.service';
import type { Instance } from '../../core/state/instance.store';
import { getModelShortName } from '../../../../shared/types/provider.types';
import type { ModelDisplayInfo } from '../../../../shared/types/provider.types';

interface EditorMenuItem {
  type: string;
  label: string;
}

@Component({
  selector: 'app-instance-header',
  standalone: true,
  imports: [StatusIndicatorComponent, RecentDirectoriesDropdownComponent],
  template: `
    <div class="detail-header">
      <div class="instance-identity">
        <div class="name-row">
          <app-status-indicator [status]="instance().status" />
          @if (isEditingName()) {
            <input
              type="text"
              class="name-input"
              [value]="instance().displayName"
              (keydown.enter)="onSaveName($event)"
              (keydown.escape)="cancelEditName.emit()"
              (blur)="onSaveName($event)"
              #nameInput
            />
          } @else {
            <h2
              class="instance-name editable"
              title="Double-click to rename"
              role="button"
              tabindex="0"
              (dblclick)="startEditName.emit()"
              (keydown.enter)="startEditName.emit()"
              (keydown.space)="startEditName.emit()"
            >
              {{ instance().displayName }}
              <span class="edit-icon">rename</span>
            </h2>
          }
        </div>
        <div class="instance-meta">
          <span
            class="provider-badge"
            [style.background-color]="providerColor()"
            [title]="'Provider: ' + providerDisplayName()"
          >
            {{ providerDisplayName() }}
          </span>
          @if (availableModels().length > 0) {
            <div class="model-selector-inline">
              <button
                class="model-btn"
                [style.border-color]="modelBtnBorderColor()"
                [style.background]="modelBtnBgColor()"
                [style.color]="providerColor()"
                [disabled]="instance().status === 'busy' || instance().status === 'respawning'"
                (click)="$event.stopPropagation(); toggleModelDropdown.emit()"
                [title]="'Model: ' + currentModelId()"
              >
                {{ currentModelDisplayName() }}
                <span class="dropdown-caret">▼</span>
              </button>
              @if (showModelDropdown()) {
                <div class="model-dropdown">
                  @for (model of availableModels(); track model.id) {
                    <button
                      class="model-option"
                      [class.selected]="model.id === currentModelId()"
                      (click)="selectModel.emit(model.id)"
                    >
                      <span class="model-name">{{ model.name }}</span>
                      <span class="model-tier" [class]="'tier-' + model.tier">{{ model.tier }}</span>
                      @if (model.id === currentModelId()) {
                        <span class="check">✓</span>
                      }
                    </button>
                  }
                </div>
              }
            </div>
            @if (showModelDropdown()) {
              <button
                type="button"
                class="model-backdrop"
                aria-label="Close model menu"
                (click)="closeModelDropdown.emit()"
              ></button>
            }
          }
          <span class="separator">•</span>
          <button
            class="mode-badge"
            [class.plan]="instance().agentId === 'plan'"
            [class.review]="instance().agentId === 'review'"
            [disabled]="isChangingMode() || instance().status === 'busy' || instance().status === 'respawning'"
            [title]="
              instance().status === 'busy' || instance().status === 'respawning'
                ? 'Cannot change mode while instance is busy'
                : 'Click to change mode'
            "
            (click)="cycleAgentMode.emit()"
          >
            {{ agentModeIcon() }}
            {{ agentModeName() }}
          </button>
          <span class="separator">•</span>
          <app-recent-directories-dropdown
            [currentPath]="instance().workingDirectory || ''"
            (folderSelected)="selectFolder.emit($event)"
          />
          <span class="separator">•</span>
          <button
            class="yolo-badge"
            [class.active]="instance().yoloMode"
            [disabled]="isTogglingYolo() || instance().status === 'busy' || instance().status === 'respawning'"
            [title]="
              instance().status === 'busy' || instance().status === 'respawning'
                ? 'Cannot toggle YOLO mode while instance is busy'
                : instance().yoloMode
                  ? 'YOLO Mode: Auto-approve all tool calls without prompting. Click to disable'
                  : 'YOLO Mode: Requires manual approval for tool calls. Click to enable auto-approve'
            "
            (click)="toggleYolo.emit()"
          >
            ⚡ YOLO {{ instance().yoloMode ? 'ON' : 'OFF' }}
          </button>
          @if (activeSkillCount() > 0 || enabledHookCount() > 0) {
            <span class="separator">•</span>
          }
          @if (activeSkillCount() > 0) {
            <span
              class="skills-badge"
              [title]="activeSkillsTooltip()"
            >
              🧩 {{ activeSkillCount() }} skill{{ activeSkillCount() > 1 ? 's' : '' }}
            </span>
          }
          @if (enabledHookCount() > 0) {
            <span
              class="hooks-badge"
              [title]="enabledHooksTooltip()"
            >
              🪝 {{ enabledHookCount() }} hook{{ enabledHookCount() > 1 ? 's' : '' }}
            </span>
          }
        </div>
      </div>

      <div class="header-actions">
        @if (instance().status === 'busy') {
          <button
            class="btn-action btn-interrupt"
            title="Interrupt Claude (Esc)"
            (click)="interrupt.emit()"
          >
            ⏸ Interrupt
          </button>
        }
        @if (canShowFileExplorer()) {
          <button
            class="btn-action btn-icon"
            [class.active]="isFileExplorerOpen()"
            [title]="isFileExplorerOpen() ? 'Hide file browser' : 'Show file browser'"
            (click)="toggleFileExplorer.emit()"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6H10l2 2h7.5A1.5 1.5 0 0 1 21 9.5v8A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-10Z"/>
            </svg>
          </button>
        }
        <div class="open-menu-shell">
          <button
            class="btn-action btn-open"
            title="Open workspace"
            [disabled]="!instance().workingDirectory"
            (click)="onToggleOpenMenu($event)"
          >
            <span>Open</span>
            <span class="open-caret">▾</span>
          </button>
          @if (showOpenMenu()) {
            <div class="open-menu">
              <button
                class="open-menu-item"
                (click)="openInPreferredEditor()"
                [disabled]="isLoadingEditors()"
              >
                Open in {{ preferredEditorLabel() }}
              </button>
              <button
                class="open-menu-item"
                (click)="openInSystemFileManager()"
              >
                Open in {{ systemFolderLabel() }}
              </button>
            </div>
            <button
              type="button"
              class="open-menu-backdrop"
              aria-label="Close open menu"
              (click)="showOpenMenu.set(false)"
            ></button>
          }
        </div>
        <button
          class="btn-action"
          title="Restart instance"
          (click)="restart.emit()"
          [disabled]="instance().status === 'initializing' || instance().status === 'respawning'"
        >
          ↻ Restart
        </button>
        <button
          class="btn-action btn-danger"
          title="Terminate instance"
          (click)="terminate.emit()"
        >
          × Terminate
        </button>
        <button
          class="btn-action btn-primary"
          title="Create child instance"
          (click)="createChild.emit()"
        >
          + Child
        </button>
      </div>
    </div>
  `,
  styles: [
    `
      .detail-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 16px;
        padding: 2px 2px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }

      .instance-identity {
        flex: 1;
        min-width: 0;
      }

      .name-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .instance-name {
        font-family: var(--font-display);
        font-size: clamp(20px, 2.2vw, 24px);
        font-weight: 600;
        letter-spacing: -0.02em;
        margin: 0;
        color: var(--text-primary);

        &.editable {
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: var(--spacing-xs);
          padding: 4px 6px;
          border-radius: 10px;
          transition: background var(--transition-fast);

          &:hover {
            background: rgba(255, 255, 255, 0.03);
          }

          .edit-icon {
            opacity: 0;
            font-family: var(--font-mono);
            font-size: 9px;
            letter-spacing: 0.12em;
            text-transform: uppercase;
            transition: opacity var(--transition-fast);
            color: var(--text-muted);
          }

          &:hover .edit-icon {
            opacity: 0.6;
          }
        }
      }

      .name-input {
        font-family: var(--font-display);
        font-size: 20px;
        font-weight: 700;
        letter-spacing: -0.02em;
        padding: 4px 10px;
        border: 2px solid var(--primary-color);
        border-radius: var(--radius-md);
        background: var(--bg-secondary);
        color: var(--text-primary);
        outline: none;
        min-width: 200px;
        box-shadow: 0 0 0 4px rgba(var(--primary-rgb), 0.15);
      }

      .instance-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: var(--text-secondary);
        margin-top: 8px;
        flex-wrap: wrap;
      }

      .separator {
        display: none;
      }

      .working-dir-btn {
        max-width: 300px;
        font-family: var(--font-mono);
        font-size: 11px;
        letter-spacing: 0.02em;
        background: var(--bg-tertiary);
        border: 1px solid var(--border-subtle);
        border-radius: var(--radius-sm);
        padding: 4px 10px;
        color: var(--text-muted);
        cursor: pointer;
        transition: all var(--transition-fast);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;

        &:hover {
          border-color: var(--primary-color);
          color: var(--text-primary);
          background: rgba(var(--primary-rgb), 0.1);
        }
      }

      .provider-badge {
        padding: 5px 9px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 999px;
        font-family: var(--font-mono);
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: white;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
      }

      /* Inline Model Selector */
      .model-selector-inline {
        position: relative;
        display: inline-block;
        margin-left: 6px;
      }

      .model-btn {
        padding: 5px 9px;
        border: 1px solid;
        border-radius: 999px;
        font-family: var(--font-mono);
        font-size: 10px;
        font-weight: 600;
        letter-spacing: 0.04em;
        cursor: pointer;
        transition: all var(--transition-fast);
        display: flex;
        align-items: center;
        gap: 4px;
      }

      .model-btn:hover:not(:disabled) {
        filter: brightness(1.2);
      }

      .model-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .dropdown-caret {
        font-size: 8px;
        opacity: 0.7;
      }

      .model-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        margin-top: 8px;
        min-width: 180px;
        background: rgba(11, 16, 15, 0.96);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 16px;
        box-shadow: 0 18px 36px rgba(0, 0, 0, 0.28);
        z-index: 1000;
        max-height: 300px;
        overflow-y: auto;
        backdrop-filter: blur(18px);
      }

      .model-option {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        padding: 8px 12px;
        border: none;
        background: transparent;
        color: var(--text-primary);
        font-family: var(--font-mono);
        font-size: 11px;
        cursor: pointer;
        text-align: left;
        transition: background var(--transition-fast);
      }

      .model-option:hover {
        background: var(--bg-tertiary);
      }

      .model-option.selected {
        background: var(--bg-tertiary);
        color: var(--primary-color);
      }

      .model-option .check {
        color: var(--primary-color);
        font-size: 12px;
      }

      .model-name {
        flex: 1;
      }

      .model-tier {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        padding: 1px 5px;
        border-radius: 4px;
        margin-right: 6px;
        opacity: 0.7;
      }

      .tier-powerful {
        color: #f59e0b;
      }

      .tier-balanced {
        color: #10b981;
      }

      .tier-fast {
        color: #60a5fa;
      }

      .model-backdrop {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 999;
        background: transparent;
        border: none;
      }

      .mode-badge {
        padding: 5px 9px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 999px;
        font-family: var(--font-mono);
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        background: rgba(111, 143, 128, 0.12);
        color: white;
        cursor: pointer;
        transition: all var(--transition-fast);
        box-shadow: none;

        &:hover {
          background: rgba(111, 143, 128, 0.18);
        }

        &.plan {
          background: rgba(97, 120, 163, 0.15);
          &:hover {
            background: rgba(97, 120, 163, 0.22);
          }
        }

        &.review {
          background: rgba(var(--primary-rgb), 0.12);
          &:hover {
            background: rgba(var(--primary-rgb), 0.18);
          }
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          transform: none;
        }
      }

      .yolo-badge {
        padding: 5px 9px;
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 999px;
        font-family: var(--font-mono);
        font-size: 10px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        background: rgba(255, 255, 255, 0.03);
        color: var(--text-muted);
        cursor: pointer;
        transition: all var(--transition-fast);

        &:hover {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.12);
        }

        &.active {
          background: rgba(var(--primary-rgb), 0.12);
          border-color: rgba(var(--primary-rgb), 0.3);
          color: var(--primary-color);
          animation: none;

          &:hover {
            background: rgba(var(--primary-rgb), 0.18);
          }
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }

      .skills-badge {
        padding: 5px 9px;
        border-radius: 999px;
        font-family: var(--font-mono);
        font-size: 10px;
        font-weight: 600;
        background: rgba(97, 120, 163, 0.12);
        color: #c8d4ff;
        border: 1px solid rgba(97, 120, 163, 0.18);
      }

      .hooks-badge {
        padding: 5px 9px;
        border-radius: 999px;
        font-family: var(--font-mono);
        font-size: 10px;
        font-weight: 600;
        background: rgba(var(--primary-rgb), 0.12);
        color: var(--primary-color);
        border: 1px solid rgba(var(--primary-rgb), 0.18);
      }

      .header-actions {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
        justify-content: flex-end;
        padding-top: 2px;
        position: relative;
      }

      .btn-action {
        padding: 8px 12px;
        border-radius: 14px;
        font-family: var(--font-display);
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.01em;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        color: var(--text-secondary);
        cursor: pointer;
        transition: all var(--transition-fast);

        &:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.06);
          border-color: rgba(255, 255, 255, 0.1);
          color: var(--text-primary);
        }

        &:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }
      }

      .btn-action.btn-icon {
        width: 36px;
        padding: 0;
        justify-content: center;
      }

      .btn-action.btn-icon.active {
        color: var(--primary-color);
        border-color: rgba(var(--primary-rgb), 0.22);
        background: rgba(var(--primary-rgb), 0.1);
      }

      .open-menu-shell {
        position: relative;
      }

      .btn-open {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }

      .open-caret {
        font-size: 10px;
        opacity: 0.72;
      }

      .open-menu {
        position: absolute;
        top: calc(100% + 8px);
        right: 0;
        min-width: 180px;
        padding: 6px;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.08);
        background: rgba(11, 16, 15, 0.96);
        box-shadow: 0 18px 36px rgba(0, 0, 0, 0.28);
        backdrop-filter: blur(18px);
        z-index: 1000;
      }

      .open-menu-item {
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 9px 11px;
        border: none;
        border-radius: 12px;
        background: transparent;
        color: var(--text-primary);
        font-family: var(--font-display);
        font-size: 12px;
        font-weight: 500;
        text-align: left;
        cursor: pointer;
        transition: background var(--transition-fast), color var(--transition-fast);
      }

      .open-menu-item:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.05);
      }

      .open-menu-item:disabled {
        opacity: 0.5;
        cursor: progress;
      }

      .open-menu-backdrop {
        position: fixed;
        inset: 0;
        z-index: 999;
        background: transparent;
        border: none;
      }

      .btn-danger {
        color: var(--error-color);
        border-color: rgba(var(--error-rgb), 0.22);

        &:hover:not(:disabled) {
          background: rgba(var(--error-rgb), 0.12);
          border-color: rgba(var(--error-rgb), 0.3);
        }
      }

      .btn-interrupt {
        background: rgba(var(--primary-rgb), 0.14);
        color: var(--primary-color);
        border: 1px solid rgba(var(--primary-rgb), 0.22);
        animation: none;

        &:hover:not(:disabled) {
          background: rgba(var(--primary-rgb), 0.2);
          border-color: rgba(var(--primary-rgb), 0.3);
          color: var(--primary-hover);
        }
      }

      .btn-primary {
        background: linear-gradient(
          135deg,
          rgba(var(--primary-rgb), 0.94) 0%,
          var(--primary-hover) 100%
        );
        border: none;
        color: var(--bg-primary);
        box-shadow: 0 14px 28px rgba(var(--primary-rgb), 0.16);

        &:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 18px 32px rgba(var(--primary-rgb), 0.22);
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class InstanceHeaderComponent implements OnInit {
  private skillStore = inject(SkillStore);
  private hookStore = inject(HookStore);
  private fileIpc = inject(FileIpcService);
  private electronIpc = inject(ElectronIpcService);

  private nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');

  instance = input.required<Instance>();
  isEditingName = input(false);
  isChangingMode = input(false);
  isTogglingYolo = input(false);
  showModelDropdown = input(false);
  currentModel = input<string | undefined>(undefined);
  models = input<ModelDisplayInfo[]>([]);
  canShowFileExplorer = input(false);
  isFileExplorerOpen = input(false);

  // Skills and hooks counts
  activeSkillCount = computed(() => this.skillStore.activeSkillCount());
  enabledHookCount = computed(() => this.hookStore.enabledHookCount());
  showOpenMenu = signal(false);
  editorTargets = signal<EditorMenuItem[]>([]);
  isLoadingEditors = signal(false);
  private hasLoadedEditorTargets = false;

  // Tooltips for badges
  activeSkillsTooltip = computed(() => {
    const skills = this.skillStore.getActiveSkillBundles();
    if (skills.length === 0) return '';
    return 'Active skills:\n' + skills.map(s => `• ${s.metadata.name}`).join('\n');
  });

  enabledHooksTooltip = computed(() => {
    const hooks = this.hookStore.enabledHooks();
    if (hooks.length === 0) return '';
    return 'Enabled hooks:\n' + hooks.map(h => `• ${h.name}`).join('\n');
  });

  constructor() {
    // Focus the name input whenever editing starts
    effect(() => {
      if (this.isEditingName()) {
        const input = this.nameInput()?.nativeElement;
        if (input) {
          input.focus();
          input.select();
        }
      }
    });

    effect(() => {
      if (!this.showOpenMenu()) {
        return;
      }

      void this.ensureEditorTargetsLoaded();
    });
  }

  ngOnInit(): void {
    // Load skills and hooks on init
    this.skillStore.discoverSkills();
    this.hookStore.loadHooks();
  }

  // Actions
  startEditName = output<void>();
  cancelEditName = output<void>();
  saveName = output<string>();
  cycleAgentMode = output<void>();
  toggleYolo = output<void>();
  selectFolder = output<string>();
  interrupt = output<void>();
  restart = output<void>();
  terminate = output<void>();
  createChild = output<void>();
  toggleModelDropdown = output<void>();
  closeModelDropdown = output<void>();
  selectModel = output<string>();
  toggleFileExplorer = output<void>();

  providerDisplayName = computed(() => {
    return this.getProviderDisplayName(this.instance().provider);
  });

  providerColor = computed(() => {
    return this.getProviderColor(this.instance().provider);
  });

  availableModels = computed((): ModelDisplayInfo[] => {
    return this.models();
  });

  currentModelId = computed(() => {
    return this.currentModel() || this.availableModels()[0]?.id || '';
  });

  currentModelDisplayName = computed(() => {
    const modelId = this.currentModelId();
    // First try dynamic models list
    const models = this.availableModels();
    const match = models.find(m => m.id === modelId);
    if (match) return match.name;
    // Fall back to static lookup
    const provider = this.instance().provider;
    return getModelShortName(modelId, provider);
  });

  modelBtnBorderColor = computed(() => {
    const color = this.getProviderColor(this.instance().provider);
    return color + '4D'; // 30% opacity hex
  });

  modelBtnBgColor = computed(() => {
    const color = this.getProviderColor(this.instance().provider);
    return color + '26'; // 15% opacity hex
  });

  agentModeIcon = computed(() => {
    return this.getAgentModeIcon(this.instance().agentId);
  });

  agentModeName = computed(() => {
    return this.getAgentModeName(this.instance().agentId);
  });

  preferredEditorLabel = computed(() => {
    return this.editorTargets()[0]?.label || 'Editor';
  });

  systemFolderLabel = computed(() => {
    switch (this.electronIpc.platform) {
      case 'darwin':
        return 'Finder';
      case 'win32':
        return 'Explorer';
      default:
        return 'File Manager';
    }
  });

  getProviderDisplayName(provider: string): string {
    switch (provider) {
      case 'claude':
        return 'Claude';
      case 'codex':
        return 'Codex';
      case 'gemini':
        return 'Gemini';
      case 'ollama':
        return 'Ollama';
      case 'copilot':
        return 'Copilot';
      default:
        return 'AI';
    }
  }

  getProviderColor(provider: string): string {
    switch (provider) {
      case 'claude':
        return '#D97706';
      case 'codex':
        return '#10A37F';
      case 'gemini':
        return '#4285F4';
      case 'ollama':
        return '#888888';
      case 'copilot':
        return '#A855F7';
      default:
        return '#888888';
    }
  }

  getAgentModeIcon(agentId?: string): string {
    switch (agentId) {
      case 'plan':
        return '🗺️';
      case 'review':
        return '👁️';
      default:
        return '🔨';
    }
  }

  getAgentModeName(agentId?: string): string {
    switch (agentId) {
      case 'plan':
        return 'Plan';
      case 'review':
        return 'Review';
      default:
        return 'Build';
    }
  }

  onSaveName(event: Event): void {
    const input = event.target as HTMLInputElement;
    const newName = input.value.trim();
    if (newName && newName !== this.instance().displayName) {
      this.saveName.emit(newName);
    }
    this.cancelEditName.emit();
  }

  onToggleOpenMenu(event: Event): void {
    event.stopPropagation();
    this.showOpenMenu.update((current) => !current);
  }

  async openInPreferredEditor(): Promise<void> {
    const workingDirectory = this.instance().workingDirectory?.trim();
    if (!workingDirectory) {
      return;
    }

    await this.fileIpc.editorOpenDirectory(workingDirectory);
    this.showOpenMenu.set(false);
  }

  async openInSystemFileManager(): Promise<void> {
    const workingDirectory = this.instance().workingDirectory?.trim();
    if (!workingDirectory) {
      return;
    }

    await this.fileIpc.openPath(workingDirectory);
    this.showOpenMenu.set(false);
  }

  private async ensureEditorTargetsLoaded(): Promise<void> {
    if (this.hasLoadedEditorTargets || this.isLoadingEditors()) {
      return;
    }

    this.isLoadingEditors.set(true);
    try {
      await this.fileIpc.editorDetect();

      const [defaultResponse, availableResponse] = await Promise.all([
        this.fileIpc.editorGetDefault(),
        this.fileIpc.editorGetAvailable(),
      ]);

      const targets: EditorMenuItem[] = [];
      const defaultEditor = this.parseEditorRecord(defaultResponse.data);
      if (defaultEditor?.type) {
        targets.push({
          type: defaultEditor.type,
          label: this.getEditorLabel(defaultEditor.type, defaultEditor.name),
        });
      } else if (Array.isArray(availableResponse.data) && availableResponse.data.length > 0) {
        const firstEditor = this.parseEditorRecord(availableResponse.data[0]);
        if (firstEditor?.type) {
          targets.push({
            type: firstEditor.type,
            label: this.getEditorLabel(firstEditor.type, firstEditor.name),
          });
        }
      }

      this.editorTargets.set(targets);
      this.hasLoadedEditorTargets = true;
    } finally {
      this.isLoadingEditors.set(false);
    }
  }

  private parseEditorRecord(value: unknown): { type: string; name?: string } | null {
    if (!value || typeof value !== 'object') {
      return null;
    }

    const record = value as Record<string, unknown>;
    const type = record['type'];
    if (typeof type !== 'string' || type.length === 0) {
      return null;
    }

    return {
      type,
      name: typeof record['name'] === 'string' ? record['name'] : undefined,
    };
  }

  private getEditorLabel(type: string, name?: string): string {
    if (name) {
      return name;
    }

    switch (type) {
      case 'vscode':
        return 'VS Code';
      case 'vscode-insiders':
        return 'VS Code Insiders';
      case 'cursor':
        return 'Cursor';
      case 'sublime':
        return 'Sublime Text';
      case 'notepad++':
        return 'Notepad++';
      default:
        return type.charAt(0).toUpperCase() + type.slice(1);
    }
  }
}
