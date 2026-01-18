/**
 * Instance Row Component - Single instance in the list
 */

import {
  Component,
  input,
  output,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { Instance, InstanceStatus } from '../../core/state/instance.store';
import { StatusIndicatorComponent } from './status-indicator.component';
import { ContextBarComponent } from '../instance-detail/context-bar.component';

@Component({
  selector: 'app-instance-row',
  standalone: true,
  imports: [StatusIndicatorComponent, ContextBarComponent],
  template: `
    <div
      class="instance-row"
      [class.selected]="isSelected()"
      [class.error]="instance().status === 'error'"
      [class.yolo]="instance().yoloMode"
      (click)="select.emit(instance().id)"
    >
      <app-status-indicator [status]="instance().status" />

      <div class="instance-info">
        <div class="instance-name">{{ instance().displayName }}</div>
        <div class="instance-meta">
          <span class="session-id mono">{{ instance().sessionId.slice(0, 8) }}...</span>
          @if (instance().parentId) {
            <span class="child-indicator" title="Child instance">↳</span>
          }
          @if (instance().childrenIds.length > 0) {
            <span class="children-count">
              {{ instance().childrenIds.length }} children
            </span>
          }
        </div>
      </div>

      <app-context-bar
        [usage]="instance().contextUsage"
        [compact]="true"
      />

      <div class="instance-actions">
        <button
          class="action-btn restart"
          title="Restart instance"
          (click)="onRestart($event)"
          [disabled]="instance().status === 'initializing'"
        >
          ↻
        </button>
        <button
          class="action-btn terminate"
          title="Terminate instance"
          (click)="onTerminate($event)"
        >
          ×
        </button>
      </div>
    </div>
  `,
  styles: [`
    .instance-row {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      gap: 12px;
      cursor: pointer;
      border-bottom: 1px solid var(--border-color);
      transition: background-color var(--transition-fast);
      height: 72px;
    }

    .instance-row:hover {
      background-color: var(--bg-hover);
    }

    .instance-row.selected {
      background-color: var(--bg-selected);
      border-left: 3px solid var(--primary-color);
      padding-left: 13px;
    }

    .instance-row.error {
      background-color: var(--error-bg);
    }

    .instance-row.yolo {
      border-left: 3px solid #f59e0b;
      padding-left: 13px;

      &.selected {
        border-left: 3px solid #f59e0b;
        box-shadow: inset 3px 0 0 var(--primary-color);
      }
    }

    .instance-info {
      flex: 1;
      min-width: 0;
    }

    .instance-name {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      color: var(--text-primary);
    }

    .instance-meta {
      display: flex;
      gap: 8px;
      font-size: 12px;
      color: var(--text-secondary);
      margin-top: 4px;
    }

    .session-id {
      color: var(--text-muted);
    }

    .child-indicator {
      color: var(--primary-color);
    }

    .children-count {
      color: var(--text-muted);
    }

    .instance-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity var(--transition-fast);
    }

    .instance-row:hover .instance-actions {
      opacity: 1;
    }

    .action-btn {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      transition: background-color var(--transition-fast);
    }

    .action-btn.restart {
      background: var(--bg-tertiary);
      color: var(--text-primary);

      &:hover:not(:disabled) {
        background: var(--bg-hover);
      }
    }

    .action-btn.terminate {
      background: var(--error-bg);
      color: var(--error-color);

      &:hover:not(:disabled) {
        background: var(--error-color);
        color: white;
      }
    }

    .action-btn:disabled {
      opacity: 0.3;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstanceRowComponent {
  instance = input.required<Instance>();
  isSelected = input<boolean>(false);

  select = output<string>();
  terminate = output<string>();
  restart = output<string>();

  onTerminate(event: Event): void {
    event.stopPropagation();
    this.terminate.emit(this.instance().id);
  }

  onRestart(event: Event): void {
    event.stopPropagation();
    this.restart.emit(this.instance().id);
  }
}
