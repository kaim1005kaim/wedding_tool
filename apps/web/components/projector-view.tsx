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
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!lotteryResult?.player?.id) return;
    setIsSpinning(true);
    setLotteryKey((prev) => prev + 1);
    const timer = window.setTimeout(() => setIsSpinning(false), 3000);
    return () => window.clearTimeout(timer);
  }, [lotteryResult?.player?.id]);

  // Fullscreen toggle
  const toggleFullscreen = useCallback(async () => {
    if (!document.fullscreenElement) {
      try {
        await containerRef.current?.requestFullscreen();
        setIsFullscreen(true);
      } catch (err) {
        console.error('Failed to enter fullscreen:', err);
      }
    } else {
      try {
        await document.exitFullscreen();
        setIsFullscreen(false);
      } catch (err) {
        console.error('Failed to exit fullscreen:', err);
      }
    }
  }, []);

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // F key or F11 for fullscreen
      if (e.key === 'f' || e.key === 'F' || e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      }
      // ESC to exit fullscreen (browser default, but we handle state)
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [toggleFullscreen, isFullscreen]);

  return (
    <main
      ref={containerRef}
      className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-blue-100 via-ecru to-brand-terra-100 text-ink"
      style={{ padding: isFullscreen ? '0' : '1.5rem' }}
    >
      <div className={`relative aspect-video w-full overflow-hidden shadow-brand-xl ${isFullscreen ? 'max-w-none rounded-none h-screen' : 'max-w-[1920px] rounded-3xl'}`}>
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-brand-blue-50/50 via-transparent to-brand-terra-50/50" />
        <div className={`relative flex h-full flex-col ${isFullscreen ? 'gap-8 px-16 py-12' : 'gap-6 px-12 py-8'}`}>
          <Header mode={mode} countdownMs={countdownMs} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">{renderSection(mode, topTen, activeQuiz, quizResult, lotteryResult, isSpinning, lotteryKey)}</AnimatePresence>
          </div>
        </div>
      </div>

      {/* Fullscreen hint - only show when not in fullscreen */}
      {!isFullscreen && (
        <div className="fixed bottom-8 right-8 z-50 rounded-xl bg-white/90 px-4 py-3 shadow-brand-lg backdrop-blur-sm slide-up">
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 text-sm font-semibold text-brand-blue-700 transition-colors hover:text-brand-terra-600"
          >
            <span className="text-xl">⛶</span>
            <div className="text-left">
              <p>全画面表示</p>
              <p className="text-xs text-brand-blue-700/60">F キー</p>
            </div>
          </button>
        </div>
      )}
    </main>
  );
}

function Header({
  mode,
  countdownMs,
  isFullscreen,
  onToggleFullscreen
}: {
  mode: string;
  countdownMs: number;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}) {
  const modeIcon = mode === 'countup' ? '⚡' : mode === 'quiz' ? '🎯' : mode === 'lottery' ? '🎰' : '🎮';
  const countdown = Math.max(0, Math.ceil(countdownMs / 1000));

  return (
    <motion.header
      key={`header-${mode}`}
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="glass-panel-strong rounded-3xl px-12 py-10 shadow-brand-lg"
    >
      <div className="flex flex-col gap-6 text-center md:flex-row md:items-center md:justify-between md:text-left">
        <div className="flex items-center justify-center gap-6 md:justify-start">
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-secondary text-5xl shadow-brand-md">
            {modeIcon}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.4em] text-brand-blue-700/70">Wedding Party Game</p>
            <p className="text-display-sm font-serif font-bold tracking-tight text-brand-terra-600">
              {labelForMode(mode)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-white/80 px-8 py-4 shadow-brand-sm backdrop-blur-sm">
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-brand-blue-700/70">Countdown</p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <p className="text-display-sm font-bold text-brand-blue-700 count-up">{countdown}</p>
              <p className="text-2xl font-semibold text-brand-blue-700/60">秒</p>
            </div>
          </div>
          {!isFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/80 text-2xl shadow-brand-sm backdrop-blur-sm transition-all duration-300 hover:scale-110 hover:bg-brand-blue-50 hover:shadow-brand"
              title="全画面表示 (F キー)"
            >
              ⛶
            </button>
          )}
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
  // Top 3 highlighted, rest in compact grid
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex h-full flex-col gap-6"
    >
      {/* Top 3 - Large Display */}
      <div className="grid grid-cols-3 gap-4">
        {top3.map((entry) => (
          <motion.div
            key={entry.playerId}
            layout
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className={`glass-panel-strong flex flex-col items-center rounded-2xl p-6 shadow-brand-lg ${
              entry.rank === 1
                ? 'bg-gradient-to-br from-yellow-100 to-yellow-50 border-3 border-yellow-400'
                : entry.rank === 2
                  ? 'bg-gradient-to-br from-gray-100 to-gray-50 border-3 border-gray-400'
                  : 'bg-gradient-to-br from-orange-100 to-orange-50 border-3 border-orange-400'
            }`}
          >
            <div
              className={`mb-3 flex h-16 w-16 items-center justify-center rounded-full text-4xl ${
                entry.rank === 1
                  ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white'
                  : entry.rank === 2
                    ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white'
                    : 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
              }`}
            >
              {['🥇', '🥈', '🥉'][entry.rank - 1]}
            </div>
            <p className="mb-1 text-center text-xl font-bold text-brand-blue-700">{entry.displayName}</p>
            {entry.tableNo && <p className="mb-2 text-sm text-brand-blue-700/60">テーブル {entry.tableNo}</p>}
            <div className="rounded-full bg-brand-terra-600 px-5 py-2 shadow-md">
              <span className="text-2xl font-bold text-white">{entry.totalPoints}</span>
              <span className="ml-1 text-sm text-white/80">pt</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Rest - Compact Grid */}
      {rest.length > 0 && (
        <div className="glass-panel-strong flex-1 overflow-auto rounded-2xl p-6 shadow-brand">
          <div className="grid grid-cols-4 gap-2">
            {rest.map((entry) => (
              <div
                key={entry.playerId}
                className="flex items-center justify-between rounded-lg bg-white/90 px-3 py-2 text-sm shadow-sm"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue-100 text-xs font-bold text-brand-blue-700">
                    {entry.rank}
                  </span>
                  <span className="truncate font-semibold text-brand-blue-700">{entry.displayName}</span>
                </div>
                <span className="ml-2 shrink-0 font-bold text-brand-terra-700">{entry.totalPoints}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
}

function IdleBoard({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex h-full flex-col gap-6"
    >
      <div className="glass-panel rounded-2xl p-8 text-center shadow-brand">
        <h2 className="text-4xl font-semibold text-brand-blue-700">まもなくゲームが始まります</h2>
        <p className="mt-4 text-lg text-brand-blue-700/80">スマホの画面を確認してください。</p>
      </div>

      {leaderboard.length > 0 && (
        <>
          {/* Top 3 */}
          {top3.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {top3.map((entry) => (
                <div
                  key={entry.playerId}
                  className={`glass-panel-strong flex flex-col items-center rounded-2xl p-6 shadow-brand-lg ${
                    entry.rank === 1
                      ? 'bg-gradient-to-br from-yellow-100 to-yellow-50 border-3 border-yellow-400'
                      : entry.rank === 2
                        ? 'bg-gradient-to-br from-gray-100 to-gray-50 border-3 border-gray-400'
                        : 'bg-gradient-to-br from-orange-100 to-orange-50 border-3 border-orange-400'
                  }`}
                >
                  <div
                    className={`mb-3 flex h-16 w-16 items-center justify-center rounded-full text-4xl ${
                      entry.rank === 1
                        ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white'
                        : entry.rank === 2
                          ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white'
                          : 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
                    }`}
                  >
                    {['🥇', '🥈', '🥉'][entry.rank - 1]}
                  </div>
                  <p className="mb-1 text-center text-xl font-bold text-brand-blue-700">{entry.displayName}</p>
                  {entry.tableNo && <p className="mb-2 text-sm text-brand-blue-700/60">テーブル {entry.tableNo}</p>}
                  <div className="rounded-full bg-brand-terra-600 px-5 py-2 shadow-md">
                    <span className="text-2xl font-bold text-white">{entry.totalPoints}</span>
                    <span className="ml-1 text-sm text-white/80">pt</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rest */}
          {rest.length > 0 && (
            <div className="glass-panel-strong flex-1 overflow-auto rounded-2xl p-6 shadow-brand">
              <div className="grid grid-cols-4 gap-2">
                {rest.map((entry) => (
                  <div
                    key={entry.playerId}
                    className="flex items-center justify-between rounded-lg bg-white/90 px-3 py-2 text-sm shadow-sm"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue-100 text-xs font-bold text-brand-blue-700">
                        {entry.rank}
                      </span>
                      <span className="truncate font-semibold text-brand-blue-700">{entry.displayName}</span>
                    </div>
                    <span className="ml-2 shrink-0 font-bold text-brand-terra-700">{entry.totalPoints}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
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

  // Get background image based on question number (ord)
  // Q1-Q5 use respective colors, Q6+ use Q1 color
  const backgroundOrd = activeQuiz?.ord ? Math.min(activeQuiz.ord, 5) : 1;
  const backgroundImage = `/quiz-backgrounds/${backgroundOrd}-view.png`;

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="glass-panel grid h-full gap-8 rounded-2xl p-10 shadow-brand lg:grid-cols-2"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      <div className="space-y-6">
        <h2 className="text-4xl font-semibold text-brand-blue-700">クイズ</h2>
        {activeQuiz ? (
          <>
            <p className="text-2xl font-medium leading-relaxed text-brand-blue-700/90">{activeQuiz.question}</p>
            <ul className="grid gap-4 md:grid-cols-2">
              {activeQuiz.choices.map((choice, index) => (
                <li
                  key={choice}
                  className={`rounded-2xl px-8 py-6 text-2xl shadow-brand ${quizResult && index === correctIndex ? 'bg-brand-terra-50 border border-brand-terра-200 text-brand-terра-700' : 'bg-white/80 text-brand-blue-700'}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-3xl font-semibold">{CHOICE_LABELS[index]}</span>
                    <span className="flex-1 truncate text-left">{choice}</span>
                  </div>
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
    const currentResult = lotteryResult;
    if (!currentResult?.player) {
      return;
    }
    const winnerId = currentResult.player.id;
    if (!winnerId || winnerId === prevWinnerRef.current) {
      return;
    }

    prevWinnerRef.current = winnerId;
    clearTimers();
    setIsRevealing(false);
    setDisplayName(null);
    setDisplayKind(null);

    const finalName = currentResult.player.name;
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
    setDisplayKind(labelForLotteryKind(currentResult.kind));

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
