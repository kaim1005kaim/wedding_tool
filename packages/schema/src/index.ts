import { z } from 'zod';
import { lotteryResultBroadcastSchema } from './events';
export { z };

export const roomModeSchema = z.enum(['idle', 'countup', 'quiz', 'lottery']);
export const roomPhaseSchema = z.enum(['idle', 'running', 'ended']);

export const playerSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid(),
  display_name: z.string(),
  table_no: z.string().nullable().optional(),
  seat_no: z.string().nullable().optional(),
  is_present: z.boolean().default(true),
  created_at: z.string().datetime()
});

export type Player = z.infer<typeof playerSchema>;

export const leaderboardEntrySchema = z.object({
  playerId: z.string().uuid(),
  name: z.string(),
  tableNo: z.string().nullable().optional(),
  points: z.number().int().nonnegative(),
  rank: z.number().int().min(1).optional()
});

export const roomSnapshotSchema = z.object({
  room_id: z.string().uuid(),
  mode: roomModeSchema.optional().default('idle'),
  phase: roomPhaseSchema.optional().default('idle'),
  countdown_ms: z.number().int().nonnegative().default(0),
  leaderboard: z.array(leaderboardEntrySchema).default([]),
  current_quiz: z
    .object({
      quizId: z.string().uuid(),
      question: z.string(),
      choices: z.array(z.string()).length(4),
      deadlineTs: z.number().int(),
      startTs: z.number().int().optional(),
      representativeByTable: z.boolean().optional().default(true),
      suddenDeath: z.object({
        enabled: z.boolean(),
        by: z.enum(['table', 'player']),
        topK: z.number().int().positive()
      }).nullable().optional()
    })
    .nullable()
    .optional(),
  quiz_result: z
    .object({
      quizId: z.string().uuid(),
      correctIndex: z.number().int().min(0).max(3),
      perChoiceCounts: z.array(z.number().int().nonnegative()).length(4),
      awarded: z.array(
        z.object({
          playerId: z.string().uuid(),
          delta: z.number().int(),
          displayName: z.string().optional(),
          tableNo: z.string().nullable().optional(),
          latencyMs: z.number().int().nonnegative().nullable().optional()
        })
      )
    })
    .nullable()
    .optional(),
  lottery_result: lotteryResultBroadcastSchema.nullable().optional(),
  updated_at: z.union([z.string().datetime(), z.string()]).optional()
});

export const roomAdminSchema = z.object({
  room_id: z.string().uuid(),
  pin_hash: z.string(),
  disabled: z.boolean().default(false),
  updated_at: z.union([z.string().datetime(), z.string()]).optional()
});

export const playerSessionSchema = z.object({
  id: z.string().uuid(),
  room_id: z.string().uuid(),
  player_id: z.string().uuid(),
  device_fingerprint: z.string().nullable().optional(),
  created_at: z.string().datetime().optional()
});

export const adminAuditLogSchema = z.object({
  id: z.number().int().optional(),
  room_id: z.string().uuid(),
  actor: z.string(),
  action: z.string(),
  payload: z.record(z.any()).nullable().optional(),
  created_at: z.string().datetime().optional()
});

export const awardedQuizSchema = z.object({
  quiz_id: z.string().uuid(),
  room_id: z.string().uuid(),
  awarded_at: z.string().datetime().optional()
});

export type RoomSnapshot = z.infer<typeof roomSnapshotSchema>;
export type RoomAdmin = z.infer<typeof roomAdminSchema>;
export type PlayerSession = z.infer<typeof playerSessionSchema>;
export type AdminAuditLog = z.infer<typeof adminAuditLogSchema>;
export type AwardedQuiz = z.infer<typeof awardedQuizSchema>;

export * from './events';
