/**
 * Status Colors - Visual indicators for instance states
 */

import type { InstanceStatus } from '../types/instance.types';

export const STATUS_COLORS: Record<InstanceStatus, string> = {
  initializing: '#f59e0b', // Amber - warming up
  idle: '#10b981',         // Green - ready
  busy: '#3b82f6',         // Blue - processing
  waiting_for_input: '#f59e0b', // Amber - needs attention
  error: '#ef4444',        // Red - problem
  terminated: '#6b7280',   // Gray - stopped
};

export const STATUS_LABELS: Record<InstanceStatus, string> = {
  initializing: 'Initializing...',
  idle: 'Idle',
  busy: 'Processing...',
  waiting_for_input: 'Waiting for input',
  error: 'Error',
  terminated: 'Terminated',
};

export const STATUS_PULSING: Record<InstanceStatus, boolean> = {
  initializing: true,
  idle: false,
  busy: true,
  waiting_for_input: false,
  error: false,
  terminated: false,
};
