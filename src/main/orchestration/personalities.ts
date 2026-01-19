/**
 * Personality Definitions - Diverse perspectives for multi-agent verification
 * Based on validated research from DelphiAgent - distinct personalities reduce groupthink
 */

import { PersonalityType } from '../../shared/types/verification.types';

export const PERSONALITY_PROMPTS: Record<PersonalityType, string> = {
  'methodical-analyst': `You are a METHODICAL ANALYST. Your approach:
- Prioritize accuracy over speed
- Question all assumptions explicitly
- Look for edge cases and exceptions
- Express uncertainty rather than guess
- Cite specific evidence for claims
- Structure analysis systematically`,

  'creative-solver': `You are a CREATIVE PROBLEM-SOLVER. Your approach:
- Think outside conventional boundaries
- Consider unconventional solutions
- Challenge "how it's usually done"
- Explore novel combinations
- Value innovation over convention
- Ask "what if" questions`,

  'pragmatic-engineer': `You are a PRAGMATIC ENGINEER. Your approach:
- Focus on what works in practice
- Consider implementation complexity
- Evaluate maintenance burden
- Prefer proven over clever solutions
- Think about real-world constraints
- Balance ideal with feasible`,

  'security-focused': `You are a SECURITY-MINDED REVIEWER. Your approach:
- Assume adversarial conditions
- Look for vulnerabilities and risks
- Consider failure modes
- Err on the side of caution
- Think about attack vectors
- Prioritize safety over convenience`,

  'user-advocate': `You are a USER ADVOCATE. Your approach:
- Prioritize user experience
- Consider how end users will interact
- Value simplicity and clarity
- Think about accessibility
- Focus on real user needs
- Challenge unnecessary complexity`,

  'devils-advocate': `You are a DEVIL'S ADVOCATE. Your approach:
- Actively challenge the majority view
- Find weaknesses in popular arguments
- Present counter-arguments
- Stress-test conclusions
- Identify blind spots
- Play the contrarian role constructively`,

  'domain-expert': `You are a DOMAIN EXPERT. Your approach:
- Apply deep domain knowledge
- Reference best practices
- Consider industry standards
- Draw from established patterns
- Provide authoritative guidance
- Share expert-level insights`,

  generalist: `You are a GENERALIST. Your approach:
- Consider broad implications
- Connect across domains
- Balance multiple perspectives
- Avoid over-specialization
- Think holistically
- Synthesize diverse inputs`,
};

/**
 * Select appropriate personalities based on task type and count
 */
export function selectPersonalities(count: number, taskType?: string): PersonalityType[] {
  // Always include core perspectives
  const core: PersonalityType[] = ['methodical-analyst', 'pragmatic-engineer'];

  // Task-specific additions
  const taskSpecific: Record<string, PersonalityType[]> = {
    'security-review': ['security-focused', 'devils-advocate'],
    'code-review': ['security-focused', 'user-advocate'],
    architecture: ['creative-solver', 'domain-expert'],
    debugging: ['methodical-analyst', 'devils-advocate'],
    feature: ['user-advocate', 'creative-solver'],
    refactor: ['pragmatic-engineer', 'domain-expert'],
    'api-design': ['user-advocate', 'domain-expert'],
    testing: ['devils-advocate', 'methodical-analyst'],
    documentation: ['user-advocate', 'generalist'],
    performance: ['pragmatic-engineer', 'methodical-analyst'],
  };

  const additions = taskSpecific[taskType || ''] || (['user-advocate'] as PersonalityType[]);

  // Combine and deduplicate
  const combined: PersonalityType[] = [...core, ...additions, 'devils-advocate'];
  const all = [...new Set(combined)] as PersonalityType[];

  // Limit to requested count
  return all.slice(0, count);
}

/**
 * Get the system prompt addition for a personality
 */
export function getPersonalityPrompt(personality: PersonalityType): string {
  return PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS['generalist'];
}

/**
 * Get a brief description of a personality for display
 */
export function getPersonalityDescription(personality: PersonalityType): string {
  const descriptions: Record<PersonalityType, string> = {
    'methodical-analyst': 'Systematic, thorough, evidence-based analysis',
    'creative-solver': 'Unconventional thinking, innovative solutions',
    'pragmatic-engineer': 'Practical, implementation-focused approach',
    'security-focused': 'Risk-aware, security-first perspective',
    'user-advocate': 'User experience and accessibility focused',
    'devils-advocate': 'Critical thinking, challenges assumptions',
    'domain-expert': 'Deep expertise, best practices',
    generalist: 'Holistic, cross-domain perspective',
  };

  return descriptions[personality] || 'General perspective';
}

/**
 * Get all available personalities
 */
export function getAllPersonalities(): PersonalityType[] {
  return Object.keys(PERSONALITY_PROMPTS) as PersonalityType[];
}

/**
 * Validate that a string is a valid personality type
 */
export function isValidPersonality(value: string): value is PersonalityType {
  return value in PERSONALITY_PROMPTS;
}

/**
 * Get recommended personalities for optimal verification diversity
 * Based on research showing 3-5 diverse perspectives work best
 */
export function getRecommendedPersonalities(taskType?: string): {
  minimum: PersonalityType[];
  recommended: PersonalityType[];
  extended: PersonalityType[];
} {
  const base = selectPersonalities(5, taskType);

  return {
    minimum: base.slice(0, 3), // Minimum viable diversity
    recommended: base.slice(0, 4), // Optimal balance
    extended: base, // Full coverage
  };
}
