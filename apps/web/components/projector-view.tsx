'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRoomStore } from '../lib/store/room-store';
import type { LeaderboardEntry, RoomStoreState } from '../lib/store/room-store';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

export default function ProjectorView({ roomId: _roomId }: { roomId: string }) {
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
    <main className="flex min-h-screen items-center justify-center bg-ecru px-3 py-4 text-ink">
      <div className="relative aspect-video w-full max-w-[min(1800px,100vw-24px)] overflow-hidden rounded-[2rem] shadow-brand">
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-brand-blue-50 via-transparent to-brand-terra-50" />
        <div className="relative flex h-full flex-col gap-6 px-12 py-10">
          <Header mode={mode} countdownMs={countdownMs} />
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">{renderSection(mode, topTen, activeQuiz, quizResult, lotteryResult, isSpinning, lotteryKey)}</AnimatePresence>
          </div>
        </div>
      </div>
    </main>
  );
}

function Header({ mode, countdownMs }: { mode: string; countdownMs: number }) {
  return (
    <motion.header
      key={`header-${mode}`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="glass-panel rounded-2xl px-10 py-8 shadow-brand"
    >
      <div className="flex flex-col gap-4 text-center text-brand-blue-700/80 md:flex-row md:items-center md:justify-between md:text-left">
        <div className="space-y-2">
          <p className="text-6xl font-serif font-semibold tracking-wide text-brand-terra-600 md:text-7xl">Wedding Party Game</p>
        </div>
        <div className="flex flex-col items-center gap-3 text-sm md:items-end">
          <div className="text-center md:text-right">
            <p className="text-xs uppercase tracking-[0.35em]">Current Mode</p>
            <p className="text-3xl font-semibold text-brand-blue-700">{labelForMode(mode)}</p>
          </div>
          <div className="text-center md:text-right">
            <p className="text-xs uppercase tracking-[0.35em]">Countdown</p>
            <p className="text-4xl font-semibold text-brand-blue-700">{Math.max(0, Math.ceil(countdownMs / 1000))} 秒</p>
          </div>
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
      return <LotteryBoard key={lotteryKey} lotteryResult={lotteryResult} isSpinning={isSpinning} leaderboard={leaderboard} />;
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
      className="grid h-full gap-6 lg:grid-cols-2"
    >
      {columns.map((column, colIndex) => (
        <div key={colIndex} className="glass-panel flex flex-col rounded-2xl p-8 shadow-brand">
          <h2 className="text-3xl font-semibold text-brand-blue-700">タップスコア</h2>
          <div className="mt-5 flex-1 space-y-4 overflow-hidden">
            <AnimatePresence initial={false}>
              {column.map((entry) => (
                <motion.div
                  key={entry.playerId}
                  layout
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.3 }}
                  className={`flex items-center justify-between rounded-xl px-6 py-4 text-2xl shadow-brand ${entry.rank <= 3 ? 'bg-brand-blue-50 border border-brand-terra-200' : 'bg-white/85'}`}
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
      className="glass-panel rounded-2xl p-10 text-center shadow-brand"
    >
      <h2 className="text-4xl font-semibold text-brand-blue-700">まもなくゲームが始まります</h2>
      <p className="mt-4 text-lg text-brand-blue-700/80">スマホの画面を確認してください。</p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {leaderboard.slice(0, 6).map((entry) => (
          <div key={entry.playerId} className="rounded-xl bg-white/85 px-6 py-4 text-left shadow-brand">
            <span className="text-xl font-medium text-brand-blue-700">
              {entry.rank}. {entry.displayName}
            </span>
            <span className="ml-2 text-base text-brand-blue-700/70">{entry.totalPoints} pt</span>
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
      className="glass-panel grid h-full gap-8 rounded-2xl p-10 shadow-brand lg:grid-cols-2"
    >
      <div className="space-y-6">
        <h2 className="text-4xl font-semibold text-brand-blue-700">クイズ</h2>
        {activeQuiz ? (
          <>
            <p className="text-2xl font-medium leading-relaxed text-brand-blue-700/90">{activeQuiz.question}</p>
            <ul className="space-y-3">
              {activeQuiz.choices.map((choice, index) => (
                <li
                  key={choice}
                  className={`rounded-2xl px-6 py-4 text-xl shadow-brand ${quizResult && index === correctIndex ? 'bg-brand-terra-50 border border-brand-terra-200 text-brand-terra-700' : 'bg-white/80 text-brand-blue-700'}`}
                >
                  <span className="font-semibold">{CHOICE_LABELS[index]}</span>
                  <span className="ml-4">{choice}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-xl text-brand-blue-700/70">次のクイズを準備中です。</p>
        )}
      </div>
      <div className="space-y-4">
        {quizResult ? (
          counts.map((count, index) => {
            const ratio = Math.round((count / total) * 100);
            return (
              <div key={index} className="space-y-1">
                <div className="flex items-center justify-between text-base text-brand-blue-700/70">
                  <span>{CHOICE_LABELS[index]}</span>
                  <span>{count}票</span>
                </div>
                <div className="h-6 overflow-hidden rounded-full bg-brand-blue-50">
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
          <p className="text-xl text-brand-blue-700/70">回答結果は正解公開後に表示されます。</p>
        )}
      </div>
    </motion.section>
  );
}

type LotteryPanelProps = {
  lotteryResult: RoomStoreState['lotteryResult'];
  isSpinning: boolean;
  leaderboard: LeaderboardEntry[];
};

function LotteryBoard({ lotteryResult, isSpinning, leaderboard }: LotteryPanelProps) {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [displayKind, setDisplayKind] = useState<string | null>(null);
  const [isRevealing, setIsRevealing] = useState(false);
  const prevWinnerRef = useRef<string | null>(null);
  const revealTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sequenceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (revealTimeoutRef.current) {
      clearTimeout(revealTimeoutRef.current);
      revealTimeoutRef.current = null;
    }
    if (sequenceTimeoutRef.current) {
      clearTimeout(sequenceTimeoutRef.current);
      sequenceTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  useEffect(() => {
    const winnerId = lotteryResult?.player?.id ?? null;
    if (!winnerId || winnerId === prevWinnerRef.current) {
      return;
    }

    prevWinnerRef.current = winnerId;
    clearTimers();
    setIsRevealing(false);
    setDisplayName(null);
    setDisplayKind(null);

    const finalName = lotteryResult.player.name;
    const candidatePool = Array.from(
      new Set(
        leaderboard
          .map((entry) => entry.displayName)
          .filter((name): name is string => Boolean(name && name.trim().length > 0 && name !== finalName))
      )
    );
    if (candidatePool.length === 0) {
      candidatePool.push('???');
    }

    const fakeCount = Math.min(6, candidatePool.length);
    const fakeNames: string[] = [];
    for (let i = 0; i < fakeCount; i += 1) {
      const randomName = candidatePool[Math.floor(Math.random() * candidatePool.length)];
      fakeNames.push(randomName);
    }

    if (Math.random() < 0.65 && fakeNames.length > 1) {
      const slipIndex = Math.floor(Math.random() * fakeNames.length);
      fakeNames.splice(slipIndex, 0, finalName);
    }

    const sequence = [...fakeNames, finalName];
    let step = 0;

    setIsRevealing(true);
    setDisplayKind(labelForLotteryKind(lotteryResult.kind));

    const runStep = () => {
      const name = sequence[step];
      setDisplayName(name);
      const isFinal = step === sequence.length - 1;
      step += 1;

      if (isFinal) {
        sequenceTimeoutRef.current = null;
        revealTimeoutRef.current = setTimeout(() => {
          setIsRevealing(false);
          setDisplayName(null);
          setDisplayKind(null);
        }, 5000);
        return;
      }

      const delay = 220 + Math.random() * 160;
      sequenceTimeoutRef.current = setTimeout(runStep, delay);
    };

    runStep();

    return () => {
      clearTimers();
    };
  }, [clearTimers, leaderboard, lotteryResult]);

  const waiting = !displayName && !isRevealing;

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="glass-panel flex h-full flex-col items-center justify-center gap-10 rounded-2xl px-12 py-20 text-center shadow-brand"
    >
      <span className="text-xl uppercase tracking-[0.45em] text-brand-blue-700/70">Lottery</span>
      {waiting ? (
        <div className="space-y-6 text-brand-blue-700/70">
          <p className="text-3xl font-semibold text-brand-blue-700">抽選カテゴリを選んでください</p>
          <div className="flex flex-col items-center gap-4 text-2xl">
            <span>・全員対象</span>
            <span>・新郎友人</span>
            <span>・新婦友人</span>
          </div>
        </div>
      ) : (
        <motion.div
          key={displayName ?? 'lottery-waiting'}
          initial={{ rotate: 0, scale: 0.85, opacity: 0 }}
          animate={{ rotate: isSpinning ? [0, 360, 360] : 0, scale: 1, opacity: 1 }}
          transition={{ duration: isSpinning ? 3 : 0.6, ease: 'easeOut' }}
          className="rounded-[3.5rem] bg-brand-terra-50 px-16 py-14 shadow-brand"
        >
          {displayKind ? (
            <p className="text-lg uppercase tracking-[0.5em] text-brand-terra-600">{displayKind}</p>
          ) : null}
          <p className="mt-6 text-[min(12vw,11rem)] font-serif font-bold text-brand-terra-700">{displayName}</p>
        </motion.div>
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

function labelForLotteryKind(kind: string | undefined) {
  switch (kind) {
    case 'all':
      return '全員対象';
    case 'groom_friends':
      return '新郎友人';
    case 'bride_friends':
      return '新婦友人';
    case 'escort':
      return 'エスコート';
    case 'cake_groom':
      return 'ケーキ (新郎)';
    case 'cake_bride':
      return 'ケーキ (新婦)';
    default:
      return '抽選';
  }
}
