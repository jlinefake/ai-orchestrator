/**
 * Instance List Component - Virtual scrolling list of all instances
 */

import {
  Component,
  inject,
  signal,
  computed,
  ChangeDetectionStrategy,
} from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { InstanceStore, Instance } from '../../core/state/instance.store';
import { InstanceRowComponent } from './instance-row.component';

@Component({
  selector: 'app-instance-list',
  standalone: true,
  imports: [ScrollingModule, InstanceRowComponent],
  template: `
    <div class="instance-list-container">
      <!-- Filter bar -->
      <div class="filter-bar">
        <input
          type="text"
          class="filter-input"
          placeholder="Filter instances..."
          [value]="filterText()"
          (input)="onFilterChange($event)"
        />
        <select
          class="status-filter"
          [value]="statusFilter()"
          (change)="onStatusFilterChange($event)"
        >
          <option value="all">All</option>
          <option value="idle">Idle</option>
          <option value="busy">Busy</option>
          <option value="waiting_for_input">Waiting</option>
          <option value="error">Error</option>
        </select>
      </div>

      <!-- Instance list with virtual scroll -->
      <cdk-virtual-scroll-viewport
        itemSize="72"
        class="instance-viewport"
      >
        @for (instance of filteredInstances(); track instance.id) {
          <app-instance-row
            [instance]="instance"
            [isSelected]="selectedId() === instance.id"
            (select)="onSelectInstance($event)"
            (terminate)="onTerminateInstance($event)"
            (restart)="onRestartInstance($event)"
          />
        } @empty {
          <div class="empty-state">
            @if (filterText() || statusFilter() !== 'all') {
              <p>No instances match your filters</p>
            } @else {
              <p>No instances yet</p>
              <p class="hint">Create one to get started</p>
            }
          </div>
        }
      </cdk-virtual-scroll-viewport>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
    }

    /* Fix horizontal scrollbar from CDK virtual scroll */
    :host ::ng-deep .cdk-virtual-scroll-content-wrapper {
      position: relative;
    }

    .instance-list-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .filter-bar {
      display: flex;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) var(--spacing-md);
      border-bottom: 1px solid var(--border-color);
    }

    .filter-input {
      flex: 1;
      min-width: 0;
      padding: var(--spacing-xs) var(--spacing-sm);
      font-size: 13px;
    }

    .status-filter {
      padding: var(--spacing-xs) var(--spacing-sm);
      font-size: 13px;
      min-width: 80px;
    }

    .instance-viewport {
      flex: 1;
      width: 100%;
      min-height: 200px;
      height: 100%;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 200px;
      color: var(--text-secondary);
      text-align: center;
      padding: var(--spacing-md);
    }

    .empty-state .hint {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: var(--spacing-xs);
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstanceListComponent {
  private store = inject(InstanceStore);

  // Local UI state
  filterText = signal('');
  statusFilter = signal<string>('all');

  // Selected instance ID from store
  selectedId = this.store.selectedInstanceId;

  // Filtered instances
  filteredInstances = computed(() => {
    const instances = this.store.instances();
    const filter = this.filterText().toLowerCase();
    const status = this.statusFilter();

    return instances.filter((instance) => {
      const matchesText =
        !filter ||
        instance.displayName.toLowerCase().includes(filter) ||
        instance.id.includes(filter);

      const matchesStatus =
        status === 'all' || instance.status === status;

      return matchesText && matchesStatus;
    });
  });

  onFilterChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.filterText.set(input.value);
  }

  onStatusFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.statusFilter.set(select.value);
  }

  onSelectInstance(instanceId: string): void {
    this.store.setSelectedInstance(instanceId);
  }

  onTerminateInstance(instanceId: string): void {
    this.store.terminateInstance(instanceId);
  }

  onRestartInstance(instanceId: string): void {
    this.store.restartInstance(instanceId);
  }

  trackInstance(index: number, instance: Instance): string {
    return instance.id;
  }
}
