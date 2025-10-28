'use client';

import { useCallback, useEffect, useMemo, useRef, useState, memo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useRoomStore } from '../lib/store/room-store';
import type { LeaderboardEntry, RoomStoreState } from '../lib/store/room-store';
import ParticleEffect from './ParticleEffect';
import type { ParticleConfig } from './ParticleEffect';

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

export default function ProjectorView({ roomId: _roomId }: { roomId: string }) {
  const mode = useRoomStore((state) => state.mode);
  const phase = useRoomStore((state) => state.phase);
  const countdownMs = useRoomStore((state) => state.countdownMs);
  const serverTime = useRoomStore((state) => state.serverTime);
  const leaderboard = useRoomStore((state) => state.leaderboard);
  const activeQuiz = useRoomStore((state) => state.activeQuiz);
  const quizResult = useRoomStore((state) => state.quizResult);
  const lotteryResult = useRoomStore((state) => state.lotteryResult);

  const topTen = useMemo(() => leaderboard.slice(0, 10), [leaderboard]);
  const [lotteryKey, setLotteryKey] = useState(0);
  const [isSpinning, setIsSpinning] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [particleTrigger, setParticleTrigger] = useState<ParticleConfig | null>(null);
  const [localCountdownMs, setLocalCountdownMs] = useState(countdownMs);
  const containerRef = useRef<HTMLDivElement>(null);
  const prevModeRef = useRef<typeof mode>();
  const countdownStartTimeRef = useRef<number | null>(null);
  const initialCountdownRef = useRef<number>(0);

  // クライアント側でカウントダウンを管理
  useEffect(() => {
    if (phase === 'running' && mode === 'countup') {
      // 新しいカウントダウン開始
      if (countdownStartTimeRef.current === null) {
        countdownStartTimeRef.current = Date.now();
        initialCountdownRef.current = countdownMs;
        setLocalCountdownMs(countdownMs);
      }

      const interval = setInterval(() => {
        const elapsed = Date.now() - (countdownStartTimeRef.current ?? 0);
        const remaining = Math.max(0, initialCountdownRef.current - elapsed);
        setLocalCountdownMs(remaining);

        if (remaining <= 0) {
          clearInterval(interval);
        }
      }, 100); // 100msごとに更新

      return () => clearInterval(interval);
    } else {
      // phase が running でない場合はリセット
      countdownStartTimeRef.current = null;
      initialCountdownRef.current = 0;
      setLocalCountdownMs(countdownMs);
    }
  }, [phase, mode, countdownMs]);

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
      className="flex min-h-screen items-center justify-center relative overflow-hidden bg-gradient-earth"
      role="main"
      aria-label="投影画面"
    >
      <div className="relative w-full h-screen flex flex-col z-10 px-12 py-10 gap-6" role="region" aria-label="ゲーム表示エリア">
        <Header mode={mode} countdownMs={localCountdownMs} isFullscreen={isFullscreen} onToggleFullscreen={toggleFullscreen} />
        <div className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">{renderSection(mode, phase, localCountdownMs, topTen, activeQuiz, quizResult, lotteryResult, isSpinning, lotteryKey)}</AnimatePresence>
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
  phase: 'idle' | 'running' | 'ended',
  countdownMs: number,
  leaderboard: LeaderboardEntry[],
  activeQuiz: RoomStoreState['activeQuiz'],
  quizResult: RoomStoreState['quizResult'],
  lotteryResult: RoomStoreState['lotteryResult'],
  isSpinning: boolean,
  lotteryKey: number
) {
  switch (mode) {
    case 'countup':
      return <CountupBoard key="countup" entries={leaderboard} phase={phase} countdownMs={countdownMs} />;
    case 'quiz':
      return <QuizBoard key={`quiz-${quizResult?.quizId ?? activeQuiz?.quizId ?? 'waiting'}`} activeQuiz={activeQuiz} quizResult={quizResult} />;
    /* 抽選モード非表示
    case 'lottery':
      return <LotteryBoard key={lotteryKey} lotteryResult={lotteryResult} isSpinning={isSpinning} leaderboard={leaderboard} />;
    */
    default:
      return <IdleBoard key="idle" leaderboard={leaderboard} />;
  }
}

const CountupBoard = memo(function CountupBoard({
  entries,
  phase,
  countdownMs
}: {
  entries: LeaderboardEntry[];
  phase: 'idle' | 'running' | 'ended';
  countdownMs: number;
}) {
  // Top 3 highlighted, rest in compact grid
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);
  const timeLeftSeconds = Math.max(0, Math.ceil(countdownMs / 1000));
  const [showTOP3, setShowTOP3] = useState(false);
  const [showPodium, setShowPodium] = useState(false);

  // 終了時の演出フロー
  useEffect(() => {
    if (phase === 'ended' && entries.length > 0) {
      // 5秒後にTOP3表示
      const timer1 = setTimeout(() => {
        setShowTOP3(true);
      }, 5000);

      // 8秒後に表彰台表示に切り替え
      const timer2 = setTimeout(() => {
        setShowPodium(true);
      }, 8000);

      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else {
      setShowTOP3(false);
      setShowPodium(false);
    }
  }, [phase, entries.length]);

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
      {/* Phase Status */}
      {phase === 'idle' && (
        <div className="text-center py-8">
          <div className="mb-4 text-6xl">⚡</div>
          <h2 className="text-4xl font-bold text-ink glass-panel-strong px-8 py-4 rounded-2xl inline-block shadow-lg border border-white/30">
            タップチャレンジ準備中
          </h2>
          <p className="mt-4 text-xl text-ink/70 font-bold">まもなく開始します</p>
        </div>
      )}

      {phase === 'running' && (
        <div className="text-center py-8 space-y-6">
          <motion.div
            initial={{ scale: 0.9 }}
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            <div className="text-9xl mb-4">⚡</div>
          </motion.div>
          <motion.div
            className="glass-panel-strong rounded-3xl px-16 py-10 inline-block shadow-2xl border-4 border-accent-400"
            animate={{
              boxShadow: [
                '0 0 40px rgba(251, 146, 60, 0.5)',
                '0 0 80px rgba(251, 146, 60, 0.8)',
                '0 0 40px rgba(251, 146, 60, 0.5)'
              ]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <p className="text-3xl font-bold text-ink/70 mb-4">タップチャレンジ実行中！</p>
            <motion.p
              className="font-black bg-gradient-to-r from-orange-500 via-red-500 to-orange-500 bg-clip-text text-transparent"
              style={{ fontSize: '10rem', lineHeight: 1 }}
              animate={{ scale: timeLeftSeconds <= 5 ? [1, 1.1, 1] : 1 }}
              transition={{ duration: 0.5, repeat: timeLeftSeconds <= 5 ? Infinity : 0 }}
            >
              {timeLeftSeconds}
            </motion.p>
            <p className="text-4xl font-black text-terra-clay mt-2">秒</p>
          </motion.div>
          <motion.p
            className="text-4xl font-bold text-ink"
            animate={{ opacity: [0.6, 1, 0.6] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            全力でタップしよう！🔥
          </motion.p>
        </div>
      )}

      {phase === 'ended' && (
        <motion.div
          className="text-center py-6"
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', bounce: 0.5 }}
        >
          <motion.div
            className="text-8xl mb-4"
            animate={{ rotate: [0, 10, -10, 10, 0] }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            🎉
          </motion.div>
          <div className="glass-panel-strong rounded-2xl px-12 py-8 inline-block shadow-xl border-2 border-accent-400 bg-gradient-to-br from-orange-50/50 to-yellow-50/50">
            <p className="text-5xl font-black text-ink mb-4">
              タップチャレンジ終了！
            </p>
            <p className="text-2xl font-bold text-terra-clay">
              結果発表 ✨
            </p>
          </div>
        </motion.div>
      )}

      {/* Running時はランキング非表示（盛り上げに集中） */}

      {/* 終了時の演出: スクロール */}
      {phase === 'ended' && entries.length > 0 && !showTOP3 && (
        <motion.div
          className="flex-1 overflow-hidden rounded-2xl p-6 shadow-md glass-panel-strong border border-white/30"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <motion.div
            className="space-y-3"
            initial={{ y: '100%' }}
            animate={{ y: '-100%' }}
            transition={{ duration: 5, ease: 'linear' }}
          >
            {[...entries].reverse().map((entry) => (
              <motion.div
                key={entry.playerId}
                className="flex items-center justify-between rounded-xl glass-panel px-6 py-4 shadow-lg border-2 border-white/30"
                initial={{ opacity: 0, x: -50 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-4">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-terracotta text-xl font-black text-white shadow-lg">
                    {entry.rank}
                  </span>
                  <div>
                    <p className="text-2xl font-black text-ink">{entry.displayName}</p>
                    {entry.tableNo && <p className="text-base text-ink/70 font-bold">テーブル {entry.tableNo}</p>}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-terra-clay">{entry.totalPoints}</p>
                  <p className="text-sm text-ink/80 font-bold">タップ</p>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </motion.div>
      )}

      {/* 終了時の演出: TOP3表示（スクロール後） */}
      {phase === 'ended' && showTOP3 && !showPodium && top3.length >= 3 && (
        <motion.div
          className="flex-1 flex items-center justify-center"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, type: 'spring', bounce: 0.4 }}
        >
          <div className="grid grid-cols-3 gap-8">
            {top3.map((entry, index) => (
              <motion.div
                key={entry.playerId}
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.2, type: 'spring', bounce: 0.4 }}
                className={`flex flex-col items-center rounded-2xl p-8 shadow-2xl glass-panel-strong border-4 ${
                  entry.rank === 1
                    ? 'border-yellow-400 ring-4 ring-yellow-300/50 bg-gradient-to-br from-yellow-50/40 to-orange-50/40'
                    : entry.rank === 2
                      ? 'border-gray-400 ring-4 ring-gray-300/50 bg-gradient-to-br from-gray-50/30 to-slate-50/30'
                      : 'border-amber-600 ring-4 ring-amber-400/50 bg-gradient-to-br from-amber-50/30 to-orange-50/30'
                }`}
              >
                <motion.div
                  className="mb-4 text-8xl"
                  animate={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.6, delay: 0.5 + index * 0.2 }}
                >
                  {['🥇', '🥈', '🥉'][index]}
                </motion.div>
                <p className="mb-2 text-center text-4xl font-black text-ink">{entry.displayName}</p>
                {entry.tableNo && <p className="mb-4 text-xl text-ink/70 font-bold text-center">テーブル {entry.tableNo}</p>}
                <motion.div
                  className="rounded-full glass-panel px-8 py-4 shadow-lg border-2 border-white/40 text-center"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.4, delay: 0.8 + index * 0.2 }}
                >
                  <span className="text-5xl font-black text-terra-clay">{entry.totalPoints}</span>
                  <span className="ml-2 text-2xl text-ink/80 font-bold">タップ</span>
                </motion.div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* 表彰台スタイル表示 */}
      {phase === 'ended' && showPodium && top3.length >= 3 && (
        <div className="flex-1 flex items-end justify-center gap-8 pb-12">
          {/* 2位 - 左 */}
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', bounce: 0.4 }}
            className="flex flex-col items-center"
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.6, delay: 0.8 }}
              className="mb-4 text-8xl"
            >
              🥈
            </motion.div>
            <div className="rounded-2xl glass-panel-strong p-8 shadow-2xl border-4 border-gray-400 ring-4 ring-gray-300/50 bg-gradient-to-br from-gray-50/30 to-slate-50/30">
              <p className="text-3xl font-black text-ink text-center mb-2">{top3[1].displayName}</p>
              {top3[1].tableNo && <p className="text-lg text-ink/70 font-bold text-center mb-4">テーブル {top3[1].tableNo}</p>}
              <div className="rounded-full glass-panel px-8 py-4 shadow-lg border-2 border-white/40 text-center">
                <span className="text-4xl font-black text-terra-clay">{top3[1].totalPoints}</span>
                <span className="ml-2 text-xl text-ink/80 font-bold">タップ</span>
              </div>
            </div>
            {/* 台座 */}
            <div className="w-48 h-32 bg-gradient-to-b from-gray-300/80 to-gray-400/80 rounded-t-2xl shadow-xl mt-4 flex items-center justify-center border-4 border-gray-500">
              <span className="text-6xl font-black text-white">2</span>
            </div>
          </motion.div>

          {/* 1位 - 中央（高い位置） */}
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, type: 'spring', bounce: 0.4 }}
            className="flex flex-col items-center -translate-y-12"
          >
            <motion.div
              animate={{ rotate: [0, -15, 15, -15, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.8, delay: 1 }}
              className="mb-4 text-9xl"
            >
              🥇
            </motion.div>
            <div className="rounded-2xl glass-panel-strong p-10 shadow-2xl border-4 border-yellow-400 ring-4 ring-yellow-300/50 bg-gradient-to-br from-yellow-50/40 to-orange-50/40">
              <p className="text-4xl font-black text-ink text-center mb-2">{top3[0].displayName}</p>
              {top3[0].tableNo && <p className="text-xl text-ink/70 font-bold text-center mb-4">テーブル {top3[0].tableNo}</p>}
              <div className="rounded-full glass-panel px-10 py-5 shadow-lg border-2 border-white/40 text-center">
                <span className="text-5xl font-black text-terra-clay">{top3[0].totalPoints}</span>
                <span className="ml-2 text-2xl text-ink/80 font-bold">タップ</span>
              </div>
            </div>
            {/* 台座 */}
            <div className="w-52 h-40 bg-gradient-to-b from-yellow-300/80 to-yellow-500/80 rounded-t-2xl shadow-2xl mt-4 flex items-center justify-center border-4 border-yellow-600">
              <span className="text-7xl font-black text-white">1</span>
            </div>
          </motion.div>

          {/* 3位 - 右 */}
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0, type: 'spring', bounce: 0.4 }}
            className="flex flex-col items-center"
          >
            <motion.div
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mb-4 text-8xl"
            >
              🥉
            </motion.div>
            <div className="rounded-2xl glass-panel-strong p-8 shadow-2xl border-4 border-amber-600 ring-4 ring-amber-400/50 bg-gradient-to-br from-amber-50/30 to-orange-50/30">
              <p className="text-3xl font-black text-ink text-center mb-2">{top3[2].displayName}</p>
              {top3[2].tableNo && <p className="text-lg text-ink/70 font-bold text-center mb-4">テーブル {top3[2].tableNo}</p>}
              <div className="rounded-full glass-panel px-8 py-4 shadow-lg border-2 border-white/40 text-center">
                <span className="text-4xl font-black text-terra-clay">{top3[2].totalPoints}</span>
                <span className="ml-2 text-xl text-ink/80 font-bold">タップ</span>
              </div>
            </div>
            {/* 台座 */}
            <div className="w-48 h-24 bg-gradient-to-b from-amber-500/80 to-amber-700/80 rounded-t-2xl shadow-xl mt-4 flex items-center justify-center border-4 border-amber-800">
              <span className="text-6xl font-black text-white">3</span>
            </div>
          </motion.div>
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
  const correctIndex = quizResult?.correctIndex ?? -1;

  // Show waiting screen when no active quiz
  if (!activeQuiz) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -30 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex h-full items-center justify-center"
        role="region"
        aria-label="クイズ待機中"
      >
        <div className="text-center">
          <div className="mb-6 text-8xl">🎯</div>
          <h2 className="text-5xl font-bold text-ink glass-panel-strong px-10 py-6 rounded-2xl inline-block shadow-lg border border-white/30">
            クイズ待機中
          </h2>
          <p className="mt-6 text-2xl text-ink/70 font-bold">管理画面からクイズを表示してください</p>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="flex h-full flex-col gap-8 rounded-2xl p-12"
      role="region"
      aria-label="クイズ表示"
    >
      {/* Quiz Title */}
      {quizResult && (
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <h2 className="text-5xl font-bold text-ink glass-panel-strong px-8 py-4 rounded-2xl inline-block shadow-lg border border-white/30">
            正解発表
          </h2>
        </motion.div>
      )}

      {!quizResult && activeQuiz?.ord && (
        <div className="text-center">
          <h2 className="text-5xl font-bold text-ink glass-panel-strong px-8 py-4 rounded-2xl inline-block shadow-lg border border-white/30">
            第{activeQuiz.ord}問
          </h2>
        </div>
      )}

      {/* Question */}
      {activeQuiz && (
        <>
          <div className="text-center">
            <p className="text-4xl font-bold leading-relaxed text-ink glass-panel-strong px-10 py-8 rounded-2xl border border-white/30 shadow-lg inline-block">
              {activeQuiz.question}
            </p>
          </div>

          {/* 2x2 Grid Layout for Choices */}
          <div className="flex-1 grid grid-cols-2 gap-6">
            {activeQuiz.choices.map((choice, index) => {
              const isCorrect = quizResult && index === correctIndex;
              const count = counts[index];

              return (
                <motion.div
                  key={choice}
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative"
                >
                  <div
                    className={`h-full rounded-2xl px-10 py-8 shadow-lg border-2 transition-all ${
                      isCorrect
                        ? 'bg-gradient-to-br from-red-500 to-red-600 border-red-700 ring-4 ring-red-300'
                        : 'glass-panel-strong border-white/30'
                    }`}
                  >
                    {/* Correct Answer Circle */}
                    {isCorrect && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', bounce: 0.5 }}
                        className="absolute -top-5 -left-5 w-24 h-24 rounded-full bg-red-500 border-4 border-white shadow-xl flex items-center justify-center z-10"
                      >
                        <span className="text-5xl font-black text-white">{CHOICE_LABELS[index]}</span>
                      </motion.div>
                    )}

                    <div className="flex items-center justify-between gap-6 h-full">
                      {/* Choice Label and Text */}
                      <div className="flex items-center gap-5 flex-1">
                        <span className={`text-5xl font-black ${isCorrect ? 'text-white' : 'text-ink'}`}>
                          {CHOICE_LABELS[index]}.
                        </span>
                        <span className={`text-3xl font-bold ${isCorrect ? 'text-white' : 'text-ink'}`}>
                          {choice}
                        </span>
                      </div>

                      {/* Answer Count Badge */}
                      {quizResult && (
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ delay: 0.3 + index * 0.1, type: 'spring' }}
                          className="bg-yellow-400 rounded-full px-5 py-2 shadow-lg border-2 border-yellow-500"
                        >
                          <span className="text-xl font-black text-ink">回答数{count}</span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
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
        <div className="glass-panel-strong p-10 rounded-2xl border border-white/30">
          <p className="text-3xl font-bold text-ink">少々お待ちください</p>
        </div>
      ) : (
        <motion.div
          key={displayName ?? 'lottery-waiting'}
          initial={{ rotate: 0, scale: 0.85, opacity: 0 }}
          animate={{ rotate: isSpinning ? [0, 360, 360] : 0, scale: 1, opacity: 1 }}
          transition={{ duration: isSpinning ? 3 : 0.6, ease: 'easeOut' }}
          className="rounded-3xl glass-panel-strong px-16 py-14 shadow-lg border border-white/30"
        >
          <p className="text-[min(10vw,9rem)] font-bold text-ink">{displayName}</p>
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
