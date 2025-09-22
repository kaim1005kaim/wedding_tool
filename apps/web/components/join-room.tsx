'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRealtimeClient } from '../lib/realtime-context';
import { useRoomStore } from '../lib/store/room-store';
import { appConfig } from '../lib/env';
import { Section, PrimaryButton } from './brand';
import type { LeaderboardEntry, RoomView } from '../lib/store/room-store';

type ConnectionStatus = 'good' | 'warn' | 'bad';

const START_BANNER_DURATION_MS = 800;
const STOP_BANNER_DURATION_MS = 1000;

export default function JoinRoom({ code }: { code: string }) {
  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [connection, setConnection] = useState<ConnectionStatus>('good');
  const [showModal, setShowModal] = useState(true);
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
    const storedName = window.localStorage.getItem(`${storageKey}:name`);
    if (storedName) {
      const parts = storedName.split(' ');
      setLastName(parts.at(0) ?? storedName);
      setFirstName(parts.slice(1).join(' '));
    }
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

  const fullName = useMemo(
    () =>
      [lastName.trim(), firstName.trim()]
        .filter((value) => value.length > 0)
        .join(' '),
    [lastName, firstName]
  );

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
    if (!lastName.trim() || !firstName.trim()) {
      setModalError('姓と名を入力してください');
      return;
    }

    setModalError(null);
    setError(null);

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
            displayName: fullName,
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
          window.localStorage.setItem(`${storageKey}:name`, fullName);
          window.localStorage.setItem(`${storageKey}:room`, fetchedRoomId);
          window.localStorage.setItem(storageKey, JSON.stringify({ playerId, token, expiresAt }));
        }
      } else {
        await client.emit({
          type: 'hello',
          payload: {
            displayName: fullName
          }
        });
      }

      setRegistered(true);
      setDisplayName(fullName);
      setShowModal(false);
      setLastName('');
      setFirstName('');
    } catch (err) {
      setModalError(err instanceof Error ? err.message : '参加に失敗しました');
      setRegistered(false);
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

  const connectionConfig: Record<ConnectionStatus, { label: string; dot: string }> = {
    good: { label: '接続良好', dot: 'bg-success' },
    warn: { label: '注意が必要です', dot: 'bg-warning' },
    bad: { label: '接続が不安定です。場所を変えるか再接続をお試しください。', dot: 'bg-error' }
  };

  return (
    <main className="min-h-screen px-6 py-10">
      <Section title="参加登録" subtitle={`ルームコード: ${code.toUpperCase()}`}>
        <div className="mb-4 flex items-center justify-between rounded-xl bg-brand-blue-50/60 px-4 py-2 text-sm">
          <div className="flex items-center gap-2">
            <span className={`h-3 w-3 rounded-full ${connectionConfig[connection].dot}`} aria-hidden="true" />
            <span>{connectionConfig[connection].label}</span>
          </div>
          <span className="text-xs text-brand-blue-700/80">接続インジケータ</span>
        </div>

        {registered ? (
          <div className="glass-panel rounded-2xl border border-white/40 px-6 py-5 shadow-brand" aria-live="polite">
            <p className="text-lg font-semibold">{displayName} さん、ゲーム開始までお待ちください。</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-white/80 p-6 text-sm text-brand-blue-700/80">
            画面中央のモーダルで本名（姓と名）を入力し、「参加する」を押してください。
          </div>
        )}

        {registered && error && (
          <p className="mt-4 text-sm text-error" role="alert">
            {error}
          </p>
        )}
      </Section>

      {registered && (
        <div className="mt-8 space-y-6">
          <div className="rounded-2xl bg-white/70 p-6 shadow-brand">
            <h2 className="text-xl font-semibold text-brand-blue-700">タップチャレンジ</h2>
            <p className="mt-2 text-sm text-brand-blue-700/80">
              {mode === 'countup'
                ? phase === 'running'
                  ? '画面全体に表示される TAP ボタンをテンポ良くタップして、スコアを伸ばしましょう。'
                  : '合図が出るまでそのままお待ちください。スタート直前にカウントダウンが表示されます。'
                : mode === 'quiz'
                  ? 'クイズが表示されたら、画面の指示に従って回答してください。'
                  : mode === 'lottery'
                    ? '抽選の結果発表をお待ちください。'
                    : 'まもなくゲームが始まります。'}
            </p>
          </div>

          <div className="rounded-2xl bg-brand-blue-50/70 p-6 shadow-brand">
            <h2 className="text-xl font-semibold text-brand-blue-700">現在のランキング</h2>
            {leaderboard.length === 0 ? (
              <p className="mt-3 text-sm text-brand-blue-700/70">ランキングはまだ表示されていません。</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {leaderboard.slice(0, 10).map((entry) => (
                  <li
                    key={entry.playerId}
                    className="flex items-center justify-between rounded-xl bg-white/80 px-4 py-3 text-sm shadow-brand"
                  >
                    <span className="font-medium">
                      {entry.rank}. {entry.displayName}
                    </span>
                    <span className="font-semibold text-brand-terra-600">
                      {entry.totalPoints}
                      <span className="ml-1 text-xs text-brand-blue-700/70">pt</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {registered && (
        <CountupOverlay
          mode={mode}
          phase={phase}
          countdownMs={countdownMs}
          leaderboard={leaderboard}
          onTap={handleTap}
        />
      )}

      <JoinModal
        visible={showModal}
        lastName={lastName}
        firstName={firstName}
        onLastNameChange={setLastName}
        onFirstNameChange={setFirstName}
        onSubmit={handleJoin}
        error={modalError}
      />
    </main>
  );
}

type JoinModalProps = {
  visible: boolean;
  lastName: string;
  firstName: string;
  onLastNameChange: (value: string) => void;
  onFirstNameChange: (value: string) => void;
  onSubmit: () => void;
  error: string | null;
};

function JoinModal({ visible, lastName, firstName, onLastNameChange, onFirstNameChange, onSubmit, error }: JoinModalProps) {
  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-6">
      <div className="glass-panel w-full max-w-md rounded-2xl px-6 py-8 shadow-brand">
        <h2 className="text-2xl font-semibold text-brand-terra-600">参加登録</h2>
        <p className="mt-2 text-sm text-brand-blue-700/80">お席で配布されたQRコードからアクセスしています。下記に本名を入力してください。</p>
        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-blue-700" htmlFor="last-name">
              姓
            </label>
            <input
              id="last-name"
              className="w-full rounded-xl border border-brand-blue-200 bg-white px-4 py-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
              value={lastName}
              onChange={(event) => onLastNameChange(event.target.value)}
              placeholder="例：山田"
              autoComplete="family-name"
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-brand-blue-700" htmlFor="first-name">
              名
            </label>
            <input
              id="first-name"
              className="w-full rounded-xl border border-brand-blue-200 bg-white px-4 py-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
              value={firstName}
              onChange={(event) => onFirstNameChange(event.target.value)}
              placeholder="例：花子"
              autoComplete="given-name"
              required
            />
          </div>
          {error && (
            <p className="text-sm text-error" role="alert">
              {error}
            </p>
          )}
          <PrimaryButton type="submit" className="mt-2">
            参加する
          </PrimaryButton>
        </form>
      </div>
    </div>
  );
}

type CountupOverlayProps = {
  mode: RoomView;
  phase: 'idle' | 'running' | 'ended';
  countdownMs: number;
  leaderboard: LeaderboardEntry[];
  onTap: () => Promise<void> | void;
};

function CountupOverlay({ mode, phase, countdownMs, leaderboard, onTap }: CountupOverlayProps) {
  const [localCountdown, setLocalCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [sparkles, setSparkles] = useState<Array<{ id: string; left: number; top: number }>>([]);
  const [phaseEndTime, setPhaseEndTime] = useState<number | null>(null);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState<number | null>(null);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [banner, setBanner] = useState<'start' | 'stop' | null>(null);
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
      setShowResults(true);
      setBanner(null);
      stopDelayRef.current = null;
    }, STOP_BANNER_DURATION_MS);
  }, [clearStartDelay, clearStopDelay]);

  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (mode !== 'countup') {
      clearStartDelay();
      clearStopDelay();
      finishTriggeredRef.current = false;
      setLocalCountdown(null);
      setPhaseEndTime(null);
      setTimeLeftSeconds(null);
      setIsTimerRunning(false);
      setIsFinished(false);
      setBanner(null);
      setShowResults(false);
      prevPhaseRef.current = phase;
      return;
    }

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
      setShowResults(false);
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
      setShowResults(false);
    }

    prevPhaseRef.current = phase;
  }, [mode, phase, clearStartDelay, clearStopDelay, triggerFinish]);

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
    if (mode !== 'countup') return;
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
  }, [mode, phase, localCountdown, isFinished, isTimerRunning, clearStartDelay]);

  useEffect(() => {
    if (!isTimerRunning || mode !== 'countup' || phase !== 'running') {
      return;
    }

    if (countdownMs <= 0) {
      triggerFinish();
      return;
    }

    const now = Date.now();
    const target = now + countdownMs;
    setPhaseEndTime((previous) => {
      if (!previous) {
        return target;
      }
      return target < previous ? target : previous;
    });
    setTimeLeftSeconds(Math.max(0, Math.ceil(countdownMs / 1000)));
  }, [isTimerRunning, mode, phase, countdownMs, triggerFinish]);

  useEffect(() => {
    if (mode !== 'countup') return;
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
  }, [mode, phase, phaseEndTime, isTimerRunning, triggerFinish]);

  if (mode !== 'countup') {
    return null;
  }

  const disabled = phase !== 'running' || localCountdown !== null || !isTimerRunning || banner === 'stop';
  const showPad = !showResults && (phase === 'running' || banner === 'stop');
  const displaySeconds = isTimerRunning && banner !== 'stop' && timeLeftSeconds !== null ? timeLeftSeconds : '';

  const handleTap = () => {
    if (disabled) return;
    navigator.vibrate?.(10);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 150);
    void onTap();

    const sparkleId = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    const sparkle = {
      id: sparkleId,
      left: 30 + Math.random() * 40,
      top: 40 + Math.random() * 20
    };
    setSparkles((prev) => [...prev, sparkle]);
    window.setTimeout(() => {
      setSparkles((prev) => prev.filter((item) => item.id !== sparkle.id));
    }, 600);
  };

  const topThree = leaderboard.slice(0, 3);

  return (
    <>
      {showPad && (
        <button
          type="button"
          onPointerDown={handleTap}
          disabled={disabled}
          className="fixed inset-0 z-30 flex select-none items-center justify-center bg-brand-blue-50 transition active:bg-brand-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
        <div className="pointer-events-none absolute top-12 text-[min(14vw,6rem)] font-semibold text-brand-blue-700 drop-shadow">
          {displaySeconds}
        </div>
        {banner === 'start' ? (
          <span className="text-[min(26vw,12rem)] font-semibold uppercase tracking-widest text-brand-terra-600 drop-shadow">
            START!
          </span>
        ) : banner === 'stop' ? (
          <span className="text-[min(26vw,12rem)] font-semibold uppercase tracking-widest text-brand-terra-600 drop-shadow">
            STOP!
          </span>
        ) : localCountdown !== null ? (
          <span className="text-[min(40vw,18rem)] font-serif font-semibold leading-none text-brand-blue-700 drop-shadow">
            {localCountdown}
          </span>
        ) : isTimerRunning ? (
          <span className="text-[min(18vw,7rem)] font-semibold text-brand-blue-700 drop-shadow">TAP!</span>
        ) : (
          <span className="text-3xl font-semibold text-brand-blue-700">開始を待っています</span>
        )}
        {flash && (
          <span className="pointer-events-none absolute inset-x-0 top-1/4 text-center text-4xl font-bold text-brand-terra-600 opacity-90 animate-ping">
            +1
          </span>
        )}
        {sparkles.map((sparkle) => (
          <span
            key={sparkle.id}
            className="pointer-events-none absolute text-3xl text-brand-terra-600 sparkle-pop"
            style={{ left: `${sparkle.left}%`, top: `${sparkle.top}%` }}
          >
            ✨
          </span>
        ))}
        </button>
      )}
      {showResults && topThree.length > 0 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 px-6">
          <div className="glass-panel w-full max-w-xl rounded-2xl p-8 shadow-brand">
            <h2 className="text-2xl font-semibold text-brand-terra-600">TOP 3</h2>
            <ul className="mt-6 space-y-3">
              {topThree.map((entry, index) => (
                <li
                  key={entry.playerId}
                  className="flex items-center justify-between rounded-xl bg-white/80 px-4 py-3 text-lg shadow-brand"
                >
                  <span className="font-semibold">
                    {medalForRank(index + 1)} {entry.displayName}
                  </span>
                  <span className="font-bold text-brand-terra-600">{entry.totalPoints} pt</span>
                </li>
              ))}
            </ul>
            <PrimaryButton type="button" className="mt-6" onClick={() => setShowResults(false)}>
              閉じる
            </PrimaryButton>
          </div>
        </div>
      )}
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
