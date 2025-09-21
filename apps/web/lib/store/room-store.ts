import { create } from 'zustand';
import type {
  LotteryResultPayload,
  QuizResultPayload,
  QuizShowPayload,
  StateUpdatePayload
} from '@wedding_tool/schema';

export type RoomView = 'idle' | 'countup' | 'quiz' | 'lottery';

export type LeaderboardEntry = {
  playerId: string;
  displayName: string;
  totalPoints: number;
  rank: number;
  delta: number;
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
};

export type RoomStoreActions = {
  setRoomId: (roomId: string) => void;
  hydrateFromState: (payload: StateUpdatePayload) => void;
  setActiveQuiz: (payload: QuizShowPayload | null) => void;
  setQuizResult: (payload: QuizResultPayload | null) => void;
  setLotteryResult: (payload: LotteryResultPayload | null) => void;
  clearTransient: () => void;
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
  lotteryResult: null
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
      leaderboard: payload.leaderboard
    }),
  setActiveQuiz: (payload) => set({ activeQuiz: payload, quizResult: null }),
  setQuizResult: (payload) => set({ quizResult: payload }),
  setLotteryResult: (payload) => set({ lotteryResult: payload }),
  clearTransient: () => set({ activeQuiz: null, quizResult: null, lotteryResult: null })
}));
