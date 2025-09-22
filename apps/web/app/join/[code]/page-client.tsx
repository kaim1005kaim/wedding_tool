'use client';

import { useEffect, useState } from 'react';
import RoomRuntime from '../../../components/room-runtime';
import JoinRoom from '../../../components/join-room';

export default function JoinPageClient({ code }: { code: string }) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRoomId() {
      try {
        const response = await fetch(`/api/rooms/lookup?code=${encodeURIComponent(code)}`);
        if (!response.ok) {
          throw new Error('Room not found');
        }
        const data = await response.json() as { roomId: string };
        setRoomId(data.roomId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load room');
      } finally {
        setLoading(false);
      }
    }

    fetchRoomId();
  }, [code]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p>Loading...</p>
      </main>
    );
  }

  if (error || !roomId) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <h1 className="text-2xl">ルームが見つかりません</h1>
        <p className="text-slate-400">ルームコード: {code.toUpperCase()}</p>
      </main>
    );
  }

  return (
    <RoomRuntime roomId={roomId}>
      <JoinRoom code={code} />
    </RoomRuntime>
  );
}