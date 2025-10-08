'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@wedding_tool/ui';

export default function AdminEntryPage() {
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim()) {
      setError('ルームコードを入力してください');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccessMessage(null);

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

  const handleCreateRoom = async () => {
    setCreating(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? 'ルーム作成に失敗しました');
      }

      const data = await response.json() as { roomId: string; code: string };
      setRoomCode(data.code);
      setSuccessMessage(`新しいルームを作成しました: ${data.code}`);

      // Auto-navigate after 2 seconds
      setTimeout(() => {
        router.push(`/admin/${data.roomId}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setCreating(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-blue-100 via-ecru to-brand-terra-100 p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center slide-up">
          <div className="mb-4 text-6xl">🔐</div>
          <h1 className="text-3xl font-bold text-brand-blue-700">管理画面</h1>
          <p className="mt-2 text-sm text-brand-blue-700/70">ルームコードを入力してください</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="glass-panel-strong rounded-2xl p-6 shadow-brand-lg bounce-in">
            <label className="mb-3 flex items-center justify-center gap-2 text-sm font-bold text-brand-blue-700">
              <span>🎮</span>
              <span>ルームコード</span>
            </label>
            <input
              type="text"
              className="w-full rounded-xl border-2 border-brand-blue-200 bg-white px-4 py-4 text-center text-2xl font-bold uppercase tracking-wider text-slate-900 shadow-brand-sm transition-all duration-300 placeholder:text-slate-400 hover:border-brand-blue-300 focus:border-brand-blue-500 focus:shadow-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="AB12"
              disabled={loading}
              maxLength={6}
            />
          </div>

          {error && (
            <div className="rounded-xl bg-error-light px-4 py-3 text-sm font-semibold text-error shadow-brand-sm bounce-in">
              ⚠️ {error}
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl bg-success-light px-4 py-3 text-sm font-semibold text-success shadow-brand-sm bounce-in">
              ✓ {successMessage}
            </div>
          )}

          <Button
            type="submit"
            className="w-full rounded-xl bg-gradient-secondary px-6 py-4 text-base font-bold text-white shadow-brand-md transition-all duration-300 hover:scale-[1.02] hover:shadow-brand-lg active:scale-[0.98] disabled:opacity-60"
            disabled={loading || creating}
          >
            {loading ? '読み込み中...' : '→ 管理画面へ'}
          </Button>
        </form>

        <div className="space-y-4">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-brand-blue-200"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-gradient-to-br from-brand-blue-100 via-ecru to-brand-terra-100 px-3 font-semibold text-brand-blue-700">または</span>
            </div>
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={creating || loading}
            className="w-full rounded-xl border-2 border-brand-blue-300 bg-white/90 px-6 py-4 text-base font-bold text-brand-blue-700 shadow-brand-sm transition-all duration-300 hover:scale-[1.02] hover:border-brand-blue-400 hover:bg-brand-blue-50 hover:shadow-brand active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {creating ? '作成中...' : '+ 新しいルームを作成'}
          </button>

          <p className="text-center text-xs text-brand-blue-700/60">
            新しいルームを作成すると、4桁のルームコードが自動生成されます（デフォルトPIN: 1234）
          </p>
        </div>
      </div>
    </main>
  );
}
