/**
 * IPC Payload Validation Schemas
 *
 * Zod schemas for runtime validation of critical IPC payloads.
 * These schemas validate data crossing the main/renderer boundary.
 */

import { z } from 'zod';

// ============ Common Schemas ============

export const InstanceIdSchema = z.string().min(1).max(100);
export const SessionIdSchema = z.string().min(1).max(100);
export const DisplayNameSchema = z.string().min(1).max(200);
export const WorkingDirectorySchema = z.string().min(1).max(1000);

// ============ File Attachment Schema ============

export const FileAttachmentSchema = z.object({
  name: z.string().max(500),
  type: z.string().max(100),
  size: z.number().int().min(0).max(50 * 1024 * 1024), // 50MB max
  data: z.string().optional(), // Base64 encoded
});

// ============ Instance Creation ============

export const InstanceCreatePayloadSchema = z.object({
  workingDirectory: WorkingDirectorySchema,
  sessionId: SessionIdSchema.optional(),
  parentInstanceId: InstanceIdSchema.optional(),
  displayName: DisplayNameSchema.optional(),
  initialPrompt: z.string().max(500000).optional(),
  attachments: z.array(FileAttachmentSchema).max(10).optional(),
  yoloMode: z.boolean().optional(),
  agentId: z.string().max(100).optional(),
  provider: z.enum(['auto', 'claude', 'openai', 'codex', 'gemini', 'copilot']).optional(),
  model: z.string().max(100).optional(),
});

export type ValidatedInstanceCreatePayload = z.infer<typeof InstanceCreatePayloadSchema>;

// ============ Instance Input ============

export const InstanceSendInputPayloadSchema = z.object({
  instanceId: InstanceIdSchema,
  message: z.string().min(1).max(500000), // 500KB max message
  attachments: z.array(z.object({
    name: z.string().max(500),
    type: z.string().max(100),
    size: z.number().int().min(0).max(50 * 1024 * 1024),
    data: z.string().optional(),
  })).max(10).optional(),
});

export type InstanceSendInputPayload = z.infer<typeof InstanceSendInputPayloadSchema>;

// ============ Instance Operations ============

export const InstanceTerminatePayloadSchema = z.object({
  instanceId: InstanceIdSchema,
  graceful: z.boolean().optional().default(true),
});

export type InstanceTerminatePayload = z.infer<typeof InstanceTerminatePayloadSchema>;

export const InstanceRenamePayloadSchema = z.object({
  instanceId: InstanceIdSchema,
  displayName: DisplayNameSchema,
});

export type InstanceRenamePayload = z.infer<typeof InstanceRenamePayloadSchema>;

export const InstanceChangeAgentPayloadSchema = z.object({
  instanceId: InstanceIdSchema,
  agentId: z.string().min(1).max(100),
});

export type InstanceChangeAgentPayload = z.infer<typeof InstanceChangeAgentPayloadSchema>;

// ============ Input Required Response ============

export const InputRequiredResponsePayloadSchema = z.object({
  instanceId: InstanceIdSchema,
  requestId: z.string().min(1).max(100),
  response: z.string().min(1).max(10000),
  permissionKey: z.string().max(200).optional(),
});

export type InputRequiredResponsePayload = z.infer<typeof InputRequiredResponsePayloadSchema>;

// ============ Settings ============

export const SettingsUpdatePayloadSchema = z.object({
  key: z.string().min(1).max(100),
  value: z.unknown(), // Settings can be various types
});

export type SettingsUpdatePayload = z.infer<typeof SettingsUpdatePayloadSchema>;

// ============ User Action Response ============

export const UserActionResponsePayloadSchema = z.object({
  requestId: z.string().min(1).max(100),
  action: z.enum(['approve', 'reject', 'custom']),
  customValue: z.string().max(10000).optional(),
});

export type UserActionResponsePayload = z.infer<typeof UserActionResponsePayloadSchema>;

// ============ Orchestration Commands ============

export const SpawnChildPayloadSchema = z.object({
  parentInstanceId: InstanceIdSchema,
  task: z.string().min(1).max(100000),
  name: z.string().max(200).optional(),
  agentId: z.string().max(100).optional(),
  model: z.string().max(100).optional(),
  provider: z.enum(['auto', 'claude', 'codex', 'gemini', 'copilot']).optional(),
});

export type SpawnChildPayload = z.infer<typeof SpawnChildPayloadSchema>;

export const MessageChildPayloadSchema = z.object({
  parentInstanceId: InstanceIdSchema,
  childId: InstanceIdSchema,
  message: z.string().min(1).max(100000),
});

export type MessageChildPayload = z.infer<typeof MessageChildPayloadSchema>;

// ============ Validation Helper ============

/**
 * Validate an IPC payload against a schema.
 * Returns the validated data or throws a descriptive error.
 */
export function validateIpcPayload<T>(
  schema: z.ZodSchema<T>,
  data: unknown,
  context: string
): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const errors = result.error.issues
      .map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
      .join('; ');
    throw new Error(`IPC validation failed for ${context}: ${errors}`);
  }
  return result.data;
}

/**
 * Safe validation that returns null instead of throwing
 */
export function safeValidateIpcPayload<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): T | null {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
}
