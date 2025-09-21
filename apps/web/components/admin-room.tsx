'use client';

import { useEffect, useState } from 'react';
import { Button } from '@wedding_tool/ui';
import { useRealtimeClient } from '../lib/realtime-context';
import { useRoomStore } from '../lib/store/room-store';

export default function AdminRoom({ roomId }: { roomId: string }) {
  const [pin, setPin] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const client = useRealtimeClient();
  const mode = useRoomStore((state) => state.mode);
  const phase = useRoomStore((state) => state.phase);
  const countdownMs = useRoomStore((state) => state.countdownMs);

  useEffect(() => {
    setError(null);
  }, [isAuthenticated]);

  const handleUnlock = async () => {
    // TODO: replace with secure API call that validates PIN
    if (pin.trim().length > 0) {
      setIsAuthenticated(true);
    } else {
      setError('PINを入力してください');
    }
  };

  const send = async (event: Parameters<typeof client.emit>[0]) => {
    try {
      await client.emit(event);
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作に失敗しました');
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
      <section className="rounded border border-slate-700 bg-slate-900/60 p-4 text-sm text-slate-200">
        <h2 className="mb-3 text-lg font-semibold">進行ログ</h2>
        <p>本番ロジック実装前のダミー表示です。</p>
      </section>
    </main>
  );
}
