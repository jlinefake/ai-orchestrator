/**
 * Instance List Component - Hierarchical tree view with collapsible children
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

/** Instance with hierarchy metadata for display */
export interface HierarchicalInstance {
  instance: Instance;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isLastChild: boolean;
  parentChain: boolean[]; // Track which ancestor levels need connecting lines
}

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
        @for (item of hierarchicalInstances(); track item.instance.id) {
          <app-instance-row
            [instance]="item.instance"
            [depth]="item.depth"
            [hasChildren]="item.hasChildren"
            [isExpanded]="item.isExpanded"
            [isLastChild]="item.isLastChild"
            [parentChain]="item.parentChain"
            [isSelected]="selectedId() === item.instance.id"
            (select)="onSelectInstance($event)"
            (terminate)="onTerminateInstance($event)"
            (restart)="onRestartInstance($event)"
            (toggleExpand)="onToggleExpand($event)"
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

  // Track which parent instances are COLLAPSED (default: all expanded)
  // Using collapsed set means new parents are automatically expanded
  collapsedIds = signal<Set<string>>(new Set());

  // Selected instance ID from store
  selectedId = this.store.selectedInstanceId;

  // Build hierarchical view of instances
  hierarchicalInstances = computed(() => {
    const instances = this.store.instances();
    const filter = this.filterText().toLowerCase();
    const status = this.statusFilter();
    const collapsed = this.collapsedIds();

    // Build instance map for quick lookup
    const instanceMap = new Map<string, Instance>();
    for (const instance of instances) {
      instanceMap.set(instance.id, instance);
    }

    // Build children map dynamically from parentId relationships
    // This is more reliable than using childrenIds which may be stale in the renderer
    const childrenByParent = new Map<string, string[]>();
    for (const instance of instances) {
      if (instance.parentId) {
        const siblings = childrenByParent.get(instance.parentId) || [];
        siblings.push(instance.id);
        childrenByParent.set(instance.parentId, siblings);
      }
    }

    // Helper to get children for an instance
    const getChildrenIds = (instanceId: string): string[] => {
      return childrenByParent.get(instanceId) || [];
    };

    // Filter instances
    const matchesFilter = (instance: Instance): boolean => {
      const matchesText =
        !filter ||
        instance.displayName.toLowerCase().includes(filter) ||
        instance.id.includes(filter);

      const matchesStatus =
        status === 'all' || instance.status === status;

      return matchesText && matchesStatus;
    };

    // Get root instances (no parent)
    const rootInstances = instances.filter(i => !i.parentId);

    // Recursively build flat list with hierarchy info
    const result: HierarchicalInstance[] = [];

    const addInstance = (
      instance: Instance,
      depth: number,
      parentChain: boolean[],
      isLastChild: boolean
    ) => {
      const childrenIds = getChildrenIds(instance.id);

      // Check if this instance or any of its descendants match the filter
      const selfMatches = matchesFilter(instance);
      const childrenMatch = childrenIds.some(childId => {
        const child = instanceMap.get(childId);
        return child && matchesFilter(child);
      });

      if (!selfMatches && !childrenMatch) return;

      const hasChildren = childrenIds.length > 0;
      const isExpanded = !collapsed.has(instance.id); // Not in collapsed set = expanded

      result.push({
        instance: {
          ...instance,
          childrenIds, // Use the dynamically computed childrenIds
        },
        depth,
        hasChildren,
        isExpanded,
        isLastChild,
        parentChain: [...parentChain],
      });

      // Add children if expanded
      if (hasChildren && isExpanded) {
        const children = childrenIds
          .map(id => instanceMap.get(id))
          .filter((c): c is Instance => c !== undefined)
          .sort((a, b) => a.createdAt - b.createdAt);

        children.forEach((child, index) => {
          const isLast = index === children.length - 1;
          addInstance(
            child,
            depth + 1,
            [...parentChain, !isLastChild],
            isLast
          );
        });
      }
    };

    // Sort root instances by creation time
    rootInstances
      .sort((a, b) => a.createdAt - b.createdAt)
      .forEach((instance, index) => {
        addInstance(instance, 0, [], index === rootInstances.length - 1);
      });

    return result;
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

  onToggleExpand(instanceId: string): void {
    this.collapsedIds.update(current => {
      const newSet = new Set(current);
      if (newSet.has(instanceId)) {
        // Was collapsed, now expand (remove from collapsed set)
        newSet.delete(instanceId);
      } else {
        // Was expanded, now collapse (add to collapsed set)
        newSet.add(instanceId);
      }
      return newSet;
    });
  }

  trackInstance(index: number, item: HierarchicalInstance): string {
    return item.instance.id;
  }
}
