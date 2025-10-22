'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
    if (storedTableNo) setTableNo(storedTableNo);
    if (storedName) setDisplayName(storedName);
    clearPlayerAuth();
    setRegistered(false);
    setShowModal(true);
  }, [storageKey, clearPlayerAuth]);

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
      setModalError('テーブル番号を入力してください');
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

  const handleTap = async () => {
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
          body: JSON.stringify({ delta: 1 })
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? response.statusText);
        }
      } else {
        await client.emit({
          type: 'tap:delta',
          payload: { delta: 1 }
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '送信に失敗しました');
    }
  };

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
        <div className="mb-6 flex items-center justify-between rounded-xl glass-panel-strong px-5 py-3 shadow-sm slide-up border border-white/30">
          <div className="flex items-center gap-3">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${connectionConfig[connection].dot} text-white text-xs font-bold`} aria-hidden="true">
              {connectionConfig[connection].icon}
            </span>
            <span className="font-bold text-ink">{connectionConfig[connection].label}</span>
          </div>
          <span className="text-xs font-bold text-ink/70">接続中</span>
        </div>

        {registered ? (
          <div className="rounded-2xl glass-panel-strong px-8 py-6 text-center shadow-md bounce-in border border-white/30 ring-2 ring-accent-400" aria-live="polite">
            <div className="mb-3 text-4xl">🎉</div>
            <p className="text-xl font-bold text-ink">参加登録完了！</p>
            <p className="mt-3 text-lg text-ink">
              <span className="rounded-full glass-panel px-4 py-1 font-bold text-terra-clay border border-white/20">{registeredTableNo}</span>
              <span className="mx-2 font-bold">テーブル</span>
            </p>
            <p className="mt-2 text-2xl font-bold text-ink">{registeredName} さん</p>
            <p className="mt-4 text-sm font-bold text-ink/70">ゲーム開始までお待ちください</p>
          </div>
        ) : (
          <div className="rounded-2xl glass-panel-strong p-8 text-center shadow-md slide-up border border-white/30">
            <div className="mb-4 text-5xl">📱</div>
            <p className="text-lg font-bold text-ink">参加登録してください</p>
            <p className="mt-3 text-sm leading-relaxed text-ink/80 font-semibold">
              画面中央のモーダルでテーブル番号とお名前を入力し、<br />
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

      {registered && mode !== 'countup' && mode !== 'quiz' && (
        <div className="mx-auto w-full max-w-3xl mt-8 space-y-6 relative z-10">
          <div className="rounded-2xl glass-panel-strong p-8 text-center shadow-md slide-up border border-white/30">
            <div className="mb-4 text-3xl">
              {mode === 'lottery' ? '🎰' : '🎮'}
            </div>
            <h2 className="text-title-sm font-bold text-ink">
              {mode === 'lottery' ? '抽選' : 'ゲーム'}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-ink/80 font-medium">
              {mode === 'lottery'
                ? '抽選の結果発表をお待ちください。当選者はスクリーンに表示されます。'
                : 'まもなくゲームが始まります。画面の指示に従ってください。'}
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
      : 'テーブル番号とお名前を入力してください。';

  const guidanceIcon = mode === 'quiz' ? '🎯' : mode === 'countup' ? '⚡' : '🎮';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 relative overflow-hidden bg-gradient-mobile">
      <div className="glass-panel-strong w-full max-w-md rounded-2xl px-8 py-10 shadow-xl bounce-in border border-white/30 relative z-10">
        <div className="mb-6 text-center">
          <div className="mb-4 text-5xl">{guidanceIcon}</div>
          <h2 className="text-title-md font-bold text-ink">参加登録</h2>
          <div className="mt-3 rounded-xl glass-panel px-4 py-3 border border-white/20">
            <p className="text-sm font-bold leading-relaxed text-ink">{guidanceText}</p>
          </div>
        </div>
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-ink" htmlFor="table-no">
              <span>📍</span>
              <span>テーブル番号</span>
            </label>
            <input
              id="table-no"
              className="input-terra w-full"
              value={tableNo}
              onChange={(event) => onTableNoChange(event.target.value)}
              placeholder="例：A-3 / 5 / C"
              maxLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-ink" htmlFor="display-name">
              <span>👤</span>
              <span>お名前</span>
            </label>
            <input
              id="display-name"
              className="input-terra w-full"
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
              placeholder="例：山田花子"
              autoComplete="name"
              maxLength={30}
              required
            />
          </div>
          {error && (
            <div className="rounded-xl glass-panel-strong px-4 py-3 text-sm font-bold text-error shadow-sm bounce-in border border-error/30" role="alert">
              ⚠️ {error}
            </div>
          )}
          <button
            type="submit"
            className="btn-primary mt-6 w-full text-lg disabled:opacity-50 disabled:cursor-not-allowed"
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
};

function CountupOverlay({ phase, countdownMs, leaderboard, onTap }: CountupOverlayProps) {
  const [localCountdown, setLocalCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [phaseEndTime, setPhaseEndTime] = useState<number | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [banner, setBanner] = useState<'start' | 'stop' | null>(null);
  const [particleTrigger, setParticleTrigger] = useState<ParticleConfig | null>(null);
  const prevPhaseRef = useRef<typeof phase>();
  const startDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishTriggeredRef = useRef(false);

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
    setPhaseEndTime(null);
    setTimeLeftSeconds(0);
    setBanner('stop');
    clearStopDelay();
    stopDelayRef.current = setTimeout(() => {
      setBanner(null);
      stopDelayRef.current = null;
    }, STOP_BANNER_DURATION_MS);
  }, [clearStartDelay, clearStopDelay]);

  useEffect(() => {
    const prev = prevPhaseRef.current;

    if (phase === 'running' && prev !== 'running') {
      clearStartDelay();
      clearStopDelay();
      finishTriggeredRef.current = false;
      setLocalCountdown(3);
      setPhaseEndTime(null);
      setTimeLeftSeconds(null);
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
      setPhaseEndTime(null);
      setTimeLeftSeconds(null);
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
      // Set exactly 10 seconds from now when timer starts
      const now = Date.now();
      const target = now + 10000; // Exactly 10 seconds
      setPhaseEndTime(target);
      setTimeLeftSeconds(10);
      startDelayRef.current = null;
    }, START_BANNER_DURATION_MS);
  }, [phase, localCountdown, isFinished, isTimerRunning, clearStartDelay]);

  useEffect(() => {
    if (!phaseEndTime || !isTimerRunning || phase !== 'running') return;

    const tick = () => {
      const remainingMs = phaseEndTime - Date.now();
      if (remainingMs <= 0) {
        triggerFinish();
        return;
      }
      setTimeLeftSeconds(Math.max(0, Math.ceil(remainingMs / 1000)));
    };

    tick();
    const id = setInterval(tick, 100);
    return () => clearInterval(id);
  }, [phase, phaseEndTime, isTimerRunning, triggerFinish]);

  const disabled = phase !== 'running' || localCountdown !== null || !isTimerRunning || banner === 'stop';
  const showPad = phase === 'running';
  const displaySeconds = isTimerRunning && banner !== 'stop' && timeLeftSeconds !== null ? timeLeftSeconds : '';

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
          <div className="rounded-2xl glass-panel-strong p-8 text-center shadow-md slide-up border border-white/30">
            <div className="mb-4 text-3xl">🎮</div>
            <h2 className="text-title-sm font-bold text-ink">ゲーム</h2>
            <p className="mt-4 text-base leading-relaxed text-ink/80 font-medium">
              まもなくゲームが始まります。画面の指示に従ってください。
            </p>
          </div>
        </div>
      )}

      {/* Countdown Timer - Top Right - Only show when timer is actually running (not during 3-2-1 or START banner) */}
      {showPad && displaySeconds !== '' && isTimerRunning && banner !== 'start' && localCountdown === null && (
        <div className="fixed top-4 right-4 z-[70] pointer-events-none">
          <div className="rounded-2xl glass-panel-strong px-5 py-3 shadow-xl border border-white/30">
            <span className="text-4xl font-bold text-terra-clay drop-shadow">{displaySeconds}</span>
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
          {localCountdown !== null ? (
            <div className="flex flex-col items-center gap-6 bounce-in">
              <div className="rounded-full glass-panel-strong p-16 shadow-xl border border-white/30">
                <span className="text-[min(40vw,18rem)] font-bold leading-none text-terra-clay">
                  {localCountdown}
                </span>
              </div>
              <p className="text-3xl font-bold text-ink glass-panel-strong px-6 py-3 rounded-xl border border-white/30">準備してください！</p>
            </div>
          ) : banner === 'start' ? (
            <div className="flex flex-col items-center gap-6 bounce-in">
              <div className="text-6xl animate-bounce">🚀</div>
              <span className="text-[min(20vw,8rem)] font-bold uppercase tracking-wider text-white bg-gradient-terracotta px-8 py-4 rounded-xl shadow-xl">
                START!
              </span>
            </div>
          ) : isTimerRunning ? (
            <div className="relative">
              <button
                type="button"
                onPointerDown={handleTap}
                disabled={disabled}
                className="w-full rounded-3xl bg-gradient-sunset px-12 py-12 text-center shadow-xl transition-all duration-100 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ripple-effect"
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
    return null;
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
        {/* Question */}
        <div className="w-full max-w-2xl mb-8">
          <div className="glass-panel-strong rounded-3xl p-6 shadow-xl border border-white/30">
            <p className="text-2xl font-bold text-ink leading-relaxed text-center">
              {activeQuiz.question}
            </p>
          </div>
        </div>

        {/* Choices */}
        <div className="w-full max-w-2xl grid grid-cols-1 gap-4">
          {activeQuiz.choices.map((choice, index) => {
            const isSelected = selectedChoice === index;
            const isCorrect = quizResult && index === correctIndex;
            const isWrong = quizResult && isSelected && index !== correctIndex;

            let buttonClass = 'glass-panel rounded-2xl p-6 shadow-lg transition-all duration-200';

            if (quizResult) {
              if (isCorrect) {
                buttonClass = 'rounded-2xl p-6 shadow-xl bg-success border-2 border-success-600';
              } else if (isWrong) {
                buttonClass = 'rounded-2xl p-6 shadow-xl bg-error border-2 border-error-600';
              } else {
                buttonClass = 'rounded-2xl p-6 shadow-md glass-panel';
              }
            } else if (isSelected) {
              buttonClass = 'rounded-2xl p-6 shadow-xl bg-gradient-denim border-2 border-denim-deep scale-105';
            } else if (hasAnswered) {
              buttonClass = 'rounded-2xl p-6 shadow-md glass-panel opacity-70';
            } else {
              buttonClass = 'glass-panel-strong rounded-2xl p-6 shadow-lg border border-white/30 hover:shadow-xl hover:scale-105 active:scale-95';
            }

            return (
              <button
                key={index}
                onClick={(e) => handleChoiceSelect(index, e)}
                disabled={hasAnswered || isSubmitting || !!quizResult}
                className={buttonClass}
              >
                <div className="flex items-center gap-4">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-2xl font-bold ${
                    quizResult
                      ? isCorrect
                        ? 'bg-success-600 text-white'
                        : isWrong
                          ? 'bg-error-600 text-white'
                          : 'bg-gradient-terracotta text-white'
                      : isSelected
                        ? 'bg-denim-deep text-white'
                        : 'bg-gradient-terracotta text-white'
                  }`}>
                    {CHOICE_LABELS[index]}
                  </div>
                  <span className={`flex-1 text-left text-xl font-semibold ${
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
                  {isCorrect && <span className="text-3xl">✓</span>}
                  {isWrong && <span className="text-3xl">✗</span>}
                </div>
              </button>
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
