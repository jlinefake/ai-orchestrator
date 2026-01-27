/**
 * Context Session Stats Component - Session statistics with savings visualization
 */

import { Component, input, ChangeDetectionStrategy } from '@angular/core';
import { SlicePipe } from '@angular/common';
import type { RLMSession } from '../../../../../shared/types/rlm.types';

@Component({
  selector: 'app-context-session-stats',
  standalone: true,
  imports: [SlicePipe],
  template: `
    <div class="session-stats">
      <div class="session-header">
        <span class="session-title">Session Statistics</span>
        <span class="session-id">{{ session().id | slice: 0 : 12 }}...</span>
      </div>
      <div class="savings-display">
        <div class="savings-bar">
          <div
            class="savings-fill"
            [style.width.%]="session().tokenSavingsPercent"
          ></div>
        </div>
        <span class="savings-text">
          {{ session().tokenSavingsPercent.toFixed(1) }}% token savings
        </span>
      </div>
      <div class="session-metrics">
        <div class="metric">
          <span class="metric-label">Root Tokens</span>
          <span class="metric-value">{{
            formatNumber(session().totalRootTokens)
          }}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Sub-Query Tokens</span>
          <span class="metric-value">{{
            formatNumber(session().totalSubQueryTokens)
          }}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Direct Estimate</span>
          <span class="metric-value strikethrough">{{
            formatNumber(session().estimatedDirectTokens)
          }}</span>
        </div>
        <div class="metric">
          <span class="metric-label">Queries</span>
          <span class="metric-value">{{ session().queries.length }}</span>
        </div>
      </div>
    </div>
  `,
  styles: [
    `
      .session-stats {
        padding: var(--spacing-md);
        border-bottom: 1px solid var(--border-color);
        background: var(--bg-tertiary);
      }

      .session-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: var(--spacing-sm);
      }

      .session-title {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-primary);
      }

      .session-id {
        font-size: 10px;
        color: var(--text-muted);
        font-family: var(--font-mono);
      }

      .savings-display {
        margin-bottom: var(--spacing-sm);
      }

      .savings-bar {
        height: 8px;
        background: var(--bg-secondary);
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 4px;
      }

      .savings-fill {
        height: 100%;
        background: linear-gradient(90deg, #10b981, #34d399);
        border-radius: 4px;
        transition: width var(--transition-normal);
      }

      .savings-text {
        font-size: 11px;
        color: #10b981;
        font-weight: 600;
      }

      .session-metrics {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: var(--spacing-sm);
      }

      .metric {
        display: flex;
        flex-direction: column;
      }

      .metric-label {
        font-size: 9px;
        color: var(--text-muted);
      }

      .metric-value {
        font-size: 12px;
        font-weight: 500;
        color: var(--text-primary);

        &.strikethrough {
          text-decoration: line-through;
          color: var(--text-muted);
        }
      }
    `
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ContextSessionStatsComponent {
  session = input.required<RLMSession>();

  formatNumber(num: number): string {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  }
}
