'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRoomStore } from '../lib/store/room-store';
import type { LeaderboardEntry, RoomStoreState } from '../lib/store/room-store';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

export default function ProjectorView({ roomId }: { roomId: string }) {
  const mode = useRoomStore((state) => state.mode);
  const countdownMs = useRoomStore((state) => state.countdownMs);
  const leaderboard = useRoomStore((state) => state.leaderboard);
  const activeQuiz = useRoomStore((state) => state.activeQuiz);
  const quizResult = useRoomStore((state) => state.quizResult);
  const lotteryResult = useRoomStore((state) => state.lotteryResult);

  const topTen = useMemo(() => leaderboard.slice(0, 10), [leaderboard]);
  const [lotteryKey, setLotteryKey] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);

  useEffect(() => {
    if (!lotteryResult?.player?.id) return;
    setIsSpinning(true);
    setLotteryKey((prev) => prev + 1);
    const timer = window.setTimeout(() => setIsSpinning(false), 3000);
    return () => window.clearTimeout(timer);
  }, [lotteryResult?.player?.id]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-ecru px-4 py-6 text-ink">
      <div className="relative aspect-video w-full max-w-6xl overflow-hidden rounded-[2rem] shadow-brand">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-brand-blue-50 via-transparent to-brand-terra-50" />
        <div className="relative flex h-full flex-col gap-6 px-10 py-8">
          <Header mode={mode} countdownMs={countdownMs} roomId={roomId} />
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">{renderSection(mode, topTen, activeQuiz, quizResult, lotteryResult, isSpinning, lotteryKey)}</AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}

function Header({ mode, countdownMs, roomId }: { mode: string; countdownMs: number; roomId: string }) {
  return (
    <motion.header
      key={`header-${mode}`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="glass-panel rounded-2xl px-8 py-6 shadow-brand"
    >
      <div className="flex flex-col gap-2 text-brand-blue-700/80 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.35em]">Wedding Party Game</p>
          <h1 className="text-4xl font-serif text-brand-terra-600">Room {roomId}</h1>
        </div>
        <div className="text-sm">
          <p className="text-xs uppercase tracking-[0.3em]">Current Mode</p>
          <p className="text-2xl font-semibold text-brand-blue-700">{labelForMode(mode)}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.3em]">Countdown</p>
          <p className="text-2xl font-semibold text-brand-blue-700">{Math.max(0, Math.ceil(countdownMs / 1000))} 秒</p>
        </div>
      </div>
    </motion.header>
  );
}

function renderSection(
  mode: string,
  leaderboard: LeaderboardEntry[],
  activeQuiz: RoomStoreState['activeQuiz'],
  quizResult: RoomStoreState['quizResult'],
  lotteryResult: RoomStoreState['lotteryResult'],
  isSpinning: boolean,
  lotteryKey: number
) {
  switch (mode) {
    case 'countup':
      return <CountupBoard key="countup" entries={leaderboard} />;
    case 'quiz':
      return <QuizBoard key={`quiz-${quizResult?.quizId ?? activeQuiz?.quizId ?? 'waiting'}`} activeQuiz={activeQuiz} quizResult={quizResult} />;
    case 'lottery':
      return <LotteryBoard key={lotteryKey} lotteryResult={lotteryResult} isSpinning={isSpinning} />;
    default:
      return <IdleBoard key="idle" leaderboard={leaderboard} />;
  }
}

function CountupBoard({ entries }: { entries: LeaderboardEntry[] }) {
  const firstColumn = entries.slice(0, 5);
  const secondColumn = entries.slice(5, 10);
  const columns = [firstColumn, secondColumn];

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="grid h-full gap-5 lg:grid-cols-2"
    >
      {columns.map((column, colIndex) => (
        <div key={colIndex} className="glass-panel flex flex-col rounded-2xl p-6 shadow-brand">
          <h2 className="text-xl font-semibold text-brand-blue-700">タップスコア</h2>
          <div className="mt-4 flex-1 space-y-3 overflow-hidden">
            <AnimatePresence initial={false}>
              {column.map((entry) => (
                <motion.div
                  key={entry.playerId}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 text-lg shadow-brand ${entry.rank <= 3 ? 'bg-brand-blue-50 border border-brand-terra-200' : 'bg-white/85'}`}
                >
                  <span className="font-medium text-brand-blue-700">
                    {entry.rank}. {entry.displayName}
                  </span>
                  <span className="font-semibold text-brand-terra-600">{entry.totalPoints} pt</span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      ))}
    </motion.section>
  );
}

function IdleBoard({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="glass-panel rounded-2xl p-6 text-center shadow-brand"
    >
      <h2 className="text-2xl font-semibold text-brand-blue-700">まもなくゲームが始まります</h2>
      <p className="mt-3 text-brand-blue-700/70">最新のランキングを確認して、ウォームアップしておきましょう。</p>
      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {leaderboard.slice(0, 6).map((entry) => (
          <div key={entry.playerId} className="rounded-xl bg-white/85 px-4 py-3 text-left shadow-brand">
            <span className="font-medium text-brand-blue-700">
              {entry.rank}. {entry.displayName}
            </span>
            <span className="ml-2 text-sm text-brand-blue-700/70">{entry.totalPoints} pt</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

type QuizPanelProps = {
  activeQuiz: RoomStoreState['activeQuiz'];
  quizResult: RoomStoreState['quizResult'];
};

function QuizBoard({ activeQuiz, quizResult }: QuizPanelProps) {
  const counts = quizResult?.perChoiceCounts ?? [0, 0, 0, 0];
  const total = counts.reduce((acc, value) => acc + value, 0) || 1;
  const correctIndex = quizResult?.correctIndex ?? -1;

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="glass-panel grid h-full gap-6 rounded-2xl p-6 shadow-brand lg:grid-cols-2"
    >
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-brand-blue-700">クイズ</h2>
        {activeQuiz ? (
          <>
            <p className="text-base font-medium text-brand-blue-700/90">{activeQuiz.question}</p>
            <ul className="space-y-2">
              {activeQuiz.choices.map((choice, index) => (
                <li
                  key={choice}
                  className={`rounded-xl px-4 py-3 text-sm shadow-brand ${quizResult && index === correctIndex ? 'bg-brand-terra-50 border border-brand-terra-200 text-brand-terra-700' : 'bg-white/80 text-brand-blue-700'}`}
                >
                  <span className="font-semibold">{CHOICE_LABELS[index]}</span>
                  <span className="ml-3">{choice}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-sm text-brand-blue-700/70">次のクイズを準備中です。</p>
        )}
      </div>
      <div className="space-y-3">
        {quizResult ? (
          counts.map((count, index) => {
            const ratio = Math.round((count / total) * 100);
            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-brand-blue-700/70">
                  <span>{CHOICE_LABELS[index]}</span>
                  <span>{count}票</span>
                </div>
                <div className="h-4 overflow-hidden rounded-full bg-brand-blue-50">
                  <motion.div
                    key={`${index}-${count}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${ratio}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`h-full ${index === correctIndex ? 'bg-brand-terra-400' : 'bg-brand-blue-400'}`}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-brand-blue-700/70">回答結果は正解公開後に表示されます。</p>
        )}
      </div>
    </motion.section>
  );
}

type LotteryPanelProps = {
  lotteryResult: RoomStoreState['lotteryResult'];
  isSpinning: boolean;
};

function LotteryBoard({ lotteryResult, isSpinning }: LotteryPanelProps) {
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="glass-panel flex h-full flex-col items-center justify-center gap-6 rounded-2xl px-6 py-12 text-center shadow-brand"
    >
      <span className="text-sm uppercase tracking-[0.35em] text-brand-blue-700/70">Lottery</span>
      {lotteryResult ? (
        <motion.div
          key={lotteryResult.player.id}
          initial={{ rotate: 0, scale: 0.9, opacity: 0 }}
          animate={{ rotate: isSpinning ? [0, 360, 360] : 0, scale: 1, opacity: 1 }}
          transition={{ duration: isSpinning ? 3 : 0.5, ease: 'easeOut' }}
          className="rounded-full bg-brand-terra-50 px-8 py-6 shadow-brand"
        >
          <p className="text-xs uppercase tracking-[0.35em] text-brand-terra-600">{lotteryResult.kind}</p>
          <p className="mt-3 text-4xl font-serif text-brand-terra-700">{lotteryResult.player.name}</p>
        </motion.div>
      ) : (
        <p className="text-brand-blue-700/70">抽選結果が表示されるまで今しばらくお待ちください。</p>
      )}
    </motion.section>
  );
}

function labelForMode(mode: string) {
  switch (mode) {
    case 'countup':
      return 'タップチャレンジ';
    case 'quiz':
      return 'クイズ';
    case 'lottery':
      return '抽選';
    default:
      return '待機中';
  }
}
