import { z } from 'zod';

export const playerIdentifierSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  table_no: z.string().nullable().optional(),
  seat_no: z.string().nullable().optional()
});

export const tapDeltaEventSchema = z.object({
  delta: z.number().int().min(1).max(30)
});

export const quizAnswerEventSchema = z.object({
  quizId: z.string().uuid(),
  choiceIndex: z.number().int().min(0).max(3)
});

export const helloEventSchema = z.object({
  displayName: z.string().min(1).max(32),
  tableNo: z.string().max(8).optional().nullable(),
  seatNo: z.string().max(8).optional().nullable()
});

export const modeSwitchEventSchema = z.object({
  to: z.enum(['idle', 'countup', 'quiz', 'lottery'])
});

const legacyLotteryKinds = ['escort', 'cake_groom', 'cake_bride'] as const;
const currentLotteryKinds = ['all', 'groom_friends', 'bride_friends'] as const;

export const lotteryDrawEventSchema = z.object({
  kind: z.enum(currentLotteryKinds)
});

const lotteryKindSchema = z.enum([...currentLotteryKinds, ...legacyLotteryKinds] as const);

export const quizShowBroadcastSchema = z.object({
  quizId: z.string().uuid(),
  question: z.string(),
  choices: z.array(z.string()).length(4),
  deadlineTs: z.number()
});

export const quizResultBroadcastSchema = z.object({
  quizId: z.string().uuid(),
  correctIndex: z.number().int().min(0).max(3),
  perChoiceCounts: z.array(z.number().int().min(0)).length(4),
  awarded: z.array(z.object({
    playerId: z.string().uuid(),
    delta: z.number().int()
  }))
});

export const lotteryResultBroadcastSchema = z.object({
  kind: lotteryKindSchema,
  player: playerIdentifierSchema
});

export const stateUpdateBroadcastSchema = z.object({
  mode: z.enum(['countup', 'quiz', 'lottery', 'idle']),
  phase: z.enum(['idle', 'running', 'ended']),
  serverTime: z.number(),
  countdownMs: z.number().nonnegative(),
  leaderboard: z.array(
    z.object({
      playerId: z.string().uuid(),
      displayName: z.string(),
      tableNo: z.string().nullable().optional(),
      totalPoints: z.number().int().nonnegative(),
      rank: z.number().int().min(1),
      delta: z.number().int()
    })
  ),
  activeQuiz: quizShowBroadcastSchema.nullable().optional(),
  quizResult: quizResultBroadcastSchema.nullable().optional(),
  lotteryResult: lotteryResultBroadcastSchema.nullable().optional()
});

export const realtimePayloads = {
  client: {
    tap: tapDeltaEventSchema,
    quizAnswer: quizAnswerEventSchema,
    hello: helloEventSchema
  },
  admin: {
    modeSwitch: modeSwitchEventSchema,
    gameStart: z.undefined(),
    gameStop: z.undefined(),
    quizNext: z.undefined(),
    quizReveal: z.undefined(),
    lotteryDraw: lotteryDrawEventSchema
  },
  broadcast: {
    stateUpdate: stateUpdateBroadcastSchema,
    quizShow: quizShowBroadcastSchema,
    quizResult: quizResultBroadcastSchema,
    lotteryResult: lotteryResultBroadcastSchema
  }
};

export type TapDeltaPayload = z.infer<typeof tapDeltaEventSchema>;
export type QuizAnswerPayload = z.infer<typeof quizAnswerEventSchema>;
export type HelloPayload = z.infer<typeof helloEventSchema>;
export type StateUpdatePayload = z.infer<typeof stateUpdateBroadcastSchema>;
export type QuizShowPayload = z.infer<typeof quizShowBroadcastSchema>;
export type QuizResultPayload = z.infer<typeof quizResultBroadcastSchema>;
export type LotteryResultPayload = z.infer<typeof lotteryResultBroadcastSchema>;
