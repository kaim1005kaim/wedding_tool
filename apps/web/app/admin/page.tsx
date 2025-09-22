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
          className="w-full rounded border border-slate-600 bg-slate-900 px-4 py-3 text-center text-lg uppercase"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
          placeholder="例: TEST"
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

      <div className="mt-8 space-y-2 text-sm text-slate-400">
        <p>デモ環境の場合:</p>
        <p className="font-mono">ルームコード: TEST</p>
        <p className="font-mono">PIN: 1234</p>
      </div>
    </main>
  );
}