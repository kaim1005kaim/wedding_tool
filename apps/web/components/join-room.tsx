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
    <main className="min-h-screen bg-gradient-to-br from-brand-blue-50/30 via-ecru to-brand-terra-50/30 px-6 py-10">
      <Section>
        <div className="mb-6 flex items-center justify-between rounded-2xl bg-white/90 px-5 py-3 shadow-brand-sm slide-up backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${connectionConfig[connection].dot} text-white text-xs font-bold animate-pulse-ring`} aria-hidden="true">
              {connectionConfig[connection].icon}
            </span>
            <span className="font-medium text-brand-blue-700">{connectionConfig[connection].label}</span>
          </div>
          <span className="text-xs text-brand-blue-700/60">リアルタイム接続</span>
        </div>

        {registered ? (
          <div className="glass-panel-strong rounded-3xl border-2 border-brand-terra-200/50 px-8 py-6 text-center shadow-brand-md bounce-in" aria-live="polite">
            <div className="mb-3 text-4xl">🎉</div>
            <p className="text-xl font-bold text-brand-blue-700">参加登録完了！</p>
            <p className="mt-3 text-lg text-brand-blue-700/80">
              <span className="rounded-full bg-brand-terra-100 px-4 py-1 font-semibold text-brand-terra-700">{registeredTableNo}</span>
              <span className="mx-2">テーブル</span>
            </p>
            <p className="mt-2 text-2xl font-bold text-brand-terra-600">{registeredName} さん</p>
            <p className="mt-4 text-sm text-brand-blue-700/70">ゲーム開始までお待ちください</p>
          </div>
        ) : (
          <div className="rounded-3xl bg-gradient-to-br from-white/90 to-white/70 p-8 text-center shadow-brand-md backdrop-blur-sm slide-up">
            <div className="mb-4 text-5xl">📱</div>
            <p className="text-lg font-semibold text-brand-blue-700">参加登録してください</p>
            <p className="mt-3 text-sm leading-relaxed text-brand-blue-700/70">
              画面中央のモーダルでテーブル番号とお名前を入力し、<br />
              「参加する」ボタンを押してください
            </p>
          </div>
        )}

        {registered && error && (
          <div className="mt-4 rounded-2xl bg-error-light px-5 py-3 text-sm text-error shadow-brand-sm bounce-in" role="alert">
            ⚠️ {error}
          </div>
        )}
      </Section>

      {registered && (
        <div className="mt-8 space-y-6">
          <div className="glass-panel-strong rounded-3xl p-8 text-center shadow-brand-md slide-up">
            <div className="mb-4 text-3xl">
              {mode === 'countup' ? '⚡' : mode === 'quiz' ? '🎯' : mode === 'lottery' ? '🎰' : '🎮'}
            </div>
            <h2 className="text-title-sm font-bold text-brand-blue-700">
              {mode === 'countup' ? 'タップチャレンジ' : mode === 'quiz' ? 'クイズ' : mode === 'lottery' ? '抽選' : 'ゲーム'}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-brand-blue-700/80">
              {mode === 'countup'
                ? phase === 'running'
                  ? '画面全体に表示される TAP ボタンをテンポ良くタップして、スコアを伸ばしましょう！'
                  : '合図が出るまでそのままお待ちください。スタート直前にカウントダウンが表示されます。'
                : mode === 'quiz'
                  ? 'クイズが表示されたら、画面の指示に従って回答してください。正解でポイント獲得！'
                  : mode === 'lottery'
                    ? '抽選の結果発表をお待ちください。当選者はスクリーンに表示されます。'
                    : 'まもなくゲームが始まります。画面の指示に従ってください。'}
            </p>
          </div>

          <div className="glass-panel rounded-3xl p-8 shadow-brand-md slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-title-sm font-bold text-brand-blue-700">🏆 リーダーボード</h2>
              <span className="rounded-full bg-brand-blue-100 px-3 py-1 text-xs font-semibold text-brand-blue-700">
                TOP 10
              </span>
            </div>
            {leaderboard.length === 0 ? (
              <div className="rounded-2xl bg-brand-blue-50/50 px-6 py-8 text-center">
                <div className="mb-3 text-4xl">📊</div>
                <p className="text-sm text-brand-blue-700/70">ランキングはまだ表示されていません</p>
              </div>
            ) : (
              <ul className="space-y-3">
                {leaderboard.slice(0, 10).map((entry, index) => (
                  <li
                    key={entry.playerId}
                    className={`group flex items-center justify-between rounded-2xl px-5 py-4 shadow-brand-sm transition-all duration-300 hover:shadow-brand hover:scale-[1.02] ${
                      index < 3
                        ? 'bg-gradient-to-r from-brand-terra-50 to-brand-blue-50 border-2 border-brand-terra-200'
                        : 'bg-white/90'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full font-bold text-sm ${
                          index === 0
                            ? 'bg-gradient-to-br from-yellow-400 to-yellow-600 text-white'
                            : index === 1
                              ? 'bg-gradient-to-br from-gray-300 to-gray-500 text-white'
                              : index === 2
                                ? 'bg-gradient-to-br from-orange-400 to-orange-600 text-white'
                                : 'bg-brand-blue-100 text-brand-blue-700'
                        }`}
                      >
                        {index < 3 ? ['🥇', '🥈', '🥉'][index] : entry.rank}
                      </span>
                      <span className="font-semibold text-brand-blue-700 group-hover:text-brand-terra-600 transition-colors">
                        {entry.displayName}
                      </span>
                    </div>
                    <span className="rounded-full bg-brand-terra-100 px-4 py-1.5 font-bold text-brand-terra-700 text-sm">
                      {entry.totalPoints}
                      <span className="ml-1 text-xs font-medium">pt</span>
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
        tableNo={tableNo}
        displayName={displayName}
        onTableNoChange={setTableNo}
        onDisplayNameChange={setDisplayName}
        onSubmit={handleJoin}
        error={modalError}
        mode={mode}
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
};

function JoinModal({ visible, tableNo, displayName, onTableNoChange, onDisplayNameChange, onSubmit, error, mode }: JoinModalProps) {
  if (!visible) return null;

  const guidanceText = mode === 'quiz'
    ? '各テーブル代表者の方のみ登録してください。'
    : mode === 'countup'
      ? '全員ご参加ください。'
      : 'テーブル番号とお名前を入力してください。';

  const guidanceIcon = mode === 'quiz' ? '🎯' : mode === 'countup' ? '⚡' : '🎮';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-ink/70 to-ink/90 px-6 backdrop-blur-sm">
      <div className="glass-panel-strong w-full max-w-md rounded-3xl px-8 py-10 shadow-brand-xl bounce-in">
        <div className="mb-6 text-center">
          <div className="mb-4 text-5xl">{guidanceIcon}</div>
          <h2 className="text-title-md font-bold text-brand-terra-600">参加登録</h2>
          <div className="mt-3 rounded-2xl bg-brand-blue-50/70 px-4 py-3">
            <p className="text-sm font-medium leading-relaxed text-brand-blue-700">{guidanceText}</p>
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
            <label className="flex items-center gap-2 text-sm font-bold text-brand-blue-700" htmlFor="table-no">
              <span>📍</span>
              <span>テーブル番号</span>
            </label>
            <input
              id="table-no"
              className="w-full rounded-2xl border-2 border-brand-blue-200 bg-white px-5 py-4 text-lg font-semibold shadow-brand-sm transition-all duration-300 placeholder:text-brand-blue-300 hover:border-brand-blue-300 focus:border-brand-blue-500 focus:shadow-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
              value={tableNo}
              onChange={(event) => onTableNoChange(event.target.value)}
              placeholder="例：A-3 / 5 / C"
              maxLength={8}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm font-bold text-brand-blue-700" htmlFor="display-name">
              <span>👤</span>
              <span>お名前</span>
            </label>
            <input
              id="display-name"
              className="w-full rounded-2xl border-2 border-brand-blue-200 bg-white px-5 py-4 text-lg font-semibold shadow-brand-sm transition-all duration-300 placeholder:text-brand-blue-300 hover:border-brand-blue-300 focus:border-brand-blue-500 focus:shadow-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
              value={displayName}
              onChange={(event) => onDisplayNameChange(event.target.value)}
              placeholder="例：山田花子"
              autoComplete="name"
              maxLength={30}
              required
            />
          </div>
          {error && (
            <div className="rounded-2xl bg-error-light px-4 py-3 text-sm font-semibold text-error shadow-brand-sm bounce-in" role="alert">
              ⚠️ {error}
            </div>
          )}
          <PrimaryButton type="submit" className="mt-6">
            <span className="text-lg">🎉 参加する</span>
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
          className="fixed inset-0 z-30 flex select-none items-center justify-center bg-gradient-to-br from-brand-blue-100 via-brand-blue-50 to-brand-terra-50 transition-all duration-300 active:from-brand-terra-100 active:via-brand-terra-50 active:to-brand-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
        <div className="pointer-events-none absolute top-16 flex flex-col items-center gap-2">
          <div className="rounded-full bg-white/90 px-6 py-3 shadow-brand-lg backdrop-blur-sm">
            <span className="text-[min(14vw,6rem)] font-bold text-brand-blue-700 drop-shadow count-up">{displaySeconds}</span>
          </div>
        </div>
        {banner === 'start' ? (
          <div className="flex flex-col items-center gap-6 bounce-in">
            <span className="text-[min(30vw,14rem)] font-bold uppercase tracking-wider text-brand-terra-600 drop-shadow-2xl animate-pulse-ring">
              START!
            </span>
            <div className="text-6xl animate-bounce">🚀</div>
          </div>
        ) : banner === 'stop' ? (
          <div className="flex flex-col items-center gap-6 bounce-in">
            <span className="text-[min(30vw,14rem)] font-bold uppercase tracking-wider text-brand-terra-600 drop-shadow-2xl">
              STOP!
            </span>
            <div className="text-6xl">🎉</div>
          </div>
        ) : localCountdown !== null ? (
          <div className="flex flex-col items-center gap-4 bounce-in">
            <div className="rounded-full bg-gradient-to-br from-brand-blue-500 to-brand-blue-700 p-12 shadow-brand-xl animate-pulse-ring">
              <span className="text-[min(40vw,18rem)] font-serif font-bold leading-none text-white drop-shadow-2xl">
                {localCountdown}
              </span>
            </div>
            <p className="text-2xl font-bold text-brand-blue-700">準備してください！</p>
          </div>
        ) : isTimerRunning ? (
          <div className="flex flex-col items-center gap-8">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-brand-terra-400 opacity-30 blur-3xl animate-pulse-ring" />
              <div className="relative rounded-full bg-gradient-to-br from-brand-terra-400 to-brand-terra-600 p-16 shadow-brand-xl">
                <span className="text-[min(20vw,9rem)] font-bold uppercase tracking-wider text-white drop-shadow-2xl">
                  TAP!
                </span>
              </div>
            </div>
            <p className="text-2xl font-bold text-brand-blue-700 animate-bounce">タップしてポイント獲得！</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="text-6xl animate-pulse">⏳</div>
            <span className="text-3xl font-bold text-brand-blue-700">開始を待っています</span>
          </div>
        )}
        {flash && (
          <span className="pointer-events-none absolute inset-x-0 top-1/3 text-center text-7xl font-bold text-brand-terra-600 opacity-90 animate-bounce-in drop-shadow-lg">
            +1
          </span>
        )}
        {sparkles.map((sparkle) => (
          <span
            key={sparkle.id}
            className="pointer-events-none absolute text-5xl sparkle-pop drop-shadow-lg"
            style={{ left: `${sparkle.left}%`, top: `${sparkle.top}%` }}
          >
            ✨
          </span>
        ))}
        </button>
      )}
      {showResults && topThree.length > 0 && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-gradient-to-br from-ink/80 to-ink/90 px-6 backdrop-blur-sm">
          <div className="glass-panel-strong w-full max-w-xl rounded-3xl p-10 shadow-brand-xl bounce-in">
            <div className="mb-8 text-center">
              <div className="mb-4 text-6xl">🏆</div>
              <h2 className="text-title-lg font-bold text-brand-terra-600">TOP 3 結果発表！</h2>
              <p className="mt-2 text-sm text-brand-blue-700/70">おめでとうございます！</p>
            </div>
            <ul className="space-y-4">
              {topThree.map((entry, index) => (
                <li
                  key={entry.playerId}
                  className={`group flex items-center justify-between rounded-2xl px-6 py-5 shadow-brand-md transition-all duration-300 hover:shadow-brand-lg hover:scale-[1.02] ${
                    index === 0
                      ? 'bg-gradient-to-r from-yellow-100 to-yellow-50 border-2 border-yellow-400'
                      : index === 1
                        ? 'bg-gradient-to-r from-gray-100 to-gray-50 border-2 border-gray-400'
                        : 'bg-gradient-to-r from-orange-100 to-orange-50 border-2 border-orange-400'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className="text-4xl">{medalForRank(index + 1)}</span>
                    <div>
                      <p className="text-lg font-bold text-brand-blue-700 group-hover:text-brand-terra-600 transition-colors">
                        {entry.displayName}
                      </p>
                      <p className="text-xs text-brand-blue-700/60">Rank #{entry.rank}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-brand-terra-600">{entry.totalPoints}</p>
                    <p className="text-xs font-medium text-brand-blue-700/70">points</p>
                  </div>
                </li>
              ))}
            </ul>
            <PrimaryButton type="button" className="mt-8" onClick={() => setShowResults(false)}>
              <span className="text-lg">✓ 閉じる</span>
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
