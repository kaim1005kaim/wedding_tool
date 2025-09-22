'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
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
    const timer = window.setTimeout(() => setIsSpinning(false), 3200);
    return () => window.clearTimeout(timer);
  }, [lotteryResult?.player?.id]);

  return (
    <main className="min-h-screen bg-ecru px-8 py-12 text-ink">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-5xl font-serif tracking-wide text-brand-blue-700">Wedding Party Game</h1>
            <p className="text-xs uppercase tracking-[0.35em] text-brand-blue-700/70">Room {roomId}</p>
          </div>
          <div className="glass-panel rounded-2xl px-6 py-4 text-right shadow-brand">
            <p className="text-xs font-semibold uppercase text-brand-blue-700/80">現在のモード</p>
            <p className="text-2xl font-semibold text-brand-terra-600">{labelForMode(mode)}</p>
            <p className="mt-2 text-xs font-semibold uppercase text-brand-blue-700/80">残り時間</p>
            <p className="text-2xl font-semibold text-brand-blue-700">{Math.max(0, Math.ceil(countdownMs / 1000))} 秒</p>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-7">
          <RankingBoard entries={topTen} />
          <div className="col-span-7 space-y-6 lg:col-span-2">
            <QuizPanel activeQuiz={activeQuiz} quizResult={quizResult} />
            <LotteryPanel lotteryResult={lotteryResult} isSpinning={isSpinning} lotteryKey={lotteryKey} />
          </div>
        </section>
      </div>
    </main>
  );
}

function RankingBoard({ entries }: { entries: LeaderboardEntry[] }) {
  const firstColumn = entries.slice(0, 5);
  const secondColumn = entries.slice(5, 10);
  const columns = [firstColumn, secondColumn];

  return (
    <div className="col-span-7 rounded-2xl bg-white/95 p-6 shadow-brand lg:col-span-5">
      <h2 className="text-2xl font-semibold text-brand-blue-700">現在のランキング</h2>
      <LayoutGroup>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {columns.map((column, colIndex) => (
            <div key={colIndex} className="space-y-3">
              <AnimatePresence initial={false}>
                {column.map((entry, index) => (
                  <motion.div
                    key={entry.playerId}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className={`flex items-center justify-between rounded-xl px-4 py-4 text-lg shadow-brand ${index % 2 === 0 ? 'bg-brand-blue-50' : 'bg-white'} ${entry.rank <= 3 ? 'border border-brand-terra-200' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-xl font-bold text-brand-blue-700">{entry.rank}</span>
                      <span className="font-medium text-ink">{entry.displayName}</span>
                    </div>
                    <div className="text-right text-brand-terra-600">
                      <p className="text-xl font-semibold">{entry.totalPoints}</p>
                      <p className="text-xs text-brand-blue-700/60">pt</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </LayoutGroup>
    </div>
  );
}

type QuizPanelProps = {
  activeQuiz: RoomStoreState['activeQuiz'];
  quizResult: RoomStoreState['quizResult'];
};

function QuizPanel({ activeQuiz, quizResult }: QuizPanelProps) {
  if (!activeQuiz && !quizResult) {
    return (
      <div className="rounded-2xl bg-white/85 p-6 shadow-brand">
        <h3 className="text-lg font-semibold text-brand-blue-700">クイズ待機中</h3>
        <p className="mt-2 text-sm text-brand-blue-700/80">次のクイズが始まるまでお待ちください。</p>
      </div>
    );
  }

  const counts = quizResult?.perChoiceCounts ?? [0, 0, 0, 0];
  const total = counts.reduce((acc, value) => acc + value, 0) || 1;
  const correctIndex = quizResult?.correctIndex ?? -1;

  return (
    <div className="space-y-4 rounded-2xl bg-white/95 p-6 shadow-brand">
      <h3 className="text-lg font-semibold text-brand-blue-700">クイズ</h3>
      {activeQuiz && (
        <div>
          <p className="text-sm font-medium text-brand-blue-700/80">{activeQuiz.question}</p>
          <ul className="mt-3 space-y-2">
            {activeQuiz.choices.map((choice, index) => (
              <li
                key={choice}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 text-sm ${quizResult && index === correctIndex ? 'border-brand-terra-400 bg-brand-terra-50 text-brand-terra-700' : 'border-brand-blue-100 bg-white text-brand-blue-700'}`}
              >
                <span className="font-semibold">
                  {CHOICE_LABELS[index]} . {choice}
                </span>
                {quizResult && <span className="text-xs text-brand-blue-700/70">{counts[index]}票</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {quizResult && (
        <div className="mt-4 space-y-2">
          {counts.map((count, index) => {
            const ratio = Math.round((count / total) * 100);
            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-brand-blue-700/70">
                  <span>{CHOICE_LABELS[index]}</span>
                  <span>{count}票</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-brand-blue-50">
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
          })}
        </div>
      )}
    </div>
  );
}

type LotteryPanelProps = {
  lotteryResult: RoomStoreState['lotteryResult'];
  isSpinning: boolean;
  lotteryKey: number;
};

function LotteryPanel({ lotteryResult, isSpinning, lotteryKey }: LotteryPanelProps) {
  return (
    <div className="rounded-2xl bg-white/95 p-6 shadow-brand">
      <h3 className="text-lg font-semibold text-brand-blue-700">抽選</h3>
      {lotteryResult ? (
        <motion.div
          key={lotteryKey}
          initial={{ rotate: 0, scale: 0.9, opacity: 0 }}
          animate={{ rotate: isSpinning ? [0, 360, 360] : 0, scale: 1, opacity: 1 }}
          transition={{ duration: isSpinning ? 3 : 0.5, ease: 'easeOut' }}
          className="mt-6 flex flex-col items-center gap-3 text-center"
        >
          <span className="text-xs uppercase tracking-[0.25em] text-brand-blue-700/70">{lotteryResult.kind}</span>
          <span className="text-3xl font-semibold text-brand-terra-600">{lotteryResult.player.name}</span>
        </motion.div>
      ) : (
        <p className="mt-4 text-sm text-brand-blue-700/80">抽選結果が表示されると、ここに名前が登場します。</p>
      )}
    </div>
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
