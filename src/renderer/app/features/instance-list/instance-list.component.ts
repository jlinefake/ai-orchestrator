/**
 * Instance List Component - Project-grouped session rail
 */

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { InstanceStore, type Instance } from '../../core/state/instance.store';
import { HistoryStore } from '../../core/state/history.store';
import { RecentDirectoriesIpcService } from '../../core/services/ipc/recent-directories-ipc.service';
import { FileIpcService } from '../../core/services/ipc/file-ipc.service';
import { InstanceRowComponent } from './instance-row.component';
import {
  getConversationHistoryTitle,
  type ConversationHistoryEntry,
} from '../../../../shared/types/history.types';
import type { RecentDirectoryEntry } from '../../../../shared/types/recent-directories.types';

const ORDER_STORAGE_KEY = 'instance-list-order';
const PINNED_HISTORY_STORAGE_KEY = 'instance-list-pinned-history';
const SORT_MODE_STORAGE_KEY = 'instance-list-sort-mode';
const NO_WORKSPACE_KEY = '__no_workspace__';
type HistorySortMode = 'last-interacted' | 'created';

export interface HierarchicalInstance {
  instance: Instance;
  railTitle: string;
  depth: number;
  hasChildren: boolean;
  isExpanded: boolean;
  isLastChild: boolean;
  parentChain: boolean[];
}

interface ProjectGroup {
  key: string;
  path: string | null;
  title: string;
  subtitle: string;
  createdAt: number;
  sessionCount: number;
  busyCount: number;
  hasSelectedInstance: boolean;
  isExpanded: boolean;
  isPinned: boolean;
  lastActivity: number;
  liveItems: HierarchicalInstance[];
  historyItems: ConversationHistoryEntry[];
}

@Component({
  selector: 'app-instance-list',
  standalone: true,
  imports: [ScrollingModule, InstanceRowComponent, DragDropModule],
  template: `
    <div class="instance-list-container">
      <div class="list-header">
        <div>
          <p class="list-eyebrow">Project index</p>
          <h2 class="list-title">Projects</h2>
        </div>
        <span class="list-count">{{ projectGroups().length }}</span>
      </div>

      <div class="filter-bar">
        <input
          type="text"
          class="filter-input"
          placeholder="Filter projects or sessions..."
          [value]="filterText()"
          (input)="onFilterChange($event)"
        />
        <div class="filter-controls">
          <label class="filter-select-group">
            <span class="filter-select-label">Sort</span>
            <select
              class="sort-filter"
              [value]="historySortMode()"
              (change)="onSortModeChange($event)"
              title="Sort project threads"
            >
              <option value="last-interacted">Last interacted</option>
              <option value="created">Created</option>
            </select>
          </label>
          <label class="filter-select-group">
            <span class="filter-select-label">State</span>
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
          </label>
        </div>
      </div>

      <div class="instance-viewport">
        @for (group of projectGroups(); track group.key) {
          <section class="project-group" [class.selected]="group.hasSelectedInstance">
            <div class="project-header-row" [class.expanded]="group.isExpanded">
              <button
                type="button"
                class="project-header"
                [class.expanded]="group.isExpanded"
                [attr.aria-expanded]="group.isExpanded"
                [attr.aria-controls]="'project-group-' + group.key"
                (click)="toggleProjectGroup(group.key)"
              >
                <div class="project-copy">
                  <div class="project-title-row">
                    <span class="project-icon" aria-hidden="true">
                      <svg viewBox="0 0 16 16">
                        <path d="M1.5 3.5a1 1 0 0 1 1-1H6l1.1 1.4c.2.3.6.4.9.4h5.5a1 1 0 0 1 1 1v6.7a1.8 1.8 0 0 1-1.8 1.8H3.3A1.8 1.8 0 0 1 1.5 12V3.5Zm1 1v7.5c0 .4.3.8.8.8h9.4c.4 0 .8-.4.8-.8V5.5H7.9c-.6 0-1.2-.3-1.5-.8L5.5 3.5H2.5Z" />
                      </svg>
                    </span>
                    <span class="project-title">{{ group.title }}</span>
                    @if (group.hasSelectedInstance) {
                      <span class="project-selected-pill">Current</span>
                    }
                  </div>
                  <span class="project-subtitle" [title]="group.subtitle">{{ group.subtitle }}</span>
                </div>
                <div class="project-meta">
                  @if (group.busyCount > 0) {
                    <span class="project-state project-state-busy">{{ group.busyCount }} busy</span>
                  }
                  <span class="project-state">{{ group.sessionCount }} sessions</span>
                </div>
              </button>
              <div class="project-actions" [class.visible]="openProjectMenuKey() === group.key">
                <button
                  type="button"
                  class="project-action-btn"
                  [class.active]="group.isPinned"
                  [attr.aria-label]="group.isPinned ? 'Unpin project' : 'Pin project'"
                  [title]="group.isPinned ? 'Unpin project' : 'Pin project'"
                  (click)="toggleProjectPinned(group, $event)"
                >
                  <svg viewBox="0 0 16 16" aria-hidden="true">
                    <path d="M10.9 1.8c.3 0 .6.1.8.3l2.2 2.2c.4.4.4 1 0 1.4l-1.5 1.5.5 3.9c0 .3-.1.6-.3.8l-1.1 1.1c-.2.2-.5.2-.8.1l-3.2-1.6-2.9 2.9-.7-.7 2.9-2.9-1.6-3.2c-.1-.3-.1-.6.1-.8L6.4 5c.2-.2.5-.3.8-.3l3.9.5 1.5-1.5c.1-.1.2-.2.2-.4 0-.1-.1-.3-.2-.4L10.4 2c-.1-.1-.3-.2-.4-.2-.1 0-.3.1-.4.2L8.1 3.5l.7.7-1.4 1.4-.7-.7L5.2 6.4l1.6 3.2 4-4-.7-.7 1.4-1.4.7.7 1.5-1.5c.3-.3.3-.9 0-1.2l-2.2-2.2c-.2-.2-.5-.3-.8-.3Z" />
                  </svg>
                </button>
                @if (group.path) {
                  <div class="project-menu-anchor">
                    <button
                      type="button"
                      class="project-action-btn"
                      [class.active]="openProjectMenuKey() === group.key"
                      aria-haspopup="menu"
                      [attr.aria-expanded]="openProjectMenuKey() === group.key"
                      aria-label="Open project actions"
                      title="Open project actions"
                      (click)="toggleProjectMenu(group.key, $event)"
                    >
                      <svg viewBox="0 0 16 16" aria-hidden="true">
                        <path d="M1.5 3.5a1 1 0 0 1 1-1H6l1.1 1.4c.2.3.6.4.9.4h5.5a1 1 0 0 1 1 1v6.7a1.8 1.8 0 0 1-1.8 1.8H3.3A1.8 1.8 0 0 1 1.5 12V3.5Zm1 1v7.5c0 .4.3.8.8.8h9.4c.4 0 .8-.4.8-.8V5.5H7.9c-.6 0-1.2-.3-1.5-.8L5.5 3.5H2.5Z" />
                      </svg>
                    </button>
                    @if (openProjectMenuKey() === group.key) {
                      <div class="project-menu" role="menu">
                        <button
                          type="button"
                          class="project-menu-item"
                          role="menuitem"
                          (click)="openProjectInPreferredEditor(group, $event)"
                        >
                          Open in {{ preferredEditorLabel() }}
                        </button>
                        <button
                          type="button"
                          class="project-menu-item"
                          role="menuitem"
                          (click)="openProjectInSystemFileManager(group, $event)"
                        >
                          Open in {{ systemFileManagerLabel }}
                        </button>
                      </div>
                    }
                  </div>
                }
                <span class="project-chevron" aria-hidden="true">›</span>
              </div>
            </div>

            @if (group.isExpanded) {
              <div class="project-items" [id]="'project-group-' + group.key">
                @if (group.liveItems.length > 0) {
                  <div
                    class="project-live-items"
                    cdkDropList
                    [cdkDropListData]="group.liveItems"
                    (cdkDropListDropped)="onDrop($event, group)"
                  >
                    @for (item of group.liveItems; track item.instance.id) {
                      <div
                        class="drag-wrapper"
                        [class.is-root]="item.depth === 0"
                        [cdkDragDisabled]="item.depth > 0 || isDragDisabled()"
                        cdkDrag
                        [cdkDragData]="item"
                      >
                        <div class="drag-preview" *cdkDragPreview>
                          <span class="drag-preview-name">{{ item.railTitle }}</span>
                          @if (item.hasChildren) {
                            <span class="drag-preview-children">+{{ item.instance.childrenIds.length }}</span>
                          }
                        </div>
                        <div class="drag-placeholder" *cdkDragPlaceholder></div>

                        <app-instance-row
                          [instance]="item.instance"
                          [displayTitle]="item.railTitle"
                          [depth]="item.depth"
                          [hasChildren]="item.hasChildren"
                          [isExpanded]="item.isExpanded"
                          [isLastChild]="item.isLastChild"
                          [parentChain]="item.parentChain"
                          [isSelected]="selectedId() === item.instance.id"
                          [isDraggable]="item.depth === 0"
                          (instanceSelect)="onSelectInstance($event)"
                          (terminate)="onTerminateInstance($event)"
                          (restart)="onRestartInstance($event)"
                          (toggleExpand)="onToggleExpand($event)"
                        />
                      </div>
                    }
                  </div>
                }

                @if (group.historyItems.length > 0) {
                  <div
                    class="project-history-items"
                    [class.with-divider]="group.liveItems.length > 0"
                  >
                    @for (entry of group.historyItems; track entry.id) {
                      <div
                        class="history-entry"
                        [class.pinned]="isPinnedHistory(entry.id)"
                        [class.restoring]="isRestoringHistory(entry.id)"
                      >
                        <div class="history-entry-copy">
                          <button
                            type="button"
                            class="history-entry-pin"
                            [class.active]="isPinnedHistory(entry.id)"
                            [attr.aria-label]="isPinnedHistory(entry.id) ? 'Unpin thread' : 'Pin thread'"
                            [title]="isPinnedHistory(entry.id) ? 'Unpin thread' : 'Pin thread'"
                            (click)="togglePinnedHistory(entry.id, $event)"
                          >
                            <svg viewBox="0 0 16 16" aria-hidden="true">
                              <path d="M10.9 1.8c.3 0 .6.1.8.3l2.2 2.2c.4.4.4 1 0 1.4l-1.5 1.5.5 3.9c0 .3-.1.6-.3.8l-1.1 1.1c-.2.2-.5.2-.8.1l-3.2-1.6-2.9 2.9-.7-.7 2.9-2.9-1.6-3.2c-.1-.3-.1-.6.1-.8L6.4 5c.2-.2.5-.3.8-.3l3.9.5 1.5-1.5c.1-.1.2-.2.2-.4 0-.1-.1-.3-.2-.4L10.4 2c-.1-.1-.3-.2-.4-.2-.1 0-.3.1-.4.2L8.1 3.5l.7.7-1.4 1.4-.7-.7L5.2 6.4l1.6 3.2 4-4-.7-.7 1.4-1.4.7.7 1.5-1.5c.3-.3.3-.9 0-1.2l-2.2-2.2c-.2-.2-.5-.3-.8-.3Z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            class="history-entry-main"
                            [disabled]="isRestoringHistory(entry.id)"
                            [attr.aria-label]="'Restore ' + getHistoryTitle(entry)"
                            (click)="onRestoreHistory(entry.id)"
                          >
                            <span class="history-entry-title">
                              {{ getHistoryPreviewTitle(entry) }}
                            </span>
                          </button>
                        </div>
                        <div class="history-entry-meta">
                          <span
                            class="history-entry-time"
                            [title]="historySortMode() === 'created' ? 'Created' : 'Last interacted'"
                          >
                            {{ formatHistoryTime(entry) }}
                          </span>
                          <button
                            type="button"
                            class="history-entry-action"
                            aria-label="Archive thread"
                            title="Archive thread"
                            (click)="onArchiveHistory(entry.id, $event)"
                          >
                            <svg viewBox="0 0 16 16" aria-hidden="true">
                              <path d="M2.5 2.5h11a1 1 0 0 1 1 1v2.1a1 1 0 0 1-.29.7l-1.56 1.56a1 1 0 0 0-.29.7V13a1 1 0 0 1-1 1h-6.7a1 1 0 0 1-1-1V8.56a1 1 0 0 0-.29-.7L1.79 6.3a1 1 0 0 1-.29-.7V3.5a1 1 0 0 1 1-1Zm0 1v1.7l1.56 1.56c.38.37.59.88.59 1.4V13h6.7V8.16c0-.52.21-1.03.59-1.4L13.5 5.2V3.5h-11Zm3.1 2.9h4.8v1h-4.8v-1Z" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    }
                  </div>
                }

                @if (group.liveItems.length === 0 && group.historyItems.length === 0) {
                  <div class="project-empty">No threads yet</div>
                }
              </div>
            }
          </section>
        } @empty {
          <div class="empty-state">
            @if (filterText() || statusFilter() !== 'all') {
              <p>No projects match your filters</p>
            } @else {
              <p>No projects yet</p>
              <p class="hint">Create a session to start building a workspace index</p>
            }
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
    }

    .instance-list-container {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
    }

    .list-header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: var(--spacing-md);
      padding: 12px 16px 8px;
    }

    .list-eyebrow {
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--text-muted);
      margin-bottom: 6px;
    }

    .list-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-primary);
    }

    .list-count {
      min-width: 24px;
      padding: 4px 8px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.05);
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--text-secondary);
      text-align: center;
    }

    .filter-bar {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 0 16px 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }

    .filter-controls {
      display: grid;
      grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr);
      gap: 8px;
    }

    .filter-select-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }

    .filter-select-label {
      font-family: var(--font-mono);
      font-size: 9px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
    }

    .filter-input,
    .sort-filter,
    .status-filter {
      font-family: var(--font-mono);
      font-size: 12px;
      letter-spacing: 0.02em;
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 14px;
      color: var(--text-primary);
      transition: all var(--transition-fast);
    }

    .filter-input {
      padding: 8px 10px;

      &::placeholder {
        color: var(--text-muted);
      }
    }

    .sort-filter,
    .status-filter {
      width: 100%;
      min-width: 0;
      padding: 8px 10px;
      cursor: pointer;
    }

    .filter-input:focus,
    .status-filter:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(var(--primary-rgb), 0.12);
    }

    .instance-viewport {
      flex: 1;
      width: 100%;
      min-height: 200px;
      overflow-y: auto;
      padding: 8px 0 14px;
      display: flex;
      flex-direction: column;
      gap: 0;
    }

    .instance-viewport::-webkit-scrollbar {
      width: 6px;
    }

    .instance-viewport::-webkit-scrollbar-track {
      background: transparent;
    }

    .instance-viewport::-webkit-scrollbar-thumb {
      background: var(--border-color);
      border-radius: 3px;
    }

    .project-group {
      padding: 0 10px 6px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      transition: background var(--transition-fast);
      position: relative;
    }

    .project-group.selected {
      background: rgba(var(--primary-rgb), 0.03);
    }

    .project-header {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 6px 8px;
      background: transparent;
      border: none;
      color: inherit;
      cursor: pointer;
      text-align: left;
      transition: background var(--transition-fast);
    }

    .project-header:hover {
      background: transparent;
    }

    .project-header-row {
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }

    .project-copy {
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .project-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }

    .project-icon {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 14px;
      height: 14px;
      color: rgba(214, 221, 208, 0.76);
      flex-shrink: 0;
    }

    .project-icon svg {
      width: 14px;
      height: 14px;
      fill: currentColor;
    }

    .project-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .project-selected-pill {
      padding: 1px 6px;
      border-radius: 999px;
      background: rgba(var(--secondary-rgb), 0.12);
      color: var(--secondary-color);
      font-family: var(--font-mono);
      font-size: 8px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      flex-shrink: 0;
    }

    .project-subtitle {
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.02em;
      color: rgba(168, 176, 164, 0.8);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .project-meta {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }

    .project-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      opacity: 0;
      transition: opacity var(--transition-fast);
      position: relative;
    }

    .project-header-row:hover .project-actions,
    .project-header-row:focus-within .project-actions,
    .project-actions.visible {
      opacity: 1;
    }

    .project-action-btn {
      width: 24px;
      height: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(255, 255, 255, 0.02);
      color: var(--text-muted);
      cursor: pointer;
      transition: all var(--transition-fast);
      flex-shrink: 0;
    }

    .project-action-btn:hover,
    .project-action-btn.active {
      color: var(--text-primary);
      border-color: rgba(var(--primary-rgb), 0.2);
      background: rgba(var(--primary-rgb), 0.1);
    }

    .project-action-btn svg {
      width: 12px;
      height: 12px;
      fill: currentColor;
    }

    .project-menu-anchor {
      position: relative;
    }

    .project-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      min-width: 172px;
      display: flex;
      flex-direction: column;
      padding: 6px;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(12, 18, 17, 0.96);
      box-shadow: 0 18px 40px rgba(0, 0, 0, 0.34);
      z-index: 10;
    }

    .project-menu-item {
      width: 100%;
      padding: 8px 10px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--text-secondary);
      font-size: 12px;
      text-align: left;
      cursor: pointer;
      transition: background var(--transition-fast), color var(--transition-fast);
    }

    .project-menu-item:hover {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-primary);
    }

    .project-state {
      padding: 0;
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.02em;
      text-transform: uppercase;
    }

    .project-state-busy {
      color: var(--secondary-color);
    }

    .project-empty {
      padding: 2px 0 6px 8px;
      font-family: var(--font-mono);
      font-size: 10px;
      letter-spacing: 0.04em;
      color: var(--text-muted);
      opacity: 0.72;
      text-transform: uppercase;
    }

    .project-chevron {
      font-size: 14px;
      color: var(--text-muted);
      transition: transform var(--transition-fast);
      padding-top: 3px;
    }

    .project-header-row.expanded .project-chevron {
      transform: rotate(90deg);
    }

    .project-items {
      padding: 0 0 6px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .project-live-items {
      display: flex;
      flex-direction: column;
      gap: 1px;
    }

    .project-history-items {
      display: flex;
      flex-direction: column;
      gap: 1px;
      padding: 4px 0 4px 8px;
    }

    .project-history-items.with-divider {
      margin-top: 2px;
      padding-top: 4px;
      border-top: 1px solid rgba(255, 255, 255, 0.035);
    }

    .history-entry {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      width: 100%;
      min-height: 30px;
      padding: 5px 4px;
      background: transparent;
      border-radius: 8px;
      color: inherit;
      transition: background var(--transition-fast), color var(--transition-fast);
    }

    .history-entry.pinned {
      background: rgba(255, 255, 255, 0.035);
    }

    .history-entry:hover:not(.restoring) {
      background: rgba(255, 255, 255, 0.025);
    }

    .history-entry.restoring {
      opacity: 0.55;
      cursor: progress;
    }

    .history-entry-copy {
      display: flex;
      align-items: center;
      gap: 0;
      min-width: 0;
    }

    .history-entry-pin {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 0;
      height: 14px;
      padding: 0;
      margin-right: 0;
      border: none;
      border-radius: 999px;
      background: transparent;
      color: var(--text-muted);
      opacity: 0;
      overflow: hidden;
      cursor: pointer;
      transition:
        width var(--transition-fast),
        margin-right var(--transition-fast),
        opacity var(--transition-fast),
        color var(--transition-fast),
        background var(--transition-fast);
      flex-shrink: 0;
    }

    .history-entry:hover .history-entry-pin,
    .history-entry-pin.active {
      width: 14px;
      margin-right: 4px;
      opacity: 1;
    }

    .history-entry-pin:hover {
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-primary);
    }

    .history-entry-pin.active {
      color: var(--primary-color);
    }

    .history-entry-pin svg {
      width: 10px;
      height: 10px;
      fill: currentColor;
      transform: rotate(-28deg);
    }

    .history-entry-title {
      display: block;
      font-family: var(--font-body);
      font-size: 13px;
      font-weight: 500;
      line-height: 1.35;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    .history-entry-meta {
      display: flex;
      align-items: center;
      gap: 4px;
      flex-shrink: 0;
    }

    .history-entry-main {
      width: 100%;
      min-width: 0;
      padding: 0;
      border: none;
      background: transparent;
      color: inherit;
      text-align: left;
      cursor: pointer;
      border-radius: 6px;
      transition: color var(--transition-fast);
    }

    .history-entry-main:focus-visible {
      outline: none;
      box-shadow: inset 0 0 0 1px rgba(var(--primary-rgb), 0.2);
    }

    .history-entry-main:disabled {
      cursor: progress;
    }

    .history-entry-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 0;
      height: 16px;
      padding: 0;
      border: none;
      border-radius: 999px;
      background: transparent;
      color: var(--text-muted);
      opacity: 0;
      overflow: hidden;
      cursor: pointer;
      transition:
        width var(--transition-fast),
        opacity var(--transition-fast),
        color var(--transition-fast),
        background var(--transition-fast);
    }

    .history-entry:hover .history-entry-action,
    .history-entry:focus-within .history-entry-action {
      width: 16px;
      opacity: 1;
    }

    .history-entry-action:hover {
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-primary);
    }

    .history-entry-action svg {
      width: 11px;
      height: 11px;
      fill: currentColor;
    }

    .history-entry-time {
      font-family: var(--font-body);
      font-size: 10px;
      font-weight: 500;
      letter-spacing: 0;
      text-transform: uppercase;
      color: rgba(168, 176, 164, 0.78);
    }

    .drag-wrapper {
      transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
    }

    .drag-wrapper.cdk-drag-dragging {
      opacity: 0.4;
    }

    .drag-placeholder {
      background: rgba(var(--primary-rgb), 0.06);
      border: 1px dashed rgba(var(--primary-rgb), 0.22);
      border-radius: 10px;
      height: 38px;
      margin: 2px 0;
    }

    .drag-preview {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 14px 18px;
      background: var(--bg-secondary);
      border: 1px solid var(--primary-color);
      border-radius: var(--radius-md);
      box-shadow:
        0 8px 24px rgba(0, 0, 0, 0.3),
        0 0 0 1px rgba(var(--primary-rgb), 0.2);
      font-family: var(--font-display);
      font-weight: 600;
      font-size: 13px;
      color: var(--text-primary);
    }

    .drag-preview-name {
      max-width: 180px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .drag-preview-children {
      background: rgba(var(--primary-rgb), 0.18);
      color: var(--primary-color);
      font-family: var(--font-mono);
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 10px;
      letter-spacing: 0.02em;
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 180px;
      color: var(--text-muted);
      text-align: center;
      padding: var(--spacing-xl);
    }

    .empty-state p {
      font-family: var(--font-display);
      font-size: 14px;
      margin: 0;
    }

    .empty-state .hint {
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--text-muted);
      margin-top: var(--spacing-sm);
      opacity: 0.7;
      letter-spacing: 0.03em;
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class InstanceListComponent {
  private store = inject(InstanceStore);
  private historyStore = inject(HistoryStore);
  private recentDirectoriesService = inject(RecentDirectoriesIpcService);
  private fileIpc = inject(FileIpcService);

  filterText = signal('');
  statusFilter = signal<string>('all');
  collapsedIds = signal<Set<string>>(new Set());
  collapsedProjectKeys = signal<Set<string>>(new Set());
  rootInstanceOrder = signal<string[]>(this.loadOrder());
  pinnedHistoryIds = signal<Set<string>>(this.loadPinnedHistoryIds());
  restoringHistoryIds = signal<Set<string>>(new Set());
  recentDirectories = signal<RecentDirectoryEntry[]>([]);
  historySortMode = signal<HistorySortMode>(this.loadSortMode());
  openProjectMenuKey = signal<string | null>(null);
  preferredEditorLabel = signal('Editor');
  selectedId = this.store.selectedInstanceId;
  readonly systemFileManagerLabel = this.getSystemFileManagerLabel();

  isDragDisabled = computed(() =>
    this.filterText().length > 0 || this.statusFilter() !== 'all'
  );

  projectGroups = computed(() => {
    const instances = this.store.instances();
    const historyEntries = this.historyStore.entries().filter((entry) => !entry.archivedAt);
    const recentDirectories = this.recentDirectories();
    const filter = this.filterText().trim().toLowerCase();
    const status = this.statusFilter();
    const childrenByParent = this.buildChildrenMap(instances);
    const instanceMap = new Map(instances.map((instance) => [instance.id, instance]));
    const selectedId = this.selectedId();
    const collapsed = this.collapsedIds();
    const collapsedProjects = this.collapsedProjectKeys();
    const historyByProject = this.buildHistoryEntriesByProject(historyEntries, filter, status);
    const recentDirectoriesByKey = new Map(
      recentDirectories.map((entry) => [this.getProjectKey(entry.path), entry])
    );
    const groups = new Map<string, ProjectGroup>();

    for (const root of this.getOrderedRootInstances(instances)) {
      const projectKey = this.getProjectKey(root.workingDirectory);
      const title = this.getProjectTitle(root.workingDirectory);
      const subtitle = this.getProjectSubtitle(root.workingDirectory);
      const projectMatches = !!filter && this.matchesProjectText(title, subtitle, filter);
      const rawHistoryItems = historyByProject.get(projectKey) ?? [];
      const historyBySessionId = new Map(
        rawHistoryItems.map((entry) => [entry.sessionId, entry])
      );
      const liveItems = this.buildVisibleItems(
        root,
        {
          filter,
          status,
          projectMatches,
          collapsed,
          childrenByParent,
          instanceMap,
        },
        0,
        [],
        true
      ).map((item) => ({
        ...item,
        railTitle: this.getLiveRailTitle(
          item.instance,
          historyBySessionId.get(item.instance.sessionId)
        ),
      }));
      const liveSessionIds = new Set(
        liveItems
          .map((item) => item.instance.sessionId)
          .filter((sessionId): sessionId is string => sessionId.trim().length > 0)
      );
      const historyItems = rawHistoryItems.filter((entry) => !liveSessionIds.has(entry.sessionId));

      if (liveItems.length === 0 && historyItems.length === 0) {
        continue;
      }

      const recentDirectory = recentDirectoriesByKey.get(projectKey);
      const group = groups.get(projectKey) ?? {
        key: projectKey,
        path: root.workingDirectory?.trim() || null,
        title: recentDirectory?.displayName || title,
        subtitle: recentDirectory ? this.getProjectSubtitle(recentDirectory.path) : subtitle,
        createdAt: recentDirectory?.lastAccessed ?? root.createdAt,
        sessionCount: 0,
        busyCount: 0,
        hasSelectedInstance: false,
        isExpanded: !collapsedProjects.has(projectKey),
        isPinned: recentDirectory?.isPinned ?? false,
        lastActivity: recentDirectory?.lastAccessed ?? root.lastActivity ?? root.createdAt,
        liveItems: [],
        historyItems: [],
      };

      group.liveItems.push(...liveItems);
      group.createdAt = Math.max(
        group.createdAt,
        root.createdAt,
        ...rawHistoryItems.map((item) => item.createdAt)
      );
      group.sessionCount += this.countSessionsInTree(root, childrenByParent, instanceMap);
      group.busyCount += this.countBusySessions(root, childrenByParent, instanceMap);
      group.hasSelectedInstance = group.hasSelectedInstance || liveItems.some((item) => item.instance.id === selectedId);
      group.isExpanded = !collapsedProjects.has(projectKey);
      group.historyItems = historyItems;
      group.sessionCount += historyItems.length;
      groups.set(projectKey, group);
      historyByProject.delete(projectKey);
      recentDirectoriesByKey.delete(projectKey);
    }

    for (const [projectKey, historyItems] of historyByProject) {
      if (historyItems.length === 0) {
        continue;
      }

      const recentDirectory = recentDirectoriesByKey.get(projectKey);
      groups.set(projectKey, {
        key: projectKey,
        path: recentDirectory?.path || historyItems[0].workingDirectory || null,
        title: recentDirectory?.displayName || this.getProjectTitle(historyItems[0].workingDirectory),
        subtitle: recentDirectory ? this.getProjectSubtitle(recentDirectory.path) : this.getProjectSubtitle(historyItems[0].workingDirectory),
        createdAt: Math.max(
          recentDirectory?.lastAccessed ?? 0,
          ...historyItems.map((item) => item.createdAt)
        ),
        sessionCount: historyItems.length,
        busyCount: 0,
        hasSelectedInstance: false,
        isExpanded: !collapsedProjects.has(projectKey),
        isPinned: recentDirectory?.isPinned ?? false,
        lastActivity: recentDirectory?.lastAccessed ?? historyItems[0].endedAt,
        liveItems: [],
        historyItems,
      });
      recentDirectoriesByKey.delete(projectKey);
    }

    if (status === 'all') {
      for (const recentDirectory of recentDirectoriesByKey.values()) {
        const title = recentDirectory.displayName || this.getProjectTitle(recentDirectory.path);
        const subtitle = this.getProjectSubtitle(recentDirectory.path);
        if (filter && !this.matchesProjectText(title, subtitle, filter)) {
          continue;
        }

        const projectKey = this.getProjectKey(recentDirectory.path);
        groups.set(projectKey, {
          key: projectKey,
          path: recentDirectory.path || null,
          title,
          subtitle,
          createdAt: recentDirectory.lastAccessed,
          sessionCount: 0,
          busyCount: 0,
          hasSelectedInstance: false,
          isExpanded: !collapsedProjects.has(projectKey),
          isPinned: recentDirectory.isPinned,
          lastActivity: recentDirectory.lastAccessed,
          liveItems: [],
          historyItems: [],
        });
      }
    }

    return Array.from(groups.values()).sort((left, right) => {
      if (left.isPinned !== right.isPinned) {
        return left.isPinned ? -1 : 1;
      }

      const timestampDelta =
        this.getProjectSortTimestamp(right) - this.getProjectSortTimestamp(left);
      if (timestampDelta !== 0) {
        return timestampDelta;
      }

      return left.title.localeCompare(right.title, undefined, { sensitivity: 'base' });
    });
  });

  constructor() {
    void this.historyStore.loadHistory();
    void this.loadRecentDirectories();

    effect(() => {
      const selected = this.store.selectedInstance();
      if (!selected) {
        return;
      }

      const projectKey = this.getProjectKey(selected.workingDirectory);
      this.collapsedProjectKeys.update((current) => {
        if (!current.has(projectKey)) {
          return current;
        }

        const next = new Set(current);
        next.delete(projectKey);
        return next;
      });

      this.collapsedIds.update((current) => {
        let changed = false;
        const next = new Set(current);
        let parentId = selected.parentId;

        while (parentId) {
          if (next.delete(parentId)) {
            changed = true;
          }
          parentId = this.store.instancesMap().get(parentId)?.parentId ?? null;
        }

        return changed ? next : current;
      });
    });

    let previousRootIds = new Set<string>();
    effect(() => {
      const currentRootIds = new Set(this.store.rootInstances().map((instance) => instance.id));
      const removedRoot = previousRootIds.size > 0 &&
        Array.from(previousRootIds).some((id) => !currentRootIds.has(id));
      const knownRecentDirectories = new Set(
        this.recentDirectories().map((entry) => this.getProjectKey(entry.path))
      );

      previousRootIds = currentRootIds;

      // Sync live workspaces into the persisted recent-project index.
      for (const instance of this.store.rootInstances()) {
        const workingDirectory = instance.workingDirectory?.trim();
        if (workingDirectory && !knownRecentDirectories.has(this.getProjectKey(workingDirectory))) {
          void this.recentDirectoriesService.addDirectory(workingDirectory);
        }
      }
      void this.loadRecentDirectories();

      if (removedRoot) {
        void this.historyStore.loadHistory();
      }
    });
  }

  onFilterChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.filterText.set(input.value);
    this.openProjectMenuKey.set(null);
  }

  onStatusFilterChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.statusFilter.set(select.value);
    this.openProjectMenuKey.set(null);
  }

  onSortModeChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const value = select.value === 'created' ? 'created' : 'last-interacted';
    this.historySortMode.set(value);
    this.saveSortMode(value);
    this.openProjectMenuKey.set(null);
  }

  onSelectInstance(instanceId: string): void {
    this.openProjectMenuKey.set(null);
    this.store.setSelectedInstance(instanceId);
  }

  onTerminateInstance(instanceId: string): void {
    this.store.terminateInstance(instanceId);
  }

  onRestartInstance(instanceId: string): void {
    this.store.restartInstance(instanceId);
  }

  onToggleExpand(instanceId: string): void {
    this.collapsedIds.update((current) => {
      const next = new Set(current);
      if (next.has(instanceId)) {
        next.delete(instanceId);
      } else {
        next.add(instanceId);
      }
      return next;
    });
  }

  toggleProjectGroup(projectKey: string): void {
    this.openProjectMenuKey.set(null);
    this.collapsedProjectKeys.update((current) => {
      const next = new Set(current);
      if (next.has(projectKey)) {
        next.delete(projectKey);
      } else {
        next.add(projectKey);
      }
      return next;
    });
  }

  async toggleProjectPinned(group: ProjectGroup, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (!group.path) {
      return;
    }

    const nextPinnedState = !group.isPinned;
    let updated = await this.recentDirectoriesService.pinDirectory(group.path, nextPinnedState);
    if (!updated) {
      await this.recentDirectoriesService.addDirectory(group.path);
      updated = await this.recentDirectoriesService.pinDirectory(group.path, nextPinnedState);
    }
    if (updated) {
      await this.loadRecentDirectories();
    }
  }

  async toggleProjectMenu(projectKey: string, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();

    if (this.openProjectMenuKey() === projectKey) {
      this.openProjectMenuKey.set(null);
      return;
    }

    await this.ensurePreferredEditorLoaded();
    this.openProjectMenuKey.set(projectKey);
  }

  async openProjectInPreferredEditor(group: ProjectGroup, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (!group.path) {
      return;
    }

    await this.fileIpc.editorOpenDirectory(group.path);
    this.openProjectMenuKey.set(null);
  }

  async openProjectInSystemFileManager(group: ProjectGroup, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    if (!group.path) {
      return;
    }

    await this.fileIpc.openPath(group.path);
    this.openProjectMenuKey.set(null);
  }

  onDrop(event: CdkDragDrop<HierarchicalInstance[]>, group: ProjectGroup): void {
    const draggedItem = event.item.data as HierarchicalInstance;
    if (draggedItem.depth > 0) {
      return;
    }

    const groupRootIds = group.liveItems
      .filter((item) => item.depth === 0)
      .map((item) => item.instance.id);
    const fromRootIndex = groupRootIds.indexOf(draggedItem.instance.id);
    if (fromRootIndex === -1) {
      return;
    }

    const visibleRootIds = group.liveItems
      .map((item, index) => ({ item, index }))
      .filter(({ item }) => item.depth === 0);

    const currentVisibleRootIndex = visibleRootIds.findIndex(({ index }) => index === event.currentIndex);
    const targetRootIndex = currentVisibleRootIndex === -1
      ? groupRootIds.length - 1
      : currentVisibleRootIndex;

    if (fromRootIndex === targetRootIndex) {
      return;
    }

    const reorderedGroupRoots = [...groupRootIds];
    moveItemInArray(reorderedGroupRoots, fromRootIndex, targetRootIndex);

    const currentOrderedRoots = this.getOrderedRootIds(this.store.instances());
    const replacementQueue = [...reorderedGroupRoots];
    const groupSet = new Set(groupRootIds);
    const nextOrder = currentOrderedRoots.map((rootId) =>
      groupSet.has(rootId) ? replacementQueue.shift() ?? rootId : rootId
    );

    this.rootInstanceOrder.set(nextOrder);
    this.saveOrder(nextOrder);
  }

  async onRestoreHistory(entryId: string): Promise<void> {
    if (this.restoringHistoryIds().has(entryId)) {
      return;
    }

    this.openProjectMenuKey.set(null);
    this.restoringHistoryIds.update((current) => new Set(current).add(entryId));

    try {
      const entry = this.historyStore.entries().find((item) => item.id === entryId);
      const result = await this.historyStore.restoreEntry(entryId, entry?.workingDirectory);
      if (result.success && result.instanceId) {
        this.store.setSelectedInstance(result.instanceId);
      } else if (result.error) {
        console.error('Failed to restore history entry:', result.error);
      }
    } finally {
      this.restoringHistoryIds.update((current) => {
        const next = new Set(current);
        next.delete(entryId);
        return next;
      });
    }
  }

  async onArchiveHistory(entryId: string, event: Event): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    this.openProjectMenuKey.set(null);
    await this.historyStore.archiveEntry(entryId);
  }

  private buildChildrenMap(instances: Instance[]): Map<string, string[]> {
    const childrenByParent = new Map<string, string[]>();
    for (const instance of instances) {
      if (!instance.parentId) {
        continue;
      }

      const siblings = childrenByParent.get(instance.parentId) ?? [];
      siblings.push(instance.id);
      childrenByParent.set(instance.parentId, siblings);
    }
    return childrenByParent;
  }

  private buildVisibleItems(
    instance: Instance,
    context: {
      filter: string;
      status: string;
      projectMatches: boolean;
      collapsed: Set<string>;
      childrenByParent: Map<string, string[]>;
      instanceMap: Map<string, Instance>;
    },
    depth: number,
    parentChain: boolean[],
    isLastChild: boolean
  ): HierarchicalInstance[] {
    const childrenIds = context.childrenByParent.get(instance.id) ?? [];
    const children = childrenIds
      .map((childId) => context.instanceMap.get(childId))
      .filter((child): child is Instance => child !== undefined)
      .sort((left, right) => left.createdAt - right.createdAt);

    const childParentChain = parentChain.concat(!isLastChild);
    const visibleChildren = children.flatMap((child, index) =>
      this.buildVisibleItems(
        child,
        context,
        depth + 1,
        childParentChain,
        index === children.length - 1
      )
    );

    const textMatches = !context.filter ||
      context.projectMatches ||
      instance.displayName.toLowerCase().includes(context.filter) ||
      instance.id.toLowerCase().includes(context.filter);
    const statusMatches = context.status === 'all' || instance.status === context.status;
    const selfVisible = textMatches && statusMatches;

    if (!selfVisible && visibleChildren.length === 0) {
      return [];
    }

    const hasChildren = children.length > 0;
    const isExpanded = !context.collapsed.has(instance.id);
    const currentItem: HierarchicalInstance = {
      instance: {
        ...instance,
        childrenIds,
      },
      railTitle: instance.displayName,
      depth,
      hasChildren,
      isExpanded,
      isLastChild,
      parentChain,
    };

    if (!hasChildren || !isExpanded) {
      return [currentItem];
    }

    return [currentItem, ...visibleChildren];
  }

  private countSessionsInTree(
    instance: Instance,
    childrenByParent: Map<string, string[]>,
    instanceMap: Map<string, Instance>
  ): number {
    const childrenIds = childrenByParent.get(instance.id) ?? [];
    return 1 + childrenIds.reduce((count, childId) => {
      const child = instanceMap.get(childId);
      return child ? count + this.countSessionsInTree(child, childrenByParent, instanceMap) : count;
    }, 0);
  }

  private countBusySessions(
    instance: Instance,
    childrenByParent: Map<string, string[]>,
    instanceMap: Map<string, Instance>
  ): number {
    const isBusy = instance.status === 'busy' || instance.status === 'initializing' || instance.status === 'waiting_for_input';
    const childrenIds = childrenByParent.get(instance.id) ?? [];

    return (isBusy ? 1 : 0) + childrenIds.reduce((count, childId) => {
      const child = instanceMap.get(childId);
      return child ? count + this.countBusySessions(child, childrenByParent, instanceMap) : count;
    }, 0);
  }

  private matchesProjectText(title: string, subtitle: string, filter: string): boolean {
    return title.toLowerCase().includes(filter) || subtitle.toLowerCase().includes(filter);
  }

  private buildHistoryEntriesByProject(
    entries: ConversationHistoryEntry[],
    filter: string,
    status: string
  ): Map<string, ConversationHistoryEntry[]> {
    const groups = new Map<string, ConversationHistoryEntry[]>();
    if (status !== 'all') {
      return groups;
    }

    for (const entry of entries) {
      const title = this.getProjectTitle(entry.workingDirectory);
      const subtitle = this.getProjectSubtitle(entry.workingDirectory);

      if (
        filter &&
        !this.matchesProjectText(title, subtitle, filter) &&
        !this.matchesHistoryText(entry, filter)
      ) {
        continue;
      }

      const projectKey = this.getProjectKey(entry.workingDirectory);
      const projectEntries = groups.get(projectKey) ?? [];
      projectEntries.push(entry);
      groups.set(projectKey, projectEntries);
    }

    const pinnedIds = this.pinnedHistoryIds();
    const sortMode = this.historySortMode();
    for (const projectEntries of groups.values()) {
      projectEntries.sort((left, right) => {
        const leftPinned = pinnedIds.has(left.id);
        const rightPinned = pinnedIds.has(right.id);
        if (leftPinned !== rightPinned) {
          return leftPinned ? -1 : 1;
        }
        return this.getHistorySortTimestamp(right, sortMode) - this.getHistorySortTimestamp(left, sortMode);
      });

      const dedupedEntries: ConversationHistoryEntry[] = [];
      const seenSessionIds = new Set<string>();

      for (const entry of projectEntries) {
        const dedupeKey = entry.sessionId.trim() || entry.id;
        if (seenSessionIds.has(dedupeKey)) {
          continue;
        }
        seenSessionIds.add(dedupeKey);
        dedupedEntries.push(entry);
      }

      projectEntries.length = 0;
      projectEntries.push(...dedupedEntries);
    }

    return groups;
  }

  private matchesHistoryText(entry: ConversationHistoryEntry, filter: string): boolean {
    return (
      entry.displayName.toLowerCase().includes(filter) ||
      entry.firstUserMessage.toLowerCase().includes(filter) ||
      entry.lastUserMessage.toLowerCase().includes(filter)
    );
  }

  private getOrderedRootInstances(instances: Instance[]): Instance[] {
    const orderedRootIds = this.getOrderedRootIds(instances);
    const instanceMap = new Map(instances.map((instance) => [instance.id, instance]));
    return orderedRootIds
      .map((id) => instanceMap.get(id))
      .filter((instance): instance is Instance => !!instance);
  }

  private getOrderedRootIds(instances: Instance[]): string[] {
    const roots = instances.filter((instance) => !instance.parentId);
    const customOrder = this.rootInstanceOrder();

    return [...roots]
      .sort((left, right) => {
        const leftIndex = customOrder.indexOf(left.id);
        const rightIndex = customOrder.indexOf(right.id);

        if (leftIndex !== -1 && rightIndex !== -1) {
          return leftIndex - rightIndex;
        }
        if (leftIndex !== -1) {
          return -1;
        }
        if (rightIndex !== -1) {
          return 1;
        }
        return left.createdAt - right.createdAt;
      })
      .map((instance) => instance.id);
  }

  private getProjectKey(workingDirectory: string | null | undefined): string {
    const normalized = (workingDirectory ?? '').trim();
    return normalized ? normalized.toLowerCase() : NO_WORKSPACE_KEY;
  }

  private getProjectTitle(workingDirectory: string | null | undefined): string {
    const normalized = (workingDirectory ?? '').trim();
    if (!normalized) {
      return 'No workspace';
    }

    const parts = normalized.split(/[/\\]/).filter(Boolean);
    return parts.at(-1) ?? normalized;
  }

  private getProjectSubtitle(workingDirectory: string | null | undefined): string {
    const normalized = (workingDirectory ?? '').trim();
    if (!normalized) {
      return 'Sessions without a working directory';
    }

    return normalized
      .replace(/^\/Users\/[^/]+/, '~')
      .replace(/^\/home\/[^/]+/, '~');
  }

  private loadOrder(): string[] {
    try {
      const saved = localStorage.getItem(ORDER_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  private saveOrder(order: string[]): void {
    try {
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
    } catch {
      // Ignore storage errors.
    }
  }

  private loadPinnedHistoryIds(): Set<string> {
    try {
      const saved = localStorage.getItem(PINNED_HISTORY_STORAGE_KEY);
      if (!saved) {
        return new Set();
      }
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) {
        return new Set();
      }
      return new Set(parsed.filter((value): value is string => typeof value === 'string'));
    } catch {
      return new Set();
    }
  }

  private savePinnedHistoryIds(ids: Set<string>): void {
    try {
      localStorage.setItem(PINNED_HISTORY_STORAGE_KEY, JSON.stringify(Array.from(ids)));
    } catch {
      // Ignore storage errors.
    }
  }

  isRestoringHistory(entryId: string): boolean {
    return this.restoringHistoryIds().has(entryId);
  }

  isPinnedHistory(entryId: string): boolean {
    return this.pinnedHistoryIds().has(entryId);
  }

  togglePinnedHistory(entryId: string, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this.pinnedHistoryIds.update((current) => {
      const next = new Set(current);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      this.savePinnedHistoryIds(next);
      return next;
    });
  }

  getHistoryTitle(entry: ConversationHistoryEntry): string {
    return getConversationHistoryTitle(entry);
  }

  getHistoryPreviewTitle(entry: ConversationHistoryEntry): string {
    return this.truncateRailText(this.getHistoryTitle(entry));
  }

  formatRelativeTime(timestamp: number): string {
    const diff = Date.now() - timestamp;
    const minute = 60_000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;

    if (diff < hour) {
      return `${Math.max(1, Math.round(diff / minute))}m`;
    }
    if (diff < day) {
      return `${Math.round(diff / hour)}h`;
    }
    if (diff < week) {
      return `${Math.round(diff / day)}d`;
    }
    return `${Math.round(diff / week)}w`;
  }

  formatHistoryTime(entry: ConversationHistoryEntry): string {
    return this.formatRelativeTime(this.getHistorySortTimestamp(entry, this.historySortMode()));
  }

  private getLiveRailTitle(
    instance: Instance,
    matchingHistoryEntry?: ConversationHistoryEntry
  ): string {
    if (matchingHistoryEntry) {
      return getConversationHistoryTitle(matchingHistoryEntry);
    }

    return instance.displayName;
  }

  private async loadRecentDirectories(): Promise<void> {
    const directories = await this.recentDirectoriesService.getDirectories({
      sortBy: 'lastAccessed',
    });
    this.recentDirectories.set(directories);
  }

  private async ensurePreferredEditorLoaded(): Promise<void> {
    const response = await this.fileIpc.editorGetDefault();
    const editor = response.success && response.data && typeof response.data === 'object'
      ? (response.data as Record<string, unknown>)
      : null;
    const type = typeof editor?.['type'] === 'string' ? editor['type'] : null;
    if (!type) {
      this.preferredEditorLabel.set('Editor');
      return;
    }

    switch (type) {
      case 'vscode':
        this.preferredEditorLabel.set('VS Code');
        break;
      case 'vscode-insiders':
        this.preferredEditorLabel.set('VS Code Insiders');
        break;
      case 'cursor':
        this.preferredEditorLabel.set('Cursor');
        break;
      case 'xcode':
        this.preferredEditorLabel.set('Xcode');
        break;
      case 'android-studio':
        this.preferredEditorLabel.set('Android Studio');
        break;
      default:
        this.preferredEditorLabel.set(type.charAt(0).toUpperCase() + type.slice(1));
    }
  }

  private getSystemFileManagerLabel(): string {
    if (navigator.userAgent.includes('Windows')) {
      return 'Explorer';
    }
    if (navigator.userAgent.includes('Linux')) {
      return 'Files';
    }
    return 'Finder';
  }

  private getProjectSortTimestamp(group: ProjectGroup): number {
    if (this.historySortMode() === 'created') {
      return group.createdAt;
    }

    return group.lastActivity;
  }

  private getHistorySortTimestamp(entry: ConversationHistoryEntry, mode: HistorySortMode): number {
    return mode === 'created' ? entry.createdAt : entry.endedAt;
  }

  private truncateRailText(value: string, maxLength = 42): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) {
      return normalized;
    }

    return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
  }

  private loadSortMode(): HistorySortMode {
    try {
      const saved = localStorage.getItem(SORT_MODE_STORAGE_KEY);
      return saved === 'created' ? 'created' : 'last-interacted';
    } catch {
      return 'last-interacted';
    }
  }

  private saveSortMode(mode: HistorySortMode): void {
    try {
      localStorage.setItem(SORT_MODE_STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors.
    }
  }
}
