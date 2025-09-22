'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRealtimeClient } from '../lib/realtime-context';
import { useRoomStore } from '../lib/store/room-store';
import { appConfig } from '../lib/env';
import { Section, PrimaryButton } from './brand';
import type { LeaderboardEntry, RoomView } from '../lib/store/room-store';

export default function JoinRoom({ code }: { code: string }) {
  const [name, setName] = useState('');
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [connection, setConnection] = useState<'good' | 'warn' | 'bad'>('good');
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
    if (!isCloudMode) return;
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        const { playerId, token, expiresAt } = JSON.parse(stored) as {
          playerId: string;
          token: string;
          expiresAt: number;
        };
        if (expiresAt > Date.now()) {
          setPlayerAuth({ playerId, token });
          setRegistered(true);
          setDisplayName(window.localStorage.getItem(`${storageKey}:name`) ?? '');
          const cachedRoom = window.localStorage.getItem(`${storageKey}:room`);
          if (cachedRoom) {
            setRoomId(cachedRoom);
          }
          return;
        }
      } catch (err) {
        // ignore parse errors
      }
      window.localStorage.removeItem(storageKey);
      window.localStorage.removeItem(`${storageKey}:name`);
      window.localStorage.removeItem(`${storageKey}:room`);
      clearPlayerAuth();
      setRegistered(false);
    }
  }, [isCloudMode, storageKey, setPlayerAuth, clearPlayerAuth]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const getStatus = (): 'good' | 'warn' | 'bad' => {
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
            displayName: name.trim(),
            deviceFingerprint: getDeviceFingerprint()
          })
        });

        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? response.statusText);
        }

        const { token, playerId, expiresAt } = (await response.json()) as {
          token: string;
          playerId: string;
          expiresAt: number;
        };
        setPlayerAuth({ playerId, token });
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(storageKey, JSON.stringify({ token, playerId, expiresAt }));
          window.localStorage.setItem(`${storageKey}:name`, name.trim());
          window.localStorage.setItem(`${storageKey}:room`, fetchedRoomId);
        }
      } else {
        await client.emit({
          type: 'hello',
          payload: {
            displayName: name.trim()
          }
        });
      }
      setRegistered(true);
      setDisplayName(name.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : '参加に失敗しました');
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

  const handleReset = () => {
    setRegistered(false);
    setName(displayName);
  };

  const connectionConfig: Record<'good' | 'warn' | 'bad', { label: string; dot: string }> = {
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

        {!registered ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) {
                setError('お名前を入力してください');
                return;
              }
              void handleJoin();
            }}
          >
            <div className="space-y-2">
              <label className="text-sm font-medium" htmlFor="displayName">
                お名前
              </label>
              <input
                id="displayName"
                className="w-full rounded-xl border border-brand-blue-200 bg-white px-4 py-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (error) setError(null);
                }}
                placeholder="例：Kai"
                autoComplete="name"
                required
              />
            </div>
            {error && (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            )}
            <PrimaryButton type="submit" disabled={name.trim().length === 0}>
              参加する
            </PrimaryButton>
            <p className="text-sm text-brand-blue-700/80">お名前を入力し、「参加する」を押してください。ゲームの操作はこのページから行えます。</p>
          </form>
        ) : (
          <div className="space-y-6" aria-live="polite">
            <div className="glass-panel rounded-2xl border border-white/40 px-6 py-5 shadow-brand">
              <p className="text-lg font-semibold">{displayName} さん、ゲーム開始までお待ちください。</p>
              <button
                type="button"
                className="mt-3 text-sm text-brand-blue-700 underline decoration-brand-blue-400 decoration-dashed"
                onClick={handleReset}
              >
                お名前を変更する
              </button>
            </div>

            <div className="rounded-2xl bg-white/70 p-6 shadow-brand">
              <h2 className="text-xl font-semibold text-brand-blue-700">タップチャレンジ</h2>
              <p className="mt-2 text-sm text-brand-blue-700/80">
                {mode === 'countup'
                  ? phase === 'running'
                    ? 'テンポよくタップして、チームを盛り上げましょう！'
                    : '合図が出るまでそのままお待ちください。スタート直前にカウントダウンが表示されます。'
                  : mode === 'quiz'
                    ? 'クイズが表示されたら、画面の指示に従って回答してください。'
                    : mode === 'lottery'
                      ? '抽選の結果発表をお待ちください。'
                      : 'まもなくゲームが始まります。'}
              </p>
            </div>

            <div className="rounded-2xl bg-brand-blue-50/70 p-6">
              <h2 className="text-xl font-semibold text-brand-blue-700">現在のランキング</h2>
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
            </div>

            {error && !playerToken && (
              <p className="text-sm text-error" role="alert">
                {error}
              </p>
            )}
          </div>
        )}
      </Section>
      {registered && (
        <CountupOverlay
          mode={mode}
          phase={phase}
          countdownMs={countdownMs}
          leaderboard={leaderboard}
          onTap={handleTap}
        />
      )}
    </main>
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
  const prevPhaseRef = useRef<typeof phase>();

  useEffect(() => {
    const prev = prevPhaseRef.current;
    if (mode !== 'countup') {
      setLocalCountdown(null);
      setShowResults(false);
      prevPhaseRef.current = phase;
      return;
    }

    if (phase === 'running' && prev !== 'running') {
      setLocalCountdown(3);
      setShowResults(false);
    }

    if (phase === 'ended' && prev !== 'ended') {
      setShowResults(true);
    }

    prevPhaseRef.current = phase;
  }, [mode, phase]);

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

  if (mode !== 'countup') {
    return null;
  }

  const disabled = phase !== 'running' || localCountdown !== null;

  const handleTap = () => {
    if (disabled) return;
    navigator.vibrate?.(10);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 150);
    void onTap();
  };

  const topThree = leaderboard.slice(0, 3);

  return (
    <>
      <button
        type="button"
        onPointerDown={handleTap}
        disabled={disabled}
        className="fixed inset-0 z-30 flex select-none items-center justify-center bg-brand-blue-50 transition active:bg-brand-blue-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {localCountdown !== null ? (
          <span className="text-6xl font-serif font-semibold text-brand-blue-700 drop-shadow">{localCountdown}</span>
        ) : phase === 'running' ? (
          <span className="text-5xl font-semibold text-brand-blue-700 drop-shadow">TAP!</span>
        ) : phase === 'ended' ? (
          <span className="text-3xl font-semibold text-brand-blue-700">お疲れさまでした</span>
        ) : (
          <span className="text-3xl font-semibold text-brand-blue-700">開始を待っています</span>
        )}
        {flash && (
          <span className="pointer-events-none absolute inset-x-0 top-1/4 text-center text-4xl font-bold text-brand-terra-600 opacity-90 animate-ping">
            +1
          </span>
        )}
      </button>
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
      {phase === 'running' && countdownMs > 0 && localCountdown === null && (
        <div className="pointer-events-none fixed bottom-6 right-6 z-40 rounded-xl bg-white/80 px-4 py-2 text-sm text-brand-blue-700 shadow-brand">
          残り {Math.ceil(countdownMs / 1000)} 秒
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
