'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@wedding_tool/ui';
import { Trash2 } from 'lucide-react';

type Room = {
  id: string;
  code: string;
  created_at: string;
  updated_at: string | null;
};

export default function AdminEntryPage() {
  const [roomCode, setRoomCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);
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

  useEffect(() => {
    const loadRooms = async () => {
      try {
        const response = await fetch('/api/rooms/list');
        if (response.ok) {
          const data = await response.json() as { rooms: Room[] };
          setRooms(data.rooms);
        }
      } catch (err) {
        console.error('Failed to load rooms:', err);
      } finally {
        setLoadingRooms(false);
      }
    };
    void loadRooms();
  }, []);

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

      // 即座に管理画面へ遷移
      router.push(`/admin/${data.roomId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!confirm('このルームを削除しますか？この操作は取り消せません。')) {
      return;
    }

    setDeletingRoomId(roomId);
    try {
      const response = await fetch(`/api/rooms/delete?roomId=${roomId}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('ルームの削除に失敗しました');
      }

      // Refresh room list
      setRooms(rooms.filter(r => r.id !== roomId));
      setSuccessMessage('ルームを削除しました');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setDeletingRoomId(null);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-blue-100 via-ecru to-brand-terra-100 p-8">
      <div className="w-full max-w-lg space-y-8">
        <div className="text-center slide-up">
          <div className="mb-6 text-7xl">🔐</div>
          <h1 className="text-4xl font-bold text-brand-blue-700">管理画面</h1>
          <p className="mt-3 text-base text-brand-blue-700/70">ルームコードを入力してください</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="glass-panel-strong rounded-2xl p-8 shadow-brand-lg bounce-in">
            <label className="mb-4 flex items-center justify-center gap-2 text-base font-bold text-brand-blue-700">
              <span className="text-xl">🎮</span>
              <span>ルームコード</span>
            </label>
            <input
              type="text"
              className="w-full rounded-xl border-2 border-brand-blue-200 bg-white px-6 py-5 text-center text-3xl font-bold uppercase tracking-wider text-slate-900 shadow-brand-sm transition-all duration-300 placeholder:text-slate-400 hover:border-brand-blue-300 focus:border-brand-blue-500 focus:shadow-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue-400"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="AB12"
              disabled={loading}
              maxLength={6}
            />
          </div>

          {error && (
            <div className="rounded-xl bg-error-light px-5 py-4 text-base font-semibold text-error shadow-brand-sm bounce-in">
              ⚠️ {error}
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl bg-success-light px-5 py-4 text-base font-semibold text-success shadow-brand-sm bounce-in">
              ✓ {successMessage}
            </div>
          )}

          <Button
            type="submit"
            className="w-full rounded-xl bg-gradient-secondary px-8 py-5 text-lg font-bold text-white shadow-brand-md transition-all duration-300 hover:scale-[1.02] hover:shadow-brand-lg active:scale-[0.98] disabled:opacity-60"
            disabled={loading || creating}
          >
            {loading ? '読み込み中...' : '→ 管理画面へ'}
          </Button>
        </form>

        <div className="space-y-5">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t-2 border-brand-blue-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-gradient-to-br from-brand-blue-100 via-ecru to-brand-terra-100 px-4 font-semibold text-brand-blue-700">または</span>
            </div>
          </div>

          <button
            onClick={handleCreateRoom}
            disabled={creating || loading}
            className="w-full rounded-xl border-2 border-brand-blue-300 bg-white/90 px-8 py-5 text-lg font-bold text-brand-blue-700 shadow-brand-sm transition-all duration-300 hover:scale-[1.02] hover:border-brand-blue-400 hover:bg-brand-blue-50 hover:shadow-brand active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {creating ? '作成中...' : '+ 新しいルームを作成'}
          </button>

          <p className="text-center text-sm text-brand-blue-700/60">
            新しいルームを作成すると、4桁のルームコードが自動生成されます
          </p>
        </div>

        {/* Room List */}
        <div className="glass-panel-strong rounded-2xl p-6 shadow-brand-lg">
          <h2 className="mb-4 text-xl font-bold text-brand-blue-700">既存のルーム</h2>
          {loadingRooms ? (
            <p className="text-center text-sm text-brand-blue-700/60">読み込み中...</p>
          ) : rooms.length === 0 ? (
            <p className="text-center text-sm text-brand-blue-700/60">ルームがありません</p>
          ) : (
            <div className="space-y-3">
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center justify-between rounded-xl border-2 border-brand-blue-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <button
                    onClick={() => router.push(`/admin/${room.id}`)}
                    className="flex-1 text-left"
                  >
                    <p className="text-xl font-bold text-brand-blue-700">{room.code}</p>
                    <p className="text-xs text-brand-blue-700/60">
                      作成日: {new Date(room.created_at).toLocaleString('ja-JP')}
                    </p>
                  </button>
                  <button
                    onClick={() => handleDeleteRoom(room.id)}
                    disabled={deletingRoomId === room.id}
                    className="ml-3 rounded-lg bg-red-100 p-2.5 text-red-600 transition-colors hover:bg-red-200 disabled:opacity-50"
                    aria-label="ルームを削除"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
