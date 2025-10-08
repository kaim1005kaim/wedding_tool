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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-8 bg-gradient-to-br from-brand-blue-100 via-ecru to-brand-terra-100 p-6 text-center">
      <div className="slide-up">
        <div className="mb-6 text-6xl">🔐</div>
        <h1 className="text-title-lg font-bold text-brand-blue-700">管理画面</h1>
        <p className="mt-3 text-base text-brand-blue-700/70">ルームコードを入力してください</p>
      </div>

      <form onSubmit={handleSubmit} className="w-full space-y-6">
        <div className="glass-panel-strong rounded-3xl p-8 shadow-brand-lg bounce-in">
          <label className="mb-3 flex items-center justify-center gap-2 text-sm font-bold text-brand-blue-700">
            <span>🎮</span>
            <span>ルームコード</span>
          </label>
          <input
            type="text"
            className="w-full rounded-2xl border-2 border-brand-blue-200 bg-white px-6 py-5 text-center text-2xl font-bold uppercase tracking-wider text-slate-900 shadow-brand-sm transition-all duration-300 placeholder:text-slate-400 hover:border-brand-blue-300 focus:border-brand-blue-500 focus:shadow-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            placeholder="AB12"
            disabled={loading}
            maxLength={6}
          />
        </div>

        {error && (
          <div className="rounded-2xl bg-error-light px-5 py-3 text-sm font-semibold text-error shadow-brand-sm bounce-in">
            ⚠️ {error}
          </div>
        )}

        <Button
          type="submit"
          className="w-full rounded-2xl bg-gradient-secondary px-6 py-5 text-lg font-bold text-white shadow-brand-md transition-all duration-300 hover:scale-[1.02] hover:shadow-brand-lg active:scale-[0.98] disabled:opacity-60"
          disabled={loading}
        >
          {loading ? '読み込み中...' : '→ 管理画面へ'}
        </Button>
      </form>
    </main>
  );
}
