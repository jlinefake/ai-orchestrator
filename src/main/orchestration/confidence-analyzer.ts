/**
 * Confidence Analyzer - Multi-signal confidence extraction
 * Replaces simple regex-based confidence extraction with a more robust approach
 */

import type { AgentResponse } from '../../shared/types/verification.types';

export interface ConfidenceAssessment {
  explicit: number;        // From explicit confidence statements (0-1)
  linguistic: number;      // From language patterns (0-1)
  consistency: number;     // Internal consistency (0-1)
  evidenceStrength: number; // Quality of evidence (0-1)
  combined: number;        // Weighted combination (0-1)
}

export interface ConfidenceAnalyzerConfig {
  explicitWeight: number;
  linguisticWeight: number;
  consistencyWeight: number;
  evidenceWeight: number;
}

// Linguistic patterns for confidence detection
const HIGH_CONFIDENCE_PATTERNS = [
  /\b(certainly|definitely|absolutely|clearly|undoubtedly|unquestionably)\b/gi,
  /\b(is|are|will|must)\s+(?:always|never|guaranteed)/gi,
  /\b(100%|99%|95%|high confidence|very confident|highly confident)\b/gi,
  /\bI am (certain|sure|confident)\b/gi,
  /\bwithout (a )?doubt\b/gi,
  /\bno question\b/gi,
];

const MEDIUM_CONFIDENCE_PATTERNS = [
  /\b(likely|probably|usually|typically|generally|often|mostly)\b/gi,
  /\b(should|would|expect|anticipate)\b/gi,
  /\b(80%|75%|70%|moderate confidence|fairly confident)\b/gi,
  /\bin most cases\b/gi,
  /\btends to\b/gi,
];

const LOW_CONFIDENCE_PATTERNS = [
  /\b(maybe|perhaps|possibly|might|could|potentially)\b/gi,
  /\b(I think|I believe|it seems|appears to|may be|could be)\b/gi,
  /\b(not sure|uncertain|unsure|unclear)\b/gi,
  /\b(50%|40%|30%|low confidence|somewhat)\b/gi,
  /\bprobably not\b/gi,
];

const HEDGING_PATTERNS = [
  /\bI'm not (entirely|completely|fully) sure\b/gi,
  /\bto some extent\b/gi,
  /\bmore or less\b/gi,
  /\bit depends\b/gi,
  /\bin some cases\b/gi,
  /\bunder certain conditions\b/gi,
];

const EVIDENCE_INDICATORS = [
  /\b(evidence|proof|data|research|study|studies|findings)\b/gi,
  /\b(according to|based on|shows that|demonstrates|indicates)\b/gi,
  /\b(source|reference|documentation|specification)\b/gi,
  /\bfor example\b/gi,
  /\bspecifically\b/gi,
];

export class ConfidenceAnalyzer {
  private static instance: ConfidenceAnalyzer;
  private config: ConfidenceAnalyzerConfig;

  private defaultConfig: ConfidenceAnalyzerConfig = {
    explicitWeight: 0.35,
    linguisticWeight: 0.25,
    consistencyWeight: 0.25,
    evidenceWeight: 0.15,
  };

  static getInstance(): ConfidenceAnalyzer {
    if (!this.instance) {
      this.instance = new ConfidenceAnalyzer();
    }
    return this.instance;
  }

  private constructor() {
    this.config = { ...this.defaultConfig };
  }

  // ============ Configuration ============

  configure(config: Partial<ConfidenceAnalyzerConfig>): void {
    this.config = { ...this.config, ...config };
    // Normalize weights to sum to 1
    const total = this.config.explicitWeight + this.config.linguisticWeight +
                  this.config.consistencyWeight + this.config.evidenceWeight;
    if (total > 0) {
      this.config.explicitWeight /= total;
      this.config.linguisticWeight /= total;
      this.config.consistencyWeight /= total;
      this.config.evidenceWeight /= total;
    }
  }

  getConfig(): ConfidenceAnalyzerConfig {
    return { ...this.config };
  }

  // ============ Main Analysis ============

  /**
   * Extract comprehensive confidence assessment from an agent response
   */
  async extractConfidence(response: AgentResponse): Promise<ConfidenceAssessment> {
    const explicit = this.findExplicitConfidence(response.response);
    const linguistic = this.analyzeLinguisticCertainty(response.response);
    const consistency = this.measureInternalConsistency(response);
    const evidenceStrength = this.assessEvidenceQuality(response);

    const combined = this.combineConfidenceSignals({
      explicit,
      linguistic,
      consistency,
      evidenceStrength,
    });

    return {
      explicit,
      linguistic,
      consistency,
      evidenceStrength,
      combined,
    };
  }

  // ============ Explicit Confidence ============

  /**
   * Find explicitly stated confidence values
   */
  findExplicitConfidence(text: string): number {
    // Look for explicit percentage confidence statements
    const percentMatches = text.match(/(?:confidence[:\s]*|confidence[:\s]+is[:\s]*)(\d{1,3})%?/gi);
    if (percentMatches && percentMatches.length > 0) {
      const values = percentMatches.map(m => {
        const numMatch = m.match(/(\d{1,3})/);
        return numMatch ? parseInt(numMatch[1]) / 100 : 0;
      }).filter(v => v >= 0 && v <= 1);

      if (values.length > 0) {
        // Use the most recent/last confidence statement
        return values[values.length - 1];
      }
    }

    // Look for "Overall Confidence" section
    const overallMatch = text.match(/Overall Confidence[:\s]*(\d{1,3})%?/i);
    if (overallMatch) {
      return parseInt(overallMatch[1]) / 100;
    }

    // Look for verbal confidence levels
    const highConfidenceTerms = ['very high confidence', 'extremely confident', 'certain', 'definitely'];
    const mediumConfidenceTerms = ['high confidence', 'confident', 'likely'];
    const lowConfidenceTerms = ['low confidence', 'uncertain', 'unsure', 'not confident'];

    const lowerText = text.toLowerCase();

    for (const term of highConfidenceTerms) {
      if (lowerText.includes(term)) return 0.9;
    }
    for (const term of mediumConfidenceTerms) {
      if (lowerText.includes(term)) return 0.7;
    }
    for (const term of lowConfidenceTerms) {
      if (lowerText.includes(term)) return 0.3;
    }

    // Default: couldn't find explicit confidence
    return 0.5;
  }

  // ============ Linguistic Analysis ============

  /**
   * Analyze linguistic certainty patterns
   */
  analyzeLinguisticCertainty(text: string): number {
    let score = 0.5; // Start neutral

    // Count pattern matches
    const highCount = this.countPatternMatches(text, HIGH_CONFIDENCE_PATTERNS);
    const mediumCount = this.countPatternMatches(text, MEDIUM_CONFIDENCE_PATTERNS);
    const lowCount = this.countPatternMatches(text, LOW_CONFIDENCE_PATTERNS);
    const hedgingCount = this.countPatternMatches(text, HEDGING_PATTERNS);

    // Normalize by text length (per 1000 characters)
    const normalizer = Math.max(1, text.length / 1000);
    const normalizedHigh = highCount / normalizer;
    const normalizedMedium = mediumCount / normalizer;
    const normalizedLow = lowCount / normalizer;
    const normalizedHedging = hedgingCount / normalizer;

    // Calculate score based on pattern density
    score += normalizedHigh * 0.15;
    score += normalizedMedium * 0.05;
    score -= normalizedLow * 0.15;
    score -= normalizedHedging * 0.1;

    // Clamp to 0-1
    return Math.max(0, Math.min(1, score));
  }

  private countPatternMatches(text: string, patterns: RegExp[]): number {
    let count = 0;
    for (const pattern of patterns) {
      const matches = text.match(pattern);
      if (matches) {
        count += matches.length;
      }
    }
    return count;
  }

  // ============ Internal Consistency ============

  /**
   * Measure internal consistency of the response
   */
  measureInternalConsistency(response: AgentResponse): number {
    const keyPoints = response.keyPoints;

    if (!keyPoints || keyPoints.length === 0) {
      return 0.5; // Neutral if no key points
    }

    if (keyPoints.length === 1) {
      return 0.7; // Single point is somewhat consistent by default
    }

    // Check for contradictory categories
    const hasConclusion = keyPoints.some(p => p.category === 'conclusion');
    const hasWarning = keyPoints.some(p => p.category === 'warning');
    const hasRecommendation = keyPoints.some(p => p.category === 'recommendation');

    // Consistent structure gets bonus
    let consistencyScore = 0.6;

    if (hasConclusion && hasRecommendation) {
      consistencyScore += 0.1;
    }

    // Check confidence variance among key points
    const confidences = keyPoints.map(p => p.confidence).filter(c => c !== undefined);
    if (confidences.length >= 2) {
      const variance = this.calculateVariance(confidences);
      // Low variance = high consistency
      if (variance < 0.1) consistencyScore += 0.15;
      else if (variance < 0.2) consistencyScore += 0.1;
      else if (variance > 0.4) consistencyScore -= 0.15;
    }

    // Check for presence of warnings (awareness of limitations increases consistency)
    if (hasWarning) {
      consistencyScore += 0.05;
    }

    // Check if response mentions "however", "but", "on the other hand" (balanced view)
    const text = response.response.toLowerCase();
    const balancedIndicators = ['however', 'but ', 'on the other hand', 'nevertheless', 'although'];
    const hasBalancedView = balancedIndicators.some(ind => text.includes(ind));
    if (hasBalancedView) {
      consistencyScore += 0.05;
    }

    return Math.max(0, Math.min(1, consistencyScore));
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  // ============ Evidence Quality ============

  /**
   * Assess quality of evidence provided
   */
  assessEvidenceQuality(response: AgentResponse): number {
    const text = response.response;
    let score = 0.3; // Base score

    // Count evidence indicators
    const evidenceCount = this.countPatternMatches(text, EVIDENCE_INDICATORS);
    const normalizer = Math.max(1, text.length / 1000);
    const normalizedEvidence = evidenceCount / normalizer;

    // More evidence indicators = higher score
    score += Math.min(0.3, normalizedEvidence * 0.1);

    // Check for specific examples
    if (/for example|such as|e\.g\.|i\.e\./i.test(text)) {
      score += 0.1;
    }

    // Check for code snippets or technical details
    if (/```|\bfunction\b|\bclass\b|\bimport\b/i.test(text)) {
      score += 0.1;
    }

    // Check for structured reasoning
    if (/\b(first|second|third|finally|therefore|thus|hence|consequently)\b/i.test(text)) {
      score += 0.1;
    }

    // Check key points for supporting evidence
    const keyPoints = response.keyPoints;
    if (keyPoints && keyPoints.length > 0) {
      const withEvidence = keyPoints.filter(p => p.supportingEvidence && p.supportingEvidence.length > 0);
      if (withEvidence.length > 0) {
        score += 0.1 * (withEvidence.length / keyPoints.length);
      }
    }

    return Math.max(0, Math.min(1, score));
  }

  // ============ Signal Combination ============

  /**
   * Combine multiple confidence signals into a single score
   */
  combineConfidenceSignals(signals: {
    explicit: number;
    linguistic: number;
    consistency: number;
    evidenceStrength: number;
  }): number {
    // Weighted average
    const combined =
      signals.explicit * this.config.explicitWeight +
      signals.linguistic * this.config.linguisticWeight +
      signals.consistency * this.config.consistencyWeight +
      signals.evidenceStrength * this.config.evidenceWeight;

    // Apply slight boost if all signals agree (low variance)
    const allSignals = [signals.explicit, signals.linguistic, signals.consistency, signals.evidenceStrength];
    const variance = this.calculateVariance(allSignals);

    if (variance < 0.05) {
      // Signals agree - boost slightly towards the mean
      const mean = allSignals.reduce((a, b) => a + b, 0) / 4;
      return combined * 0.9 + mean * 0.1;
    }

    return Math.max(0, Math.min(1, combined));
  }

  // ============ Batch Analysis ============

  /**
   * Analyze confidence for multiple responses
   */
  async analyzeMultiple(responses: AgentResponse[]): Promise<Map<string, ConfidenceAssessment>> {
    const results = new Map<string, ConfidenceAssessment>();

    for (const response of responses) {
      const assessment = await this.extractConfidence(response);
      results.set(response.agentId, assessment);
    }

    return results;
  }

  /**
   * Get aggregate confidence statistics
   */
  getAggregateStats(assessments: Map<string, ConfidenceAssessment>): {
    mean: number;
    median: number;
    min: number;
    max: number;
    variance: number;
  } {
    const values = Array.from(assessments.values()).map(a => a.combined);

    if (values.length === 0) {
      return { mean: 0, median: 0, min: 0, max: 0, variance: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const median = sorted[Math.floor(sorted.length / 2)];
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const variance = this.calculateVariance(values);

    return { mean, median, min, max, variance };
  }
}

// Singleton getter
export function getConfidenceAnalyzer(): ConfidenceAnalyzer {
  return ConfidenceAnalyzer.getInstance();
}
