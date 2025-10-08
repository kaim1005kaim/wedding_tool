'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@wedding_tool/ui';

export default function AdminEntryPage() {
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setError('ルームコードを入力してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Fetch room ID from room code
      const response = await fetch(`/api/rooms/lookup?code=${encodeURIComponent(roomCode)}`);

      if (!response.ok) {
        throw new Error('ルームが見つかりません');
      }

      const data = await response.json() as { roomId: string };
      router.push(`/admin/${data.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 p-6 text-center">
      <h1 className="text-3xl font-semibold">管理画面</h1>
      <p className="text-sm text-slate-300">ルームコードを入力してください</p>

      <form onSubmit={handleSubmit} className="w-full space-y-4">
        <input
          type="text"
          className="w-full rounded border border-slate-300 bg-white px-4 py-3 text-center text-lg uppercase text-slate-900 placeholder:text-slate-400"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="例: AB12"
          disabled={loading}
        />

        {error && <p className="text-sm text-rose-300">{error}</p>}

        <Button
          type="submit"
          className="w-full px-4 py-3 text-lg"
          disabled={loading}
        >
          {loading ? 'Loading...' : '管理画面へ'}
        </Button>
      </form>

    </main>
  );
}
