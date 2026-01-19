/**
 * Self-Improvement Types
 * Based on Training-Free GRPO and Behavioral Learning patterns
 *
 * Key insight: Instead of updating model weights, we can:
 * 1. Generate multiple response candidates
 * 2. Evaluate relative quality (GRPO principle)
 * 3. Store successful patterns in experience library
 * 4. Inject winning patterns into future prompts
 */

export interface TaskOutcome {
  id: string;
  instanceId: string;

  // Task details
  taskType: string; // e.g., 'feature-development', 'bug-fix', 'review'
  taskDescription: string;
  prompt: string;
  context?: string;

  // Execution details
  agentUsed: string;
  modelUsed: string;
  workflowUsed?: string;
  toolsUsed: ToolUsageRecord[];
  tokensUsed: number;
  duration: number;

  // Outcome
  success: boolean;
  completionScore?: number; // 0-1 objective completion
  userSatisfaction?: number; // 1-5 if user rated
  errorType?: string;
  errorMessage?: string;

  // Extracted patterns
  patterns: TaskPattern[];

  // Timing
  timestamp: number;
}

export interface ToolUsageRecord {
  tool: string;
  count: number;
  avgDuration: number;
  errorCount: number;
}

export interface TaskPattern {
  type: PatternType;
  value: string;
  effectiveness: number; // 0-1 based on outcomes
  sampleSize: number;
  lastUpdated: number;
}

export type PatternType =
  | 'tool_sequence' // Effective tool ordering
  | 'agent_task_pairing' // Which agent works for which task
  | 'model_task_pairing' // Which model for which task
  | 'prompt_structure' // Effective prompt patterns
  | 'error_recovery' // How to recover from errors
  | 'context_selection' // What context helps
  | 'workflow_shortcut'; // Skippable workflow steps

export interface Experience {
  id: string;
  taskType: string;
  description: string;

  // What worked
  successfulPatterns: TaskPattern[];

  // What to avoid
  failurePatterns: TaskPattern[];

  // Concrete examples
  examplePrompts: ExamplePrompt[];

  // Metadata
  sampleSize: number;
  avgSuccessRate: number;
  lastUpdated: number;
}

export interface ExamplePrompt {
  prompt: string;
  context?: string;
  outcome: 'success' | 'failure';
  lessonsLearned: string[];
}

export interface LearningInsight {
  id: string;
  type: 'pattern' | 'anti-pattern' | 'optimization' | 'recommendation';
  description: string;
  confidence: number; // 0-1
  evidence: string[];
  taskTypes: string[];
  createdAt: number;
  appliedCount: number; // How many times this insight was used
  successRate: number; // Success rate when applied
}

export interface PromptVariant {
  id: string;
  basePromptId: string;
  variant: string;
  modifications: string[];
  performance: VariantPerformance;
  active: boolean;
}

export interface VariantPerformance {
  successRate: number;
  avgSatisfaction: number;
  avgTokens: number;
  avgDuration: number;
  sampleSize: number;
  lastUpdated: number;
}

export interface ABTest {
  id: string;
  name: string;
  description: string;

  // Variants
  control: PromptVariant;
  treatment: PromptVariant;

  // Configuration
  taskTypeFilter?: string;
  trafficSplit: number; // 0-1, portion going to treatment

  // Results
  status: 'running' | 'completed' | 'stopped';
  startedAt: number;
  completedAt?: number;
  winner?: 'control' | 'treatment' | 'no_difference';
  significance?: number; // Statistical significance (0-1)
}

export interface SelfImprovementConfig {
  // Pattern tracking
  minSampleSize: number; // Min samples for pattern confidence (default: 10)
  patternDecayRate: number; // How quickly old patterns lose weight (default: 0.95)
  insightThreshold: number; // Confidence needed for insight (default: 0.8)

  // Experience replay
  maxExperiences: number; // Max experiences to store (default: 1000)
  experienceRetention: number; // Days to retain experiences (default: 90)

  // Prompt enhancement
  enableAutoEnhancement: boolean;
  maxEnhancementTokens: number; // Max tokens to add to prompts (default: 2000)

  // A/B testing
  enableABTesting: boolean;
  minABTestSamples: number; // Min samples per variant (default: 30)
}

// Strategy recommendation
export interface StrategyRecommendation {
  taskType: string;
  recommendedAgent: string;
  recommendedModel: string;
  suggestedWorkflow?: string;
  confidence: number;
  reasoning: string[];
  alternatives: AlternativeStrategy[];
}

export interface AlternativeStrategy {
  agent: string;
  model: string;
  successRate: number;
  sampleSize: number;
}

// Prompt enhancement
export interface PromptEnhancement {
  originalPrompt: string;
  enhancedPrompt: string;
  enhancements: EnhancementApplied[];
  estimatedImpact: number; // 0-1 expected improvement
}

export interface EnhancementApplied {
  type: EnhancementType;
  description: string;
  insertedText?: string;
  source?: string; // ID of insight or pattern that prompted this
}

export type EnhancementType =
  | 'context_injection' // Add relevant context
  | 'pattern_application' // Apply successful pattern
  | 'constraint_addition' // Add helpful constraints
  | 'example_injection' // Add relevant example
  | 'error_prevention' // Add guidance to avoid known errors
  | 'structure_improvement'; // Improve prompt structure

// IPC Payloads
export interface RecordOutcomePayload {
  instanceId: string;
  taskType: string;
  taskDescription: string;
  prompt: string;
  context?: string;
  agentUsed: string;
  modelUsed: string;
  workflowUsed?: string;
  toolsUsed: ToolUsageRecord[];
  tokensUsed: number;
  duration: number;
  success: boolean;
  completionScore?: number;
  userSatisfaction?: number;
  errorType?: string;
  errorMessage?: string;
}

export interface GetRecommendationPayload {
  taskType: string;
  taskDescription?: string;
  context?: string;
}

export interface EnhancePromptPayload {
  prompt: string;
  taskType?: string;
  context?: string;
}

export interface GetInsightsPayload {
  taskType?: string;
  minConfidence?: number;
  limit?: number;
}

export interface GetExperiencePayload {
  taskType: string;
}

export interface RateOutcomePayload {
  outcomeId: string;
  satisfaction: number; // 1-5
}

export interface ConfigureLearningPayload {
  config: Partial<SelfImprovementConfig>;
}

// A/B Testing payloads
export interface CreateABTestPayload {
  name: string;
  description: string;
  controlVariant: string;
  treatmentVariant: string;
  taskTypeFilter?: string;
  trafficSplit?: number;
}

export interface GetABTestResultsPayload {
  testId: string;
}

export interface StopABTestPayload {
  testId: string;
}

// Stats and analytics
export interface LearningStats {
  totalOutcomes: number;
  successRate: number;
  patternCount: number;
  insightCount: number;
  experienceCount: number;
  avgSatisfaction: number;
  topPatterns: TaskPattern[];
  recentInsights: LearningInsight[];
  activeABTests: number;
}

export interface TaskTypeStats {
  taskType: string;
  totalOutcomes: number;
  successRate: number;
  avgDuration: number;
  avgTokens: number;
  topAgents: { agent: string; successRate: number }[];
  topModels: { model: string; successRate: number }[];
  commonErrors: { errorType: string; count: number }[];
}
