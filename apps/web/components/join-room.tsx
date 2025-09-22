'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@wedding_tool/ui';
import { useRealtimeClient } from '../lib/realtime-context';
import { useRoomStore } from '../lib/store/room-store';
import { appConfig } from '../lib/env';

export default function JoinRoom({ code }: { code: string }) {
  const [name, setName] = useState('');
  const [tableNo, setTableNo] = useState('');
  const [seatNo, setSeatNo] = useState('');
  const [registered, setRegistered] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = useRealtimeClient();
  const mode = useRoomStore((state) => state.mode);
  const leaderboard = useRoomStore((state) => state.leaderboard);
  const playerToken = useRoomStore((state) => state.playerToken);
  const setPlayerAuth = useRoomStore((state) => state.setPlayerAuth);
  const clearPlayerAuth = useRoomStore((state) => state.clearPlayerAuth);

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
          return;
        }
      } catch (err) {
        // ignore parse errors, fallthrough to cleanup
      }
      window.localStorage.removeItem(storageKey);
      clearPlayerAuth();
      setRegistered(false);
    }
  }, [isCloudMode, storageKey, setPlayerAuth, clearPlayerAuth]);

  const getDeviceFingerprint = () => {
    if (typeof window === 'undefined') return undefined;
    let fingerprint = window.localStorage.getItem(fingerprintKey);
    if (!fingerprint) {
      // Use only UUID to ensure it fits in 128 chars
      fingerprint = crypto.randomUUID();
      window.localStorage.setItem(fingerprintKey, fingerprint);
    }
    // Ensure it's not too long (max 128 chars)
    return fingerprint.substring(0, 128);
  };

  const handleJoin = async () => {
    setError(null);
    try {
      if (isCloudMode) {
        // First, get room ID from room code
        const lookupResponse = await fetch(`/api/rooms/lookup?code=${encodeURIComponent(code)}`);
        if (!lookupResponse.ok) {
          throw new Error('ルームが見つかりません');
        }
        const { roomId } = await lookupResponse.json() as { roomId: string };

        // Then join with the room ID
        const response = await fetch(`/api/rooms/${roomId}/join`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            displayName: name.trim(),
            tableNo: tableNo.trim() || undefined,
            seatNo: seatNo.trim() || undefined,
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
        }
      } else {
        await client.emit({
          type: 'hello',
          payload: {
            displayName: name.trim(),
            tableNo: tableNo.trim() || undefined,
            seatNo: seatNo.trim() || undefined
          }
        });
      }
      setRegistered(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : '参加に失敗しました');
      setRegistered(false);
    }
  };

  const handleTap = async () => {
    try {
      if (isCloudMode) {
        if (!playerToken) {
          throw new Error('参加手続きを完了してください');
        }
        const response = await fetch(`/api/rooms/${code}/tap`, {
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl flex-col gap-8 p-6">
      <header className="space-y-2 text-center">
        <h1 className="text-3xl font-semibold">ルーム {code.toUpperCase()} に参加</h1>
        <p className="text-sm text-slate-300">
          自分の名前と席情報を入力して参加してください。ゲーム中の操作は同じページから行います。
        </p>
      </header>
      {!registered ? (
        <form className="flex flex-col gap-4" onSubmit={(event) => event.preventDefault()}>
          <label className="flex flex-col gap-2">
            <span className="text-sm text-slate-200">名前</span>
            <input
              className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-base"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="例：Kai"
              required
            />
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="flex flex-col gap-2">
              <span className="text-sm text-slate-200">卓番号</span>
              <input
                className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-base"
                value={tableNo}
                onChange={(event) => setTableNo(event.target.value)}
                placeholder="例：A"
              />
            </label>
            <label className="flex flex-col gap-2">
              <span className="text-sm text-slate-200">席番号</span>
              <input
                className="rounded border border-slate-600 bg-slate-900 px-3 py-2 text-base"
                value={seatNo}
                onChange={(event) => setSeatNo(event.target.value)}
                placeholder="例：12"
              />
            </label>
          </div>
          {error && <p className="text-sm text-rose-300">{error}</p>}
          <Button
            type="button"
            className="mt-4 w-full px-4 py-3 text-lg"
            onClick={handleJoin}
            disabled={name.trim().length === 0}
          >
            参加する
          </Button>
        </form>
      ) : (
        <section className="flex flex-1 flex-col gap-6">
          <div className="rounded border border-brand/20 bg-brand/10 p-4 text-center text-2xl font-semibold">
            {mode === 'countup' && '連打！'}
            {mode === 'quiz' && 'クイズ回答！'}
            {mode === 'lottery' && '抽選待機中'}
            {mode === 'idle' && '次のゲームを待っています'}
          </div>
          {mode === 'countup' && (
            <Button className="h-48 w-full text-4xl" onClick={handleTap}>
              TAP!
            </Button>
          )}
          <section className="space-y-2">
            <h2 className="text-sm uppercase tracking-wide text-slate-400">Leaderboard</h2>
            <ul className="space-y-2">
              {leaderboard.map((entry) => (
                <li key={entry.playerId} className="flex items-center justify-between rounded bg-slate-800/60 px-3 py-2">
                  <span className="text-lg font-semibold">
                    {entry.rank}. {entry.displayName}
                  </span>
                  <span className="text-xl font-bold">{entry.totalPoints}</span>
                </li>
              ))}
            </ul>
          </section>
        </section>
      )}
    </main>
  );
}
