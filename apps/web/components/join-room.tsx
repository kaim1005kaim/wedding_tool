'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useRealtimeClient } from '../lib/realtime-context';
import { useRoomStore } from '../lib/store/room-store';
import { appConfig } from '../lib/env';
import { Section, PrimaryButton } from './brand';
import type { LeaderboardEntry, RoomView } from '../lib/store/room-store';
import ParticleEffect from './ParticleEffect';
import type { ParticleConfig } from './ParticleEffect';

type ConnectionStatus = 'good' | 'warn' | 'bad';

const START_BANNER_DURATION_MS = 800;
const STOP_BANNER_DURATION_MS = 3000;
const TAP_BATCH_INTERVAL_MS = 100; // Batch taps every 100ms for better responsiveness
const MAX_TAPS_PER_SECOND = 20; // Physical limit: max 20 taps per second

export default function JoinRoom({ code }: { code: string }) {
  const [tableNo, setTableNo] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [registeredTableNo, setRegisteredTableNo] = useState('');
  const [registeredName, setRegisteredName] = useState('');
  const [connection, setConnection] = useState<ConnectionStatus>('good');
  const [showModal, setShowModal] = useState(true);
  const [isJoining, setIsJoining] = useState(false);
  const tapBatchRef = useRef(0);
  const tapBatchTimerRef = useRef<NodeJS.Timeout | null>(null);
  const tapTimestampsRef = useRef<number[]>([]);
  const client = useRealtimeClient();
  const mode = useRoomStore((state) => state.mode);
  const leaderboard = useRoomStore((state) => state.leaderboard);
  const playerToken = useRoomStore((state) => state.playerToken);
  const setPlayerAuth = useRoomStore((state) => state.setPlayerAuth);
  const clearPlayerAuth = useRoomStore((state) => state.clearPlayerAuth);
  const runtimeRoomId = useRoomStore((state) => state.roomId);
  const phase = useRoomStore((state) => state.phase);
  const countdownMs = useRoomStore((state) => state.countdownMs);

  const isCloudMode = appConfig.mode === 'cloud';

  const storageKey = useMemo(() => `wedding_tool:${code}:player`, [code]);
  const fingerprintKey = 'wedding_tool:device_id';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedTableNo = window.localStorage.getItem(`${storageKey}:tableNo`);
    const storedName = window.localStorage.getItem(`${storageKey}:name`);
    const storedPlayerData = window.localStorage.getItem(storageKey);

    if (storedTableNo) setTableNo(storedTableNo);
    if (storedName) setDisplayName(storedName);

    // Check if there's existing valid player session
    if (storedPlayerData && storedTableNo && storedName) {
      try {
        const { playerId, token, expiresAt } = JSON.parse(storedPlayerData) as {
          playerId: string;
          token: string;
          expiresAt: number;
        };

        // Check if token is still valid
        if (expiresAt > Date.now()) {
          setPlayerAuth({ playerId, token });
          setRegistered(true);
          setRegisteredTableNo(storedTableNo);
          setRegisteredName(storedName);
          setShowModal(false);
          return;
        }
      } catch (err) {
        console.error('Failed to restore player session:', err);
      }
    }

    clearPlayerAuth();
    setRegistered(false);
    setShowModal(true);
  }, [storageKey, clearPlayerAuth, setPlayerAuth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const getStatus = (): ConnectionStatus => {
      if (!navigator.onLine) return 'bad';
      const connectionInfo = (navigator as any).connection;
      const type = connectionInfo?.effectiveType as string | undefined;
      if (type === '2g' || type === 'slow-2g') return 'bad';
      if (type === '3g') return 'warn';
      return 'good';
    };

    const updateStatus = () => setConnection(getStatus());

    updateStatus();

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    const connectionInfo = (navigator as any).connection;
    connectionInfo?.addEventListener?.('change', updateStatus);

    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
      connectionInfo?.removeEventListener?.('change', updateStatus);
    };
  }, []);


  const getDeviceFingerprint = () => {
    if (typeof window === 'undefined') return undefined;
    let fingerprint = window.localStorage.getItem(fingerprintKey);
    if (!fingerprint) {
      fingerprint = crypto.randomUUID();
      window.localStorage.setItem(fingerprintKey, fingerprint);
    }
    return fingerprint.substring(0, 128);
  };

  const handleJoin = async () => {
    if (!tableNo.trim()) {
      setModalError('テーブルナンバーを入力してください');
      return;
    }
    if (!displayName.trim()) {
      setModalError('お名前を入力してください');
      return;
    }

    setModalError(null);
    setError(null);
    setIsJoining(true);

    try {
      if (isCloudMode) {
        const lookupResponse = await fetch(`/api/rooms/lookup?code=${encodeURIComponent(code)}`);
        if (!lookupResponse.ok) {
          throw new Error('ルームが見つかりません');
        }
        const { roomId: fetchedRoomId } = (await lookupResponse.json()) as { roomId: string };
        setRoomId(fetchedRoomId);

        const response = await fetch(`/api/rooms/${fetchedRoomId}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            displayName: displayName.trim(),
            tableNo: tableNo.trim(),
            deviceFingerprint: getDeviceFingerprint()
          })
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as {
            error?: string;
            details?: any;
            timestamp?: string;
          };
          console.error('Join API response:', data);
          throw new Error(data.error ?? response.statusText);
        }

        const { token, playerId, expiresAt } = (await response.json()) as {
          token: string;
          playerId: string;
          expiresAt: number;
        };
        setPlayerAuth({ playerId, token });
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(`${storageKey}:tableNo`, tableNo.trim());
          window.localStorage.setItem(`${storageKey}:name`, displayName.trim());
          window.localStorage.setItem(`${storageKey}:room`, fetchedRoomId);
          window.localStorage.setItem(storageKey, JSON.stringify({ playerId, token, expiresAt }));
        }
      } else {
        await client.emit({
          type: 'hello',
          payload: {
            displayName: displayName.trim(),
            tableNo: tableNo.trim()
          }
        });
      }

      setRegistered(true);
      setRegisteredTableNo(tableNo.trim());
      setRegisteredName(displayName.trim());
      setShowModal(false);
    } catch (err) {
      setModalError(err instanceof Error ? err.message : '参加に失敗しました');
      setRegistered(false);
    } finally {
      setIsJoining(false);
    }
  };

  const sendTapBatch = useCallback(async (delta: number) => {
    try {
      if (isCloudMode) {
        const activeRoomId = runtimeRoomId ?? roomId;
        if (!playerToken || !activeRoomId) {
          throw new Error('参加手続きを完了してください');
        }
        const response = await fetch(`/api/rooms/${activeRoomId}/tap`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${playerToken}`
          },
          body: JSON.stringify({ delta })
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? response.statusText);
        }
      } else {
        await client.emit({
          type: 'tap:delta',
          payload: { delta }
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました');
    }
  }, [isCloudMode, runtimeRoomId, roomId, playerToken, client]);

  const handleTap = useCallback(() => {
    const now = Date.now();

    // Remove timestamps older than 1 second
    tapTimestampsRef.current = tapTimestampsRef.current.filter(ts => now - ts < 1000);

    // Check if we've exceeded the physical limit
    if (tapTimestampsRef.current.length >= MAX_TAPS_PER_SECOND) {
      return; // Ignore this tap
    }

    // Record this tap
    tapTimestampsRef.current.push(now);
    tapBatchRef.current += 1;

    // If no timer is running, start one
    if (tapBatchTimerRef.current === null) {
      tapBatchTimerRef.current = setTimeout(() => {
        const delta = tapBatchRef.current;
        tapBatchRef.current = 0;
        tapBatchTimerRef.current = null;
        void sendTapBatch(delta);
      }, TAP_BATCH_INTERVAL_MS);
    }
  }, [sendTapBatch]);

  // Cleanup tap batch timer on unmount
  useEffect(() => {
    return () => {
      if (tapBatchTimerRef.current) {
        clearTimeout(tapBatchTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (registered) {
      setShowModal(false);
    }
  }, [registered]);

  const connectionConfig: Record<ConnectionStatus, { label: string; dot: string; icon: string }> = {
    good: { label: '接続良好', dot: 'bg-success', icon: '✓' },
    warn: { label: '注意が必要です', dot: 'bg-warning', icon: '⚠' },
    bad: { label: '接続が不安定です。場所を変えるか再接続をお試しください。', dot: 'bg-error', icon: '✕' }
  };

  return (
    <main className="min-h-screen px-6 py-10 relative overflow-hidden bg-gradient-mobile">
      <div className="mx-auto w-full max-w-3xl relative z-10">
        {registered ? (
          <div className="rounded-2xl glass-panel-strong px-6 py-4 text-center shadow-md bounce-in border border-white/30 ring-2 ring-accent-400" aria-live="polite">
            <div className="mb-2 text-3xl">🎉</div>
            <p className="text-lg font-bold text-ink">参加登録完了！</p>
            <p className="mt-2 text-base text-ink">
              <span className="rounded-full glass-panel px-3 py-1 font-bold text-terra-clay border border-white/20">{registeredTableNo}</span>
              <span className="mx-2 font-bold">テーブル</span>
            </p>
            <p className="mt-1 text-xl font-bold text-ink">{registeredName} さん</p>
            <p className="mt-3 text-sm font-bold text-ink/70">ゲーム開始までお待ちください</p>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-base font-bold text-ink/80">
              画面中央のモーダルでテーブルナンバーとお名前を入力し、<br />
              「参加する」ボタンを押してください
            </p>
          </div>
        )}

        {registered && error && (
          <div className="mt-4 rounded-2xl glass-panel-strong px-5 py-3 text-sm text-error shadow-sm bounce-in border border-error/30" role="alert">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* 抽選モード非表示 */}
      {registered && mode !== 'countup' && mode !== 'quiz' && mode !== 'lottery' && (
        <div className="mx-auto w-full max-w-3xl mt-8 space-y-6 relative z-10">
          <div className="rounded-2xl glass-panel-strong p-8 text-center shadow-md slide-up border border-white/30">
            <div className="mb-4 text-3xl">
              🎮
            </div>
            <h2 className="text-title-sm font-bold text-ink">
              ゲーム
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink/80 font-medium">
              まもなくゲームが始まります。画面の指示に従ってください。
            </p>
          </div>

          {/* Personal Score Display */}
          {(() => {
            const myEntry = leaderboard.find(entry => entry.displayName === registeredName);
            const hasScore = myEntry && myEntry.totalPoints > 0;

            if (!hasScore) return null;

            return (
              <div className="rounded-2xl glass-panel-strong p-8 shadow-md slide-up border border-white/30 ring-2 ring-accent-400">
                <div className="text-center">
                  <div className="mb-4 text-5xl">🎯</div>
                  <h2 className="mb-4 text-title-sm font-bold text-ink">あなたのスコア</h2>
                  <div className="mb-6 rounded-xl glass-panel p-6 border border-white/20">
                    <div className="mb-2 text-6xl font-bold text-terra-clay">
                      {myEntry.totalPoints}
                      <span className="ml-2 text-3xl font-bold">pt</span>
                    </div>
                    {myEntry.quizPoints !== undefined && myEntry.quizPoints > 0 && (
                      <p className="text-sm text-ink font-semibold">
                        クイズ: {myEntry.quizPoints}問正解
                      </p>
                    )}
                    {myEntry.countupTapCount !== undefined && myEntry.countupTapCount > 0 && (
                      <p className="text-sm text-ink font-semibold">
                        タップ: {myEntry.countupTapCount}回
                      </p>
                    )}
                  </div>
                  <p className="text-sm text-ink/80 font-bold">
                    全体のランキングは投影画面でご確認ください
                  </p>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {registered && mode === 'countup' && (
        <CountupOverlay
          phase={phase}
          countdownMs={countdownMs}
          leaderboard={leaderboard}
          onTap={handleTap}
          registeredName={registeredName}
        />
      )}

      {registered && mode === 'quiz' && (
        <QuizOverlay
          phase={phase}
          countdownMs={countdownMs}
          roomId={runtimeRoomId}
          playerToken={playerToken}
        />
      )}

      <JoinModal
        visible={showModal}
        tableNo={tableNo}
        displayName={displayName}
        onTableNoChange={setTableNo}
        onDisplayNameChange={setDisplayName}
        onSubmit={handleJoin}
        error={modalError}
        mode={mode}
        isJoining={isJoining}
      />
    </main>
  );
}

type JoinModalProps = {
  visible: boolean;
  tableNo: string;
  displayName: string;
  onTableNoChange: (value: string) => void;
  onDisplayNameChange: (value: string) => void;
  onSubmit: () => void;
  error: string | null;
  mode: string;
  isJoining: boolean;
};

function JoinModal({ visible, tableNo, displayName, onTableNoChange, onDisplayNameChange, onSubmit, error, mode, isJoining }: JoinModalProps) {
  if (!visible) return null;

  const guidanceText = mode === 'quiz'
    ? '各テーブル代表者の方のみ登録してください。'
    : mode === 'countup'
      ? '全員ご参加ください。'
      : 'テーブルナンバーとお名前を入力してください。';

  const guidanceIcon = mode === 'quiz' ? '🎯' : mode === 'countup' ? '⚡' : '🎮';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      {/* Backdrop overlay */}
      <div className="absolute inset-0 bg-gradient-mobile backdrop-blur-md" />

      <div className="glass-panel-strong w-full max-w-sm rounded-2xl px-6 py-6 shadow-xl bounce-in border border-white/30 relative z-10">
        <div className="mb-4 text-center">
          <div className="mb-2 text-3xl">{guidanceIcon}</div>
          <h2 className="text-xl font-bold text-ink">参加登録</h2>
          <div className="mt-2 rounded-lg glass-panel px-3 py-2 border border-white/20">
            <p className="text-xs font-bold leading-relaxed text-ink">{guidanceText}</p>
          </div>
        </div>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-bold text-ink" htmlFor="table-no">
              <span>📍</span>
              <span>テーブルナンバー</span>
            </label>
            <input
              id="table-no"
              className="input-terra w-full text-base py-3"
              value={tableNo}
              onChange={(event) => onTableNoChange(event.target.value.toUpperCase())}
              placeholder="例：A"
              maxLength={8}
              required
            />
          </div>
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-bold text-ink" htmlFor="display-name">
              <span>👤</span>
              <span>お名前</span>
            </label>
            <input
              id="display-name"
              className="input-terra w-full text-base py-3"
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
              placeholder="例：山田花子"
              autoComplete="name"
              maxLength={30}
              required
            />
          </div>
          {error && (
            <div className="rounded-lg glass-panel-strong px-3 py-2 text-xs font-bold text-error shadow-sm bounce-in border border-error/30" role="alert">
              ⚠️ {error}
            </div>
          )}
          <button
            type="submit"
            className="btn-primary mt-4 w-full text-lg py-4 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isJoining}
          >
            {isJoining ? (
              <span className="flex items-center justify-center gap-2 text-lg">
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                参加中...
              </span>
            ) : (
              <span className="text-lg">🎉 参加する</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

type CountupOverlayProps = {
  phase: 'idle' | 'running' | 'ended';
  countdownMs: number;
  leaderboard: LeaderboardEntry[];
  onTap: () => Promise<void> | void;
  registeredName: string;
};

function CountupOverlay({ phase, countdownMs, leaderboard, onTap, registeredName }: CountupOverlayProps) {

  const [localCountdown, setLocalCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [localCountdownMs, setLocalCountdownMs] = useState(countdownMs);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [banner, setBanner] = useState<'start' | 'stop' | null>(null);
  const [particleTrigger, setParticleTrigger] = useState<ParticleConfig | null>(null);
  const prevPhaseRef = useRef<typeof phase>();
  const startDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTriggeredRef = useRef(false);
  const countdownStartTimeRef = useRef<number | null>(null);
  const initialCountdownRef = useRef<number>(0);

  // Find current player's stats
  const myEntry = leaderboard.find(entry => entry.displayName === registeredName);
  const myRank = leaderboard.findIndex(entry => entry.displayName === registeredName) + 1;
  const myTapCount = myEntry?.countupTapCount ?? 0;

  const clearStartDelay = useCallback(() => {
    if (startDelayRef.current !== null) {
      clearTimeout(startDelayRef.current);
      startDelayRef.current = null;
    }
  }, []);

  const clearStopDelay = useCallback(() => {
    if (stopDelayRef.current !== null) {
      clearTimeout(stopDelayRef.current);
      stopDelayRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      clearStartDelay();
      clearStopDelay();
    };
  }, [clearStartDelay, clearStopDelay]);

  const triggerFinish = useCallback(() => {
    if (finishTriggeredRef.current) {
      return;
    }
    finishTriggeredRef.current = true;
    clearStartDelay();
    setIsTimerRunning(false);
    setIsFinished(true);
    countdownStartTimeRef.current = null;
    setLocalCountdownMs(0);
    setBanner('stop');
    clearStopDelay();
    stopDelayRef.current = setTimeout(() => {
      setBanner(null);
      stopDelayRef.current = null;
    }, STOP_BANNER_DURATION_MS);
  }, [clearStartDelay, clearStopDelay]);

  // クライアント側でカウントダウンを管理
  useEffect(() => {
    if (phase === 'running' && isTimerRunning && localCountdown === null) {
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
    } else if (phase !== 'running') {
      // phase が running でない場合はリセット
      countdownStartTimeRef.current = null;
      initialCountdownRef.current = 0;
      setLocalCountdownMs(countdownMs);
    }
  }, [phase, isTimerRunning, localCountdown, countdownMs]);

  useEffect(() => {
    const prev = prevPhaseRef.current;

    if (phase === 'running' && prev !== 'running') {
      clearStartDelay();
      clearStopDelay();
      finishTriggeredRef.current = false;
      setLocalCountdown(3);
      setIsTimerRunning(false);
      setIsFinished(false);
      setBanner(null);
    }

    if (phase === 'ended' && prev !== 'ended') {
      triggerFinish();
    }

    if (phase === 'idle' && prev !== 'idle') {
      clearStartDelay();
      clearStopDelay();
      finishTriggeredRef.current = false;
      setIsTimerRunning(false);
      setIsFinished(false);
      setBanner(null);
    }

    prevPhaseRef.current = phase;
  }, [phase, clearStartDelay, clearStopDelay, triggerFinish]);

  useEffect(() => {
    if (localCountdown === null) return;
    if (localCountdown <= 0) {
      setLocalCountdown(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setLocalCountdown((value) => (value !== null ? value - 1 : null));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [localCountdown]);

  useEffect(() => {
    if (phase !== 'running') return;
    if (localCountdown !== null) return;
    if (isFinished) return;
    if (isTimerRunning) return;

    setBanner('start');
    clearStartDelay();
    startDelayRef.current = setTimeout(() => {
      setBanner(null);
      setIsTimerRunning(true);
      startDelayRef.current = null;
    }, START_BANNER_DURATION_MS);
  }, [phase, localCountdown, isFinished, isTimerRunning, clearStartDelay]);

  // 準備カウントダウン中（countdownMs > 10000）はタップ無効
  const timeLeftSeconds = Math.max(0, Math.ceil(localCountdownMs / 1000));
  const isPreparation = timeLeftSeconds > 10;
  const isStartMoment = timeLeftSeconds === 10;
  const disabled = phase !== 'running' || isPreparation || isStartMoment || banner === 'stop';
  const showPad = phase === 'running';
  const displaySeconds = !isPreparation && !isStartMoment && banner !== 'stop' && timeLeftSeconds > 0 ? timeLeftSeconds : '';

  const handleTap = (e: React.PointerEvent) => {
    if (disabled) return;
    navigator.vibrate?.(10);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 150);
    void onTap();

    // Emit Bauhaus particles at tap location
    setParticleTrigger({
      x: e.clientX,
      y: e.clientY,
      count: 15,
      shape: 'circle',
      color: 'yellow',
      size: 8,
      velocity: 150,
      spread: 1.5
    });
  };

  return (
    <>
      {/* Waiting screen for idle phase */}
      {!showPad && !isFinished && phase === 'idle' && (
        <div className="mx-auto w-full max-w-3xl mt-8 space-y-6 relative z-10">
          <div className="rounded-2xl glass-panel-strong p-8 text-center shadow-md slide-up border border-white/30 space-y-6">
            {/* SVG Title */}
            <div className="flex justify-center">
              <img src="/tap-title.svg" alt="Tap Challenge" className="h-24 w-auto" />
            </div>

            <h2 className="text-xl font-bold text-ink">準備中</h2>
            <p className="text-base leading-relaxed text-ink/80 font-medium">
              まもなく開始します。画面の指示に従ってください。
            </p>
          </div>
        </div>
      )}

      {/* Countdown Timer - Top Right - Only show when timer is actually running (not during preparation or START moment) */}
      {showPad && displaySeconds !== '' && !isPreparation && !isStartMoment && (
        <div className="fixed top-4 right-4 z-[70] pointer-events-none">
          <div className="rounded-2xl glass-panel-strong px-5 py-3 shadow-xl border border-white/30">
            <span className="text-4xl font-bold text-terra-clay drop-shadow">{displaySeconds}</span>
          </div>
        </div>
      )}

      {/* Rank and Tap Count - Top Left - Show during active tapping */}
      {showPad && !isPreparation && !isStartMoment && myRank > 0 && (
        <div className="fixed top-4 left-4 z-[70] pointer-events-none">
          <div className="rounded-2xl glass-panel-strong px-5 py-3 shadow-xl border border-white/30 space-y-1">
            <div className="text-sm font-bold text-ink/70">現在の順位</div>
            <div className="text-3xl font-black text-terra-clay">{myRank}位</div>
            <div className="text-lg font-bold text-ink">{myTapCount}回</div>
          </div>
        </div>
      )}

      {isFinished && phase === 'running' && (
        <div className="mx-auto w-full max-w-3xl mt-8 space-y-6 relative z-10">
          <div className="flex flex-col items-center gap-6 bounce-in">
            {banner === 'stop' && (
              <>
                <div className="text-6xl">🎉</div>
                <span className="text-[min(20vw,8rem)] font-bold uppercase tracking-wider text-white bg-gradient-terracotta px-8 py-4 rounded-xl shadow-xl">
                  STOP!
                </span>
              </>
            )}
            <p className="text-xl font-bold text-ink glass-panel-strong px-6 py-3 rounded-xl border border-white/30">投影画面で結果を確認してください</p>
          </div>
        </div>
      )}

      {showPad && (
        <div className="mx-auto w-full max-w-3xl mt-8 space-y-6 relative z-10">
          {isPreparation ? (
            <div className="flex flex-col items-center gap-6 bounce-in">
              <div className="rounded-full glass-panel-strong p-16 shadow-xl border border-white/30">
                <span className="text-[min(40vw,18rem)] font-bold leading-none text-terra-clay">
                  {timeLeftSeconds - 10}
                </span>
              </div>
              <p className="text-3xl font-bold text-ink glass-panel-strong px-6 py-3 rounded-xl border border-white/30">準備してください！</p>
            </div>
          ) : isStartMoment ? (
            <div className="flex flex-col items-center gap-6 bounce-in">
              <div className="text-6xl animate-bounce">🚀</div>
              <span className="text-[min(20vw,8rem)] font-bold uppercase tracking-wider text-white bg-gradient-terracotta px-8 py-4 rounded-xl shadow-xl">
                START!
              </span>
            </div>
          ) : timeLeftSeconds > 0 ? (
            <div className="relative">
              <button
                type="button"
                onPointerDown={handleTap}
                disabled={disabled}
                className="w-full rounded-3xl bg-gradient-sunset px-12 py-16 text-center shadow-xl transition-all duration-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed min-h-[280px]"
              >
                <div className="text-[min(25vw,10rem)] font-bold uppercase text-white animate-pulse drop-shadow-lg">
                  TAP!
                </div>
                <p className="mt-3 text-2xl font-bold text-white drop-shadow">連打してポイント獲得！</p>
              </button>
              {flash && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <span className="text-8xl font-bold text-white opacity-90 animate-bounce-in drop-shadow-lg">
                    +1
                  </span>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
      <ParticleEffect trigger={particleTrigger} />
    </>
  );
}

function medalForRank(rank: number) {
  switch (rank) {
    case 1:
      return '🥇';
    case 2:
      return '🥈';
    case 3:
      return '🥉';
    default:
      return `${rank}.`;
  }
}

type QuizOverlayProps = {
  phase: 'idle' | 'running' | 'ended';
  countdownMs: number;
  roomId: string | null;
  playerToken: string | null;
};

const CHOICE_LABELS = ['A', 'B', 'C', 'D'];

function QuizOverlay({ phase, countdownMs, roomId, playerToken }: QuizOverlayProps) {
  const activeQuiz = useRoomStore((state) => state.activeQuiz);
  const quizResult = useRoomStore((state) => state.quizResult);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);
  const [phaseEndTime, setPhaseEndTime] = useState<number | null>(null);
  const [particleTrigger, setParticleTrigger] = useState<ParticleConfig | null>(null);

  // Reset selection when quiz changes
  useEffect(() => {
    if (activeQuiz) {
      setSelectedChoice(null);
      setIsSubmitting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQuiz?.quizId]);

  // Calculate countdown
  useEffect(() => {
    if (phase !== 'running' || !activeQuiz) {
      setPhaseEndTime(null);
      setTimeLeftSeconds(null);
      return;
    }

    const now = Date.now();
    const target = activeQuiz.deadlineTs;
    setPhaseEndTime(target);
    setTimeLeftSeconds(Math.max(0, Math.ceil((target - now) / 1000)));
  }, [phase, activeQuiz]);

  // Update timer
  useEffect(() => {
    if (!phaseEndTime || phase !== 'running') return;

    const tick = () => {
      const remainingMs = phaseEndTime - Date.now();
      if (remainingMs <= 0) {
        setTimeLeftSeconds(0);
        return;
      }
      setTimeLeftSeconds(Math.max(0, Math.ceil(remainingMs / 1000)));
    };

    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [phase, phaseEndTime]);

  // Emit particles when quiz result is revealed
  useEffect(() => {
    if (quizResult && selectedChoice !== null) {
      const isCorrect = selectedChoice === quizResult.correctIndex;
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;

      setParticleTrigger({
        x: centerX,
        y: centerY,
        count: isCorrect ? 40 : 20,
        shape: isCorrect ? 'circle' : 'square',
        color: isCorrect ? 'yellow' : 'red',
        size: isCorrect ? 15 : 10,
        velocity: isCorrect ? 180 : 100,
        spread: isCorrect ? 1.8 : 1.2
      });
    }
  }, [quizResult, selectedChoice]);

  const handleChoiceSelect = async (choiceIndex: number, event: React.MouseEvent) => {
    if (!activeQuiz || !roomId || !playerToken || selectedChoice !== null || quizResult) {
      return;
    }

    setSelectedChoice(choiceIndex);
    setIsSubmitting(true);

    // Emit Bauhaus particles at click location
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    setParticleTrigger({
      x: event.clientX,
      y: event.clientY,
      count: 20,
      shape: 'circle',
      color: 'blue',
      size: 10,
      velocity: 120,
      spread: 1.2
    });

    try {
      const response = await fetch(`/api/rooms/${roomId}/quiz/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${playerToken}`
        },
        body: JSON.stringify({
          quizId: activeQuiz.quizId,
          choiceIndex
        })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to submit answer:', error);
        setSelectedChoice(null);
      }
    } catch (err) {
      console.error('Failed to submit answer:', err);
      setSelectedChoice(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!activeQuiz) {
    return (
      <div className="mx-auto w-full max-w-3xl mt-8 space-y-6 relative z-10">
        <div className="rounded-2xl glass-panel-strong p-8 text-center shadow-md slide-up border border-white/30 space-y-6">
          {/* SVG Title */}
          <div className="flex justify-center">
            <img src="/quiz-title.svg" alt="Quiz" className="h-24 w-auto" />
          </div>

          <h2 className="text-xl font-bold text-ink">待機中</h2>
          <p className="text-base leading-relaxed text-ink/80 font-medium">
            管理画面からクイズが表示されるまでお待ちください
          </p>
        </div>
      </div>
    );
  }

  // Get background image based on question number
  const backgroundOrd = activeQuiz.ord ? Math.min(activeQuiz.ord, 5) : 1;
  const backgroundImage = `/quiz-backgrounds/${backgroundOrd}-smartphone.png`;

  const correctIndex = quizResult?.correctIndex ?? -1;
  const hasAnswered = selectedChoice !== null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{
        backgroundImage: `url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat'
      }}
    >
      {/* Countdown Timer - Top Right */}
      {timeLeftSeconds !== null && timeLeftSeconds > 0 && !quizResult && (
        <div className="absolute top-4 right-4 z-10">
          <div className="rounded-2xl glass-panel-strong px-5 py-3 shadow-xl border border-white/30">
            <span className="text-4xl font-bold text-terra-clay drop-shadow">{timeLeftSeconds}</span>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col items-center justify-center p-6">
        {/* Answer Feedback Message */}
        {hasAnswered && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-2xl mb-4"
          >
            {!quizResult ? (
              <div className="rounded-2xl bg-blue-500 text-white px-6 py-3 text-center shadow-lg space-y-1">
                <p className="text-2xl font-black">あなたの回答: {CHOICE_LABELS[selectedChoice]}</p>
                <p className="text-base font-medium">正解発表までお待ちください</p>
              </div>
            ) : selectedChoice === correctIndex ? (
              <div className="rounded-2xl bg-gradient-to-br from-green-500 to-green-600 text-white px-6 py-4 text-center shadow-xl border-2 border-green-700 space-y-1">
                <p className="text-3xl font-black">⭕ 正解！</p>
                <p className="text-xl font-bold">あなたの回答: {CHOICE_LABELS[selectedChoice]}</p>
              </div>
            ) : (
              <div className="rounded-2xl bg-gradient-denim text-white px-6 py-4 text-center shadow-xl border-2 border-denim-deep space-y-1">
                <p className="text-3xl font-black">残念...</p>
                <p className="text-xl font-bold">あなたの回答: {CHOICE_LABELS[selectedChoice]}</p>
                <p className="text-lg font-medium">正解は {CHOICE_LABELS[correctIndex]} でした</p>
              </div>
            )}
          </motion.div>
        )}

        {/* Question */}
        <div className="w-full max-w-2xl mb-8">
          <div className="glass-panel-strong rounded-3xl p-6 shadow-xl border border-white/30">
            <p className="text-2xl font-bold text-ink leading-relaxed text-center">
              {activeQuiz.question}
            </p>
          </div>
        </div>

        {/* Choices - 1 Column Vertical */}
        <div className="w-full max-w-2xl flex flex-col gap-4">
          {activeQuiz.choices.map((choice, index) => {
            const isSelected = selectedChoice === index;
            const isCorrect = quizResult && index === correctIndex;
            const isWrong = quizResult && isSelected && index !== correctIndex;
            const count = quizResult?.perChoiceCounts?.[index] ?? 0;

            let buttonClass = 'glass-panel rounded-2xl p-5 shadow-lg transition-all duration-200';

            if (quizResult) {
              if (isCorrect) {
                buttonClass = 'rounded-2xl p-5 shadow-xl bg-gradient-to-br from-green-500 to-green-600 border-2 border-green-700';
              } else if (isWrong) {
                // 不正解時も青色に変更
                buttonClass = 'rounded-2xl p-5 shadow-xl bg-gradient-denim border-2 border-denim-deep';
              } else {
                buttonClass = 'rounded-2xl p-5 shadow-md glass-panel';
              }
            } else if (isSelected) {
              // 選択中は青色を維持
              buttonClass = 'rounded-2xl p-5 shadow-xl bg-gradient-denim border-2 border-denim-deep scale-105';
            } else if (hasAnswered) {
              buttonClass = 'rounded-2xl p-5 shadow-md glass-panel opacity-70';
            } else {
              buttonClass = 'glass-panel-strong rounded-2xl p-5 shadow-lg border border-white/30 hover:shadow-xl hover:scale-[1.02] active:scale-95';
            }

            return (
              <motion.button
                key={index}
                onClick={(e) => handleChoiceSelect(index, e)}
                disabled={hasAnswered || isSubmitting || !!quizResult}
                className={`${buttonClass} relative`}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
              >
                {/* Correct Answer Indicator */}
                {isCorrect && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className="absolute -top-4 -left-4 w-16 h-16 flex items-center justify-center z-10"
                  >
                    <span className="text-5xl drop-shadow-lg">⭕️</span>
                  </motion.div>
                )}

                {/* Wrong Answer Indicator */}
                {isWrong && (
                  <motion.div
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', bounce: 0.5 }}
                    className="absolute -top-4 -left-4 w-16 h-16 flex items-center justify-center z-10"
                  >
                    <span className="text-5xl drop-shadow-lg">❌</span>
                  </motion.div>
                )}

                <div className="flex flex-col gap-3">
                  {/* Choice Label and Text */}
                  <div className="flex items-center gap-2">
                    <span className={`text-2xl font-black ${
                      quizResult
                        ? isCorrect || isWrong
                          ? 'text-white'
                          : 'text-ink'
                        : isSelected
                          ? 'text-white'
                          : 'text-ink'
                    }`}>
                      {CHOICE_LABELS[index]}.
                    </span>
                    <span className={`flex-1 text-left text-base font-bold ${
                      quizResult
                        ? isCorrect || isWrong
                          ? 'text-white'
                          : 'text-ink'
                        : isSelected
                          ? 'text-white'
                          : 'text-ink'
                    }`}>
                      {choice}
                    </span>
                  </div>

                  {/* Answer Count Badge */}
                  {quizResult && (
                    <motion.div
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: 0.2 + index * 0.1, type: 'spring' }}
                      className="self-end bg-yellow-400 rounded-full px-3 py-1 shadow-md border-2 border-yellow-500"
                    >
                      <span className="text-sm font-black text-ink">回答数{count}</span>
                    </motion.div>
                  )}
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Status Message */}
        {hasAnswered && !quizResult && (
          <div className="mt-8">
            <div className="glass-panel-strong rounded-2xl px-8 py-4 shadow-xl border border-white/30">
              <p className="text-xl font-bold text-ink text-center">
                回答を送信しました。正解発表をお待ちください...
              </p>
            </div>
          </div>
        )}
      </div>
      <ParticleEffect trigger={particleTrigger} />
    </div>
  );
}
