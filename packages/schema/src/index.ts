import { z } from 'zod';
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

export * from './events';
