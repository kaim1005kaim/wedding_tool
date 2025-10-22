'use client';

import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import dynamic from 'next/dynamic';
import { AnimatePresence, motion } from 'framer-motion';
import { useRoomStore } from '../lib/store/room-store';
import type { LeaderboardEntry, RoomStoreState } from '../lib/store/room-store';
import ParticleEffect from './ParticleEffect';
import type { ParticleConfig } from './ParticleEffect';

const ProjectorGradientClient = dynamic(() => import('./ProjectorGradientClient'), {
  ssr: false,
  loading: () => <div className="fixed inset-0 -z-10 bg-gradient-earth" />
});

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
  const [particleTrigger, setParticleTrigger] = useState<ParticleConfig | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevModeRef = useRef<typeof mode>();

  useEffect(() => {
    if (!lotteryResult?.player?.id) return;
    setIsSpinning(true);
    setLotteryKey((prev) => prev + 1);
    const timer = window.setTimeout(() => setIsSpinning(false), 3000);
    return () => window.clearTimeout(timer);
  }, [lotteryResult?.player?.id]);

  // Trigger particles on mode transitions
  useEffect(() => {
    if (prevModeRef.current !== undefined && prevModeRef.current !== mode) {
      // Emit particles at center of screen on mode change
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      const colors: Array<'red' | 'blue' | 'yellow'> = ['red', 'blue', 'yellow'];
      const shapes: Array<'circle' | 'square' | 'triangle'> = ['circle', 'square', 'triangle'];

      setParticleTrigger({
        x: centerX,
        y: centerY,
        count: 50,
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        color: colors[Math.floor(Math.random() * colors.length)],
        size: 12,
        velocity: 200,
        spread: 2
      });
    }
    prevModeRef.current = mode;
  }, [mode]);

  // Trigger particles on quiz result reveal
  useEffect(() => {
    if (quizResult) {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      setParticleTrigger({
        x: centerX,
        y: centerY,
        count: 40,
        shape: 'circle',
        color: 'yellow',
        size: 15,
        velocity: 180,
        spread: 1.8
      });
    }
  }, [quizResult]);

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
      className="flex min-h-screen items-center justify-center relative overflow-hidden"
      style={{ padding: isFullscreen ? '0' : '1.5rem' }}
      role="main"
      aria-label="投影画面"
    >
      <ProjectorGradientClient />

      <div className={`relative aspect-video w-full overflow-hidden shadow-xl z-10 ${isFullscreen ? 'max-w-none rounded-none h-screen' : 'max-w-[1920px] rounded-2xl'}`} role="region" aria-label="ゲーム表示エリア">
        <div className={`relative flex h-full flex-col glass-panel-strong ${isFullscreen ? 'gap-6 px-12 py-10' : 'gap-5 px-10 py-8'}`}>
          <Header mode={mode} countdownMs={countdownMs} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />
          <div className="flex-1 overflow-hidden">
            <AnimatePresence mode="wait">{renderSection(mode, topTen, activeQuiz, quizResult, lotteryResult, isSpinning, lotteryKey)}</AnimatePresence>
          </div>
        </div>
      </div>

      {/* Fullscreen hint - only show when not in fullscreen */}
      {!isFullscreen && (
        <div className="fixed bottom-8 right-8 z-50 rounded-xl glass-panel-strong shadow-lg px-4 py-3 slide-up border border-white/30" role="complementary" aria-label="全画面表示のヒント">
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-2 text-sm font-bold text-ink transition-colors hover:text-denim-deep"
            aria-label="全画面表示に切り替え (Fキー)"
          >
            <span className="text-xl" aria-hidden="true">⛶</span>
            <div className="text-left">
              <p>全画面表示</p>
              <p className="text-xs text-ink/60">F キー</p>
            </div>
          </button>
        </div>
      )}
      <ParticleEffect trigger={particleTrigger} />
    </main>
  );
}

const Header = memo(function Header({
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
      className="rounded-2xl glass-panel-strong px-10 py-8 shadow-lg border border-white/30"
    >
      <div className="flex flex-col gap-5 text-center md:flex-row md:items-center md:justify-between md:text-left">
        <div className="flex items-center justify-center gap-5 md:justify-start">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-terracotta text-4xl shadow-md">
            {modeIcon}
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-ink/60">Wedding Party Game</p>
            <p className="text-3xl font-bold tracking-tight text-ink">
              {labelForMode(mode)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-xl glass-panel px-6 py-3 shadow-sm border border-white/20">
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-ink/60">Countdown</p>
            <div className="mt-1 flex items-center justify-center gap-2">
              <p className="text-4xl font-bold text-terra-clay count-up">{countdown}</p>
              <p className="text-xl font-bold text-ink/70">秒</p>
            </div>
          </div>
          {!isFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className="flex h-14 w-14 items-center justify-center rounded-xl glass-panel text-2xl shadow-sm border border-white/20 transition-all duration-300 hover:scale-110 hover:bg-gradient-denim hover:text-white"
              title="全画面表示 (F キー)"
            >
              ⛶
            </button>
          )}
        </div>
      </div>
    </motion.header>
  );
});

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

const CountupBoard = memo(function CountupBoard({ entries }: { entries: LeaderboardEntry[] }) {
  // Top 3 highlighted, rest in compact grid
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex h-full flex-col gap-5"
      role="region"
      aria-label="タップチャレンジランキング"
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
            className={`flex flex-col items-center rounded-2xl p-6 shadow-lg glass-panel-strong border border-white/30 ${
              entry.rank === 1
                ? 'ring-2 ring-accent-400'
                : entry.rank === 2
                  ? 'ring-2 ring-denim-sky'
                  : 'ring-2 ring-terra-clay'
            }`}
          >
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full text-3xl glass-panel shadow-md">
              {['🥇', '🥈', '🥉'][entry.rank - 1]}
            </div>
            <p className="mb-1 text-center text-xl font-bold text-ink">{entry.displayName}</p>
            {entry.tableNo && <p className="mb-2 text-sm text-ink/70 font-bold">テーブル {entry.tableNo}</p>}
            <div className="rounded-full glass-panel px-5 py-2 shadow-md">
              <span className="text-2xl font-bold text-terra-clay">{entry.totalPoints}</span>
              <span className="ml-1 text-sm text-ink/80 font-bold">pt</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Rest - Compact Grid */}
      {rest.length > 0 && (
        <div className="flex-1 overflow-auto rounded-2xl p-5 shadow-md glass-panel-strong border border-white/30">
          <div className="grid grid-cols-4 gap-2">
            {rest.map((entry) => (
              <div
                key={entry.playerId}
                className="flex items-center justify-between rounded-lg glass-panel px-3 py-2 text-sm shadow-sm border border-white/20"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-terracotta text-xs font-bold text-white">
                    {entry.rank}
                  </span>
                  <span className="truncate font-bold text-ink">{entry.displayName}</span>
                </div>
                <span className="ml-2 shrink-0 font-bold text-terra-clay">{entry.totalPoints}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.section>
  );
});

const IdleBoard = memo(function IdleBoard({ leaderboard }: { leaderboard: LeaderboardEntry[] }) {
  const top3 = leaderboard.slice(0, 3);
  const rest = leaderboard.slice(3);

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex h-full flex-col gap-5"
    >
      <div className="rounded-2xl glass-panel-strong p-8 text-center shadow-lg border border-white/30">
        <h2 className="text-3xl font-bold text-ink">まもなくゲームが始まります</h2>
        <p className="mt-3 text-lg text-ink/80 font-bold">スマホの画面を確認してください。</p>
      </div>

      {leaderboard.length > 0 && (
        <>
          {/* Top 3 */}
          {top3.length > 0 && (
            <div className="grid grid-cols-3 gap-4">
              {top3.map((entry) => (
                <div
                  key={entry.playerId}
                  className={`flex flex-col items-center rounded-2xl p-6 shadow-lg glass-panel-strong border border-white/30 ${
                    entry.rank === 1
                      ? 'ring-2 ring-accent-400'
                      : entry.rank === 2
                        ? 'ring-2 ring-denim-sky'
                        : 'ring-2 ring-terra-clay'
                  }`}
                >
                  <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full text-3xl glass-panel shadow-md">
                    {['🥇', '🥈', '🥉'][entry.rank - 1]}
                  </div>
                  <p className="mb-1 text-center text-xl font-bold text-ink">{entry.displayName}</p>
                  {entry.tableNo && <p className="mb-2 text-sm text-ink/70 font-bold">テーブル {entry.tableNo}</p>}
                  <div className="rounded-full glass-panel px-5 py-2 shadow-md">
                    <span className="text-2xl font-bold text-terra-clay">{entry.totalPoints}</span>
                    <span className="ml-1 text-sm text-ink/80 font-bold">pt</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Rest */}
          {rest.length > 0 && (
            <div className="flex-1 overflow-auto rounded-2xl p-5 shadow-md glass-panel-strong border border-white/30">
              <div className="grid grid-cols-4 gap-2">
                {rest.map((entry) => (
                  <div
                    key={entry.playerId}
                    className="flex items-center justify-between rounded-lg glass-panel px-3 py-2 text-sm shadow-sm border border-white/20"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-terracotta text-xs font-bold text-white">
                        {entry.rank}
                      </span>
                      <span className="truncate font-bold text-ink">{entry.displayName}</span>
                    </div>
                    <span className="ml-2 shrink-0 font-bold text-terra-clay">{entry.totalPoints}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </motion.section>
  );
});

type QuizPanelProps = {
  activeQuiz: RoomStoreState['activeQuiz'];
  quizResult: RoomStoreState['quizResult'];
};

const QuizBoard = memo(function QuizBoard({ activeQuiz, quizResult }: QuizPanelProps) {
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
      className="grid h-full gap-6 rounded-2xl p-8 shadow-lg lg:grid-cols-2 glass-panel-strong border border-white/30"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
      role="region"
      aria-label="クイズ表示"
    >
      <div className="space-y-5">
        <h2 className="text-4xl font-bold text-white bg-gradient-terracotta px-4 py-2 rounded-xl inline-block shadow-md">クイズ</h2>
        {activeQuiz ? (
          <>
            <p className="text-2xl font-bold leading-relaxed text-ink glass-panel-strong px-5 py-4 rounded-xl border border-white/30">{activeQuiz.question}</p>
            <ul className="grid gap-3 md:grid-cols-2">
              {activeQuiz.choices.map((choice, index) => (
                <li
                  key={choice}
                  className={`rounded-xl px-6 py-5 text-xl shadow-md border border-white/20 ${quizResult && index === correctIndex ? 'bg-success glass-panel-strong text-ink ring-2 ring-success-600' : 'glass-panel text-ink'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold">{CHOICE_LABELS[index]}</span>
                    <span className="flex-1 truncate text-left font-bold">{choice}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p className="text-xl text-ink/70 font-bold glass-panel-strong px-5 py-4 rounded-xl border border-white/30">次のクイズを準備中です。</p>
        )}
      </div>
      <div className="space-y-3 glass-panel-strong p-5 rounded-xl border border-white/30">
        <h3 className="text-xl font-bold text-ink mb-3">回答状況</h3>
        {quizResult ? (
          counts.map((count, index) => {
            const ratio = Math.round((count / total) * 100);
            return (
              <div key={index} className="space-y-2">
                <div className="flex items-center justify-between text-base text-ink font-bold">
                  <span>{CHOICE_LABELS[index]}</span>
                  <span>{count}票</span>
                </div>
                <div className="h-7 overflow-hidden rounded-full glass-panel border border-white/20">
                  <motion.div
                    key={`${index}-${count}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${ratio}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`h-full ${index === correctIndex ? 'bg-success' : 'bg-gradient-terracotta'}`}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-lg text-ink/70 font-bold">回答結果は正解公開後に表示されます。</p>
        )}
      </div>
    </motion.section>
  );
});

type LotteryPanelProps = {
  lotteryResult: RoomStoreState['lotteryResult'];
  isSpinning: boolean;
  leaderboard: LeaderboardEntry[];
};

const LotteryBoard = memo(function LotteryBoard({ lotteryResult, isSpinning, leaderboard }: LotteryPanelProps) {
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
      className="flex h-full flex-col items-center justify-center gap-10 rounded-2xl px-12 py-16 text-center shadow-lg glass-panel-strong border border-white/30 bg-gradient-sunset"
    >
      <span className="text-xl uppercase tracking-[0.4em] text-white/90 font-bold glass-panel-strong px-6 py-3 rounded-xl border border-white/30">Lottery</span>
      {waiting ? (
        <div className="space-y-6 glass-panel-strong p-10 rounded-2xl border border-white/30">
          <p className="text-3xl font-bold text-ink">抽選カテゴリを選んでください</p>
          <div className="flex flex-col items-center gap-3 text-xl font-bold text-ink">
            <span className="glass-panel px-6 py-3 rounded-xl border border-white/20 w-full hover:bg-gradient-terracotta hover:text-white transition-all">・全員対象</span>
            <span className="glass-panel px-6 py-3 rounded-xl border border-white/20 w-full hover:bg-gradient-denim hover:text-white transition-all">・新郎友人</span>
            <span className="glass-panel px-6 py-3 rounded-xl border border-white/20 w-full hover:bg-gradient-terracotta hover:text-white transition-all">・新婦友人</span>
          </div>
        </div>
      ) : (
        <motion.div
          key={displayName ?? 'lottery-waiting'}
          initial={{ rotate: 0, scale: 0.85, opacity: 0 }}
          animate={{ rotate: isSpinning ? [0, 360, 360] : 0, scale: 1, opacity: 1 }}
          transition={{ duration: isSpinning ? 3 : 0.6, ease: 'easeOut' }}
          className="rounded-3xl glass-panel-strong px-16 py-14 shadow-lg border border-white/30"
        >
          {displayKind ? (
            <p className="text-lg uppercase tracking-[0.4em] text-white font-bold bg-gradient-terracotta px-4 py-2 rounded-lg inline-block shadow-md">{displayKind}</p>
          ) : null}
          <p className="mt-6 text-[min(10vw,9rem)] font-bold text-ink">{displayName}</p>
        </motion.div>
      )}
    </motion.section>
  );
});

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
