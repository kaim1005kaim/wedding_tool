import { create } from 'zustand';
import type {
  LotteryResultPayload,
  QuizResultPayload,
  QuizShowPayload,
  StateUpdatePayload
} from '@wedding_tool/schema';

export type RoomView = 'idle' | 'countup' | 'countup_practice' | 'quiz' | 'buzzer' | 'lottery';

export type LeaderboardEntry = {
  playerId: string;
  displayName: string;
  furigana?: string;
  tableNo?: string | null;
  totalPoints: number;
  rank: number;
  delta: number;
  quizPoints: number;
  countupTapCount: number;
};

export type TableRepresentative = {
  tableNo: string;
  name: string;
  furigana?: string;
};

export type RoomStoreState = {
  roomId: string | null;
  mode: RoomView;
  phase: 'idle' | 'running' | 'ended';
  serverTime: number;
  countdownMs: number;
  leaderboard: LeaderboardEntry[];
  activeQuiz: QuizShowPayload | null;
  quizResult: QuizResultPayload | null;
  lotteryResult: LotteryResultPayload | null;
  representatives: TableRepresentative[];
  showRanking: boolean;
  showCelebration: boolean;
  showRepresentatives: boolean;
  playerId: string | null;
  playerToken: string | null;
};

export type RoomStoreActions = {
  setRoomId: (roomId: string) => void;
  hydrateFromState: (payload: StateUpdatePayload) => void;
  setActiveQuiz: (payload: QuizShowPayload | null) => void;
  setQuizResult: (payload: QuizResultPayload | null) => void;
  setLotteryResult: (payload: LotteryResultPayload | null) => void;
  clearTransient: () => void;
  setPlayerAuth: (auth: { playerId: string; token: string }) => void;
  clearPlayerAuth: () => void;
};

const initialState: RoomStoreState = {
  roomId: null,
  mode: 'idle',
  phase: 'idle',
  serverTime: 0,
  countdownMs: 0,
  leaderboard: [],
  activeQuiz: null,
  quizResult: null,
  lotteryResult: null,
  representatives: [],
  showRanking: false,
  showCelebration: false,
  showRepresentatives: false,
  playerId: null,
  playerToken: null
};

export const useRoomStore = create<RoomStoreState & RoomStoreActions>((set) => ({
  ...initialState,
  setRoomId: (roomId) => set({ roomId }),
  hydrateFromState: (payload) =>
    set({
      mode: payload.mode,
      phase: payload.phase,
      serverTime: payload.serverTime,
      countdownMs: payload.countdownMs,
      leaderboard: payload.leaderboard.map((entry) => ({
        playerId: entry.playerId,
        displayName: entry.displayName,
        tableNo: entry.tableNo ?? null,
        totalPoints: entry.totalPoints,
        rank: entry.rank,
        delta: entry.delta ?? 0,
        quizPoints: entry.quizPoints ?? 0,
        countupTapCount: entry.countupTapCount ?? 0
      })),
      activeQuiz: payload.activeQuiz ?? null,
      quizResult: payload.quizResult ?? null,
      lotteryResult: payload.lotteryResult ?? null,
      representatives: payload.representatives ?? [],
      showRanking: payload.showRanking ?? false,
      showCelebration: payload.showCelebration ?? false,
      showRepresentatives: payload.showRepresentatives ?? false
    }),
  setActiveQuiz: (payload) => set({ activeQuiz: payload, quizResult: null }),
  setQuizResult: (payload) => {
    console.log('[RoomStore] setQuizResult called:', payload);
    set({ quizResult: payload });
  },
  setLotteryResult: (payload) => set({ lotteryResult: payload }),
  clearTransient: () => set({ activeQuiz: null, quizResult: null, lotteryResult: null }),
  setPlayerAuth: ({ playerId, token }) => set({ playerId, playerToken: token }),
  clearPlayerAuth: () => set({ playerId: null, playerToken: null })
}));
