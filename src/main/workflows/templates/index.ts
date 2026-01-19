/**
 * Built-in Workflow Templates
 * Export all built-in workflow templates
 */

import { WorkflowTemplate } from '../../../shared/types/workflow.types';
import { featureDevelopmentTemplate } from './feature-development';
import { prReviewTemplate } from './pr-review';

export const builtInTemplates: WorkflowTemplate[] = [
  featureDevelopmentTemplate,
  prReviewTemplate,
];

export { featureDevelopmentTemplate, prReviewTemplate };
