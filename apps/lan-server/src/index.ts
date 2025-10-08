import cors from 'cors';
import express from 'express';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { Server, type Socket } from 'socket.io';
import {
  helloEventSchema,
  lotteryDrawEventSchema,
  lotteryResultBroadcastSchema,
  modeSwitchEventSchema,
  quizAnswerEventSchema,
  quizResultBroadcastSchema,
  quizShowBroadcastSchema,
  stateUpdateBroadcastSchema,
  tapDeltaEventSchema,
  z
} from '@wedding_tool/schema';

type Mode = 'idle' | 'countup' | 'quiz' | 'lottery';
type Phase = 'idle' | 'running' | 'ended';

type PlayerState = {
  id: string;
  displayName: string;
  tableNo?: string;
  seatNo?: string;
  totalPoints: number;
  lastDelta: number;
  socketId: string;
};

type QuizState = {
  quizId: string;
  question: string;
  choices: string[];
  answerIndex: number;
  deadlineTs: number;
  answers: Map<string, number>;
};

type LotteryKind = 'all' | 'groom_friends' | 'bride_friends';

type RoomState = {
  id: string;
  mode: Mode;
  phase: Phase;
  countdownEndsAt: number | null;
  players: Map<string, PlayerState>;
  lotteryHistory: Record<LotteryKind, Set<string>>;
  currentQuiz: QuizState | null;
};

const rooms = new Map<string, RoomState>();

const PORT = parseInt(process.env.PORT ?? '5050', 10);
const COUNTDOWN_DEFAULT_MS = 10_000;
const QUIZ_DEMO_BANK = [
  {
    question: 'ふたりの出会いはどこ？',
    choices: ['大学', '職場', '友人の紹介', '結婚式パーティー'],
    answerIndex: 1
  },
  {
    question: '新郎の得意料理は？',
    choices: ['カレー', 'パスタ', '唐揚げ', 'チャーハン'],
    answerIndex: 0
  }
];

const clientEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('tap:delta'), payload: tapDeltaEventSchema }),
  z.object({ type: z.literal('quiz:answer'), payload: quizAnswerEventSchema }),
  z.object({ type: z.literal('hello'), payload: helloEventSchema })
]);

const adminEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('mode:switch'), payload: modeSwitchEventSchema }),
  z.object({ type: z.literal('game:start'), payload: z.undefined().optional() }),
  z.object({ type: z.literal('game:stop'), payload: z.undefined().optional() }),
  z.object({ type: z.literal('quiz:next'), payload: z.undefined().optional() }),
  z.object({ type: z.literal('quiz:reveal'), payload: z.undefined().optional() }),
  z.object({ type: z.literal('lottery:draw'), payload: lotteryDrawEventSchema })
]);

const eventSchema = z.union([clientEventSchema, adminEventSchema]);

function getRoom(roomId: string): RoomState {
  let room = rooms.get(roomId);
  if (!room) {
    room = {
      id: roomId,
      mode: 'idle',
      phase: 'idle',
      countdownEndsAt: null,
      players: new Map(),
      lotteryHistory: {
        all: new Set(),
        groom_friends: new Set(),
        bride_friends: new Set()
      },
      currentQuiz: null
    };
    rooms.set(roomId, room);
  }
  return room;
}

function buildLeaderboard(room: RoomState) {
  return Array.from(room.players.values())
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((player, index) => ({
      playerId: player.id,
      displayName: player.displayName,
      tableNo: player.tableNo ?? null,
      totalPoints: player.totalPoints,
      rank: index + 1,
      delta: player.lastDelta
    }));
}

function broadcastState(io: Server, room: RoomState) {
  const payload = stateUpdateBroadcastSchema.parse({
    mode: room.mode,
    phase: room.phase,
    serverTime: Date.now(),
    countdownMs: room.countdownEndsAt ? Math.max(room.countdownEndsAt - Date.now(), 0) : 0,
    leaderboard: buildLeaderboard(room)
  });
  io.to(room.id).emit('state:update', payload);
}

function broadcastQuizShow(io: Server, room: RoomState, quiz: QuizState) {
  const payload = quizShowBroadcastSchema.parse({
    quizId: quiz.quizId,
    question: quiz.question,
    choices: quiz.choices,
    deadlineTs: quiz.deadlineTs
  });
  io.to(room.id).emit('quiz:show', payload);
}

function broadcastQuizResult(io: Server, room: RoomState, quiz: QuizState) {
  const counts = quiz.choices.map((_, index) => {
    let total = 0;
    quiz.answers.forEach((choiceIndex) => {
      if (choiceIndex === index) {
        total += 1;
      }
    });
    return total;
  });

  const awarded = [] as { playerId: string; delta: number }[];
  quiz.answers.forEach((choiceIndex, playerId) => {
    if (choiceIndex === quiz.answerIndex) {
      const player = room.players.get(playerId);
      if (player) {
        player.totalPoints += 10;
        player.lastDelta = 10;
        awarded.push({ playerId: player.id, delta: 10 });
      }
    }
  });

  const payload = quizResultBroadcastSchema.parse({
    quizId: quiz.quizId,
    correctIndex: quiz.answerIndex,
    perChoiceCounts: counts,
    awarded
  });

  io.to(room.id).emit('quiz:result', payload);
  broadcastState(io, room);
}

function broadcastLotteryResult(io: Server, room: RoomState, kind: LotteryKind, player: PlayerState) {
  const payload = lotteryResultBroadcastSchema.parse({
    kind,
    player: {
      id: player.id,
      name: player.displayName,
      table_no: player.tableNo ?? null,
      seat_no: player.seatNo ?? null
    }
  });
  io.to(room.id).emit('lottery:result', payload);
}

function ensurePlayer(room: RoomState, socket: Socket, payload: z.infer<typeof helloEventSchema>) {
  if (socket.data.playerId) {
    return room.players.get(socket.data.playerId as string) ?? null;
  }

  let baseName = payload.displayName.trim();
  if (!baseName) baseName = 'Guest';
  const existingNames = new Set(Array.from(room.players.values()).map((player) => player.displayName));
  let displayName = baseName;
  let suffix = 2;
  while (existingNames.has(displayName)) {
    displayName = `${baseName}(${suffix})`;
    suffix += 1;
  }

  const player: PlayerState = {
    id: randomUUID(),
    displayName,
    tableNo: payload.tableNo ?? undefined,
    seatNo: payload.seatNo ?? undefined,
    totalPoints: 0,
    lastDelta: 0,
    socketId: socket.id
  };

  room.players.set(player.id, player);
  socket.data.playerId = player.id;
  return player;
}

function handleClientEvent(io: Server, socket: Socket, room: RoomState, event: z.infer<typeof clientEventSchema>) {
  switch (event.type) {
    case 'hello': {
      const player = ensurePlayer(room, socket, event.payload);
      if (!player) return;
      broadcastState(io, room);
      break;
    }
    case 'tap:delta': {
      const playerId = socket.data.playerId;
      if (!playerId || room.mode !== 'countup') return;
      const player = room.players.get(playerId as string);
      if (!player) return;
      player.totalPoints += event.payload.delta;
      player.lastDelta = event.payload.delta;
      broadcastState(io, room);
      break;
    }
    case 'quiz:answer': {
      const playerId = socket.data.playerId;
      if (!playerId || room.mode !== 'quiz') return;
      const quiz = room.currentQuiz;
      if (!quiz) return;
      if (Date.now() > quiz.deadlineTs) return;
      quiz.answers.set(playerId as string, event.payload.choiceIndex);
      break;
    }
    default:
      break;
  }
}

function handleAdminEvent(io: Server, room: RoomState, event: z.infer<typeof adminEventSchema>) {
  switch (event.type) {
    case 'mode:switch': {
      room.mode = event.payload.to;
      room.phase = 'idle';
      room.currentQuiz = null;
      room.players.forEach((player) => {
        player.lastDelta = 0;
      });
      broadcastState(io, room);
      break;
    }
    case 'game:start': {
      room.phase = 'running';
      room.countdownEndsAt = Date.now() + COUNTDOWN_DEFAULT_MS;
      broadcastState(io, room);
      break;
    }
    case 'game:stop': {
      room.phase = 'ended';
      room.countdownEndsAt = null;
      broadcastState(io, room);
      break;
    }
    case 'quiz:next': {
      const quizTemplate = QUIZ_DEMO_BANK[Math.floor(Math.random() * QUIZ_DEMO_BANK.length)];
      const quiz: QuizState = {
        quizId: randomUUID(),
        question: quizTemplate.question,
        choices: quizTemplate.choices,
        answerIndex: quizTemplate.answerIndex,
        deadlineTs: Date.now() + 20_000,
        answers: new Map()
      };
      room.mode = 'quiz';
      room.phase = 'running';
      room.currentQuiz = quiz;
      broadcastQuizShow(io, room, quiz);
      broadcastState(io, room);
      break;
    }
    case 'quiz:reveal': {
      const quiz = room.currentQuiz;
      if (!quiz) return;
      broadcastQuizResult(io, room, quiz);
      room.phase = 'ended';
      room.currentQuiz = null;
      break;
    }
    case 'lottery:draw': {
      const candidates = Array.from(room.players.values()).filter(
        (player) => !room.lotteryHistory[event.payload.kind].has(player.id)
      );
      if (candidates.length === 0) return;
      const winner = candidates[Math.floor(Math.random() * candidates.length)];
      room.lotteryHistory[event.payload.kind].add(winner.id);
      broadcastLotteryResult(io, room, event.payload.kind, winner);
      break;
    }
    default:
      break;
  }
}

const app = express();
app.use(cors());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', rooms: rooms.size });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*'
  }
});

io.on('connection', (socket) => {
  const initialRoomId = (socket.handshake.query.roomId as string | undefined) ?? randomUUID();
  const room = getRoom(initialRoomId);
  socket.data.roomId = room.id;
  socket.join(room.id);
  broadcastState(io, room);

  socket.on('join', (payload: { roomId: string }) => {
    const targetRoom = getRoom(payload.roomId);
    socket.rooms.forEach((joinedRoom) => {
      if (joinedRoom !== socket.id) {
        socket.leave(joinedRoom);
      }
    });
    socket.data.roomId = targetRoom.id;
    socket.join(targetRoom.id);
    broadcastState(io, targetRoom);
  });

  socket.on('event', (payload) => {
    const parseResult = eventSchema.safeParse(payload);
    if (!parseResult.success) {
      console.error('Invalid event payload', parseResult.error.issues);
      return;
    }
    const eventValue = parseResult.data;
    const activeRoomId = (socket.data.roomId as string | undefined) ?? room.id;
    const currentRoom = getRoom(activeRoomId);
    if (clientEventSchema.safeParse(eventValue).success) {
      handleClientEvent(io, socket, currentRoom, eventValue as z.infer<typeof clientEventSchema>);
    } else {
      handleAdminEvent(io, currentRoom, eventValue as z.infer<typeof adminEventSchema>);
    }
  });

  socket.on('disconnect', () => {
    const activeRoomId = (socket.data.roomId as string | undefined) ?? room.id;
    const currentRoom = getRoom(activeRoomId);
    const playerId = socket.data.playerId as string | undefined;
    if (playerId) {
      currentRoom.players.delete(playerId);
      broadcastState(io, currentRoom);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`LAN realtime server listening on port ${PORT}`);
});
