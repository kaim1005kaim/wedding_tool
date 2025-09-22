'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@wedding_tool/ui';
import { useRealtimeClient } from '../lib/realtime-context';
import { useRoomStore } from '../lib/store/room-store';
import { appConfig } from '../lib/env';

export default function AdminRoom({ roomId }: { roomId: string }) {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<Array<{ id: number; action: string; created_at: string; payload?: Record<string, unknown> }>>([]);
  const [lotteries, setLotteries] = useState<Array<{ kind: string; created_at: string; players?: { display_name: string; table_no?: string | null; seat_no?: string | null } }>>([]);
  const [adminToken, setAdminTokenState] = useState<string | null>(null);
  const client = useRealtimeClient();
  const mode = useRoomStore((state) => state.mode);
  const phase = useRoomStore((state) => state.phase);
  const countdownMs = useRoomStore((state) => state.countdownMs);
  const activeQuiz = useRoomStore((state) => state.activeQuiz);
  const isCloudMode = appConfig.mode === 'cloud';
  const storageKey = useMemo(() => `wedding_tool:${roomId}:admin`, [roomId]);

  useEffect(() => {
    if (!isCloudMode) return;
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        const { token, expiresAt } = JSON.parse(stored) as { token: string; expiresAt: number };
        if (expiresAt > Date.now()) {
          setAdminToken(token);
          setIsAuthenticated(true);
        } else {
          window.localStorage.removeItem(storageKey);
        }
      } catch (error) {
        window.localStorage.removeItem(storageKey);
      }
    }
  }, [isCloudMode, storageKey]);

  const setAdminToken = (token: string | null) => {
    setAdminTokenState(token);
  };

  useEffect(() => {
    setError(null);
  }, [isAuthenticated]);

  const loadLogs = useCallback(async () => {
    if (!isAuthenticated || !isCloudMode || !adminToken) return;
    try {
      const response = await fetch(`/api/admin/rooms/${roomId}/logs`, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        }
      });
      if (response.ok) {
        const { logs: auditLogs, lotteries: lotteryLogs } = (await response.json()) as {
          logs: typeof logs;
          lotteries: typeof lotteries;
        };
        setLogs(auditLogs);
        setLotteries(lotteryLogs);
      }
    } catch (err) {
      console.error(err);
    }
  }, [adminToken, isAuthenticated, isCloudMode, roomId]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const handleUnlock = async () => {
    if (pin.trim().length === 0) {
      setError('PINを入力してください');
      return;
    }

    if (!isCloudMode) {
      setIsAuthenticated(true);
      return;
    }

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ roomId, pin })
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? response.statusText);
      }

      const { token, expiresAt } = (await response.json()) as { token: string; expiresAt: number };
      setAdminToken(token);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, JSON.stringify({ token, expiresAt }));
      }
      setIsAuthenticated(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PINの検証に失敗しました');
      setIsAuthenticated(false);
    }
  };

  const send = async (event: Parameters<typeof client.emit>[0]) => {
    try {
      if (isCloudMode) {
        if (!adminToken) {
          throw new Error('管理トークンがありません。再ログインしてください');
        }
        const url = resolveAdminEndpoint(roomId, event);
        const payload = buildPayload(event.type, event.payload ?? {});
        const hasBody = Object.keys(payload).length > 0;
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
            Authorization: `Bearer ${adminToken}`
          },
          ...(hasBody ? { body: JSON.stringify(payload) } : {})
        });
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error ?? response.statusText);
        }
        await loadLogs();
      } else {
        await client.emit(event);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作に失敗しました');
    }
  };

  const resolveAdminEndpoint = (roomId: string, event: Parameters<typeof client.emit>[0]) => {
    switch (event.type) {
      case 'mode:switch':
        return `/api/admin/rooms/${roomId}/mode`;
      case 'game:start':
        return `/api/admin/rooms/${roomId}/game/start`;
      case 'game:stop':
        return `/api/admin/rooms/${roomId}/game/stop`;
      case 'quiz:next':
        return `/api/admin/rooms/${roomId}/quiz/next`;
      case 'quiz:reveal':
        return `/api/admin/rooms/${roomId}/quiz/reveal`;
      case 'lottery:draw':
        return `/api/admin/rooms/${roomId}/lottery/draw`;
      default:
        throw new Error(`Unsupported admin event: ${event.type}`);
    }
  };

  const buildPayload = (type: Parameters<typeof client.emit>[0]['type'], payload: Record<string, unknown>) => {
    switch (type) {
      case 'quiz:next':
        return {};
      case 'quiz:reveal': {
        if (Object.keys(payload).length > 0) {
          return payload;
        }
        if (!activeQuiz) {
          throw new Error('表示中のクイズがありません');
        }
        return { quizId: activeQuiz.quizId };
      }
      default:
        return payload;
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-3xl font-semibold">管理コンソール</h1>
        <p className="text-sm text-slate-300">進行用の共有PINを入力してください。</p>
        <input
          type="password"
          className="w-full rounded border border-slate-600 bg-slate-900 px-4 py-3 text-center text-lg"
          value={pin}
          onChange={(event) => setPin(event.target.value)}
          placeholder="PIN"
        />
        {error && <p className="text-sm text-rose-300">{error}</p>}
        <Button className="w-full px-4 py-3 text-lg" onClick={handleUnlock}>
          ログイン
        </Button>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">管理パネル</h1>
          <p className="text-sm text-slate-300">Room ID: {roomId}</p>
        </div>
        <div className="text-right text-sm text-slate-300">
          <p>Mode: {mode}</p>
          <p>Phase: {phase}</p>
          <p>Countdown: {Math.ceil(countdownMs / 1000)}s</p>
        </div>
      </header>
      {error && <p className="text-sm text-rose-300">{error}</p>}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Button className="h-24 text-xl" onClick={() => send({ type: 'mode:switch', payload: { to: 'countup' } })}>
          カウントアップ
        </Button>
        <Button className="h-24 text-xl" onClick={() => send({ type: 'mode:switch', payload: { to: 'quiz' } })}>
          クイズ
        </Button>
        <Button className="h-24 text-xl" onClick={() => send({ type: 'mode:switch', payload: { to: 'lottery' } })}>
          くじ
        </Button>
      </section>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Button className="h-20" onClick={() => send({ type: 'game:start', payload: undefined })}>
          START
        </Button>
        <Button className="h-20" onClick={() => send({ type: 'game:stop', payload: undefined })}>
          STOP
        </Button>
        <Button className="h-20" onClick={() => send({ type: 'quiz:next', payload: undefined })}>
          QUIZ NEXT
        </Button>
        <Button className="h-20" onClick={() => send({ type: 'quiz:reveal', payload: undefined })}>
          QUIZ REVEAL
        </Button>
      </section>
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Button className="h-24" onClick={() => send({ type: 'lottery:draw', payload: { kind: 'escort' } })}>
          抽選 Escort
        </Button>
        <Button className="h-24" onClick={() => send({ type: 'lottery:draw', payload: { kind: 'cake_groom' } })}>
          抽選 Groom
        </Button>
        <Button className="h-24" onClick={() => send({ type: 'lottery:draw', payload: { kind: 'cake_bride' } })}>
          抽選 Bride
        </Button>
      </section>
      {isCloudMode && (
        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-200">
            <h2 className="mb-3 text-lg font-semibold">進行ログ</h2>
            {logs.length === 0 ? (
              <p className="text-slate-400">ログはまだありません。</p>
            ) : (
              <ul className="space-y-2">
                {logs.map((log) => (
                  <li key={log.id} className="rounded border border-slate-700/60 bg-slate-800/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{log.action}</span>
                      <span className="text-xs text-slate-400">{new Date(log.created_at).toLocaleString()}</span>
                    </div>
                    {log.payload && (
                      <pre className="mt-2 overflow-x-auto rounded bg-slate-900/80 p-2 text-xs text-slate-300">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-200">
            <h2 className="mb-3 text-lg font-semibold">抽選履歴</h2>
            {lotteries.length === 0 ? (
              <p className="text-slate-400">抽選はまだ行われていません。</p>
            ) : (
              <ul className="space-y-2">
                {lotteries.map((entry, index) => (
                  <li key={`${entry.kind}-${index}`} className="rounded border border-amber-500/30 bg-amber-500/10 p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{entry.kind}</span>
                      <span className="text-xs text-slate-400">{new Date(entry.created_at).toLocaleString()}</span>
                    </div>
                    <p className="mt-1 text-base font-semibold">
                      {entry.players?.display_name ?? 'Unknown'}
                    </p>
                    <p className="text-xs text-slate-300">
                      {entry.players?.table_no ? `卓 ${entry.players.table_no}` : ''}{' '}
                      {entry.players?.seat_no ? `席 ${entry.players.seat_no}` : ''}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
