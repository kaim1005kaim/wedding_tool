'use client';

import { useEffect, useState } from 'react';
import { createRoomRealtimeClient } from '../lib/realtime-client';
import { useRoomStore } from '../lib/store/room-store';
import { RealtimeProvider } from '../lib/realtime-context';
import type { RealtimeClient } from '@wedding_tool/rt-adapter';

export default function RoomRuntime({ roomId, children }: { roomId: string; children: React.ReactNode }) {
  const [client, setClient] = useState<RealtimeClient | null>(null);

  useEffect(() => {
    let isMounted = true;
    let cleanup: (() => void) | undefined;

    (async () => {
      const realtimeClient = await createRoomRealtimeClient(roomId);
      await realtimeClient.join(roomId);
      if (!isMounted) {
        await realtimeClient.close();
        return;
      }

      useRoomStore.getState().setRoomId(roomId);

      const offState = realtimeClient.on('state:update', (payload) => {
        useRoomStore.getState().hydrateFromState(payload);
      });

      const offQuizShow = realtimeClient.on('quiz:show', (payload) => {
        useRoomStore.getState().setActiveQuiz(payload);
      });

      const offQuizResult = realtimeClient.on('quiz:result', (payload) => {
        useRoomStore.getState().setQuizResult(payload);
      });

      const offLottery = realtimeClient.on('lottery:result', (payload) => {
        useRoomStore.getState().setLotteryResult(payload);
      });

      cleanup = () => {
        offState();
        offQuizShow();
        offQuizResult();
        offLottery();
        realtimeClient.close();
      };

      setClient(realtimeClient);
    })();

    return () => {
      isMounted = false;
      cleanup?.();
    };
  }, [roomId]);

  if (!client) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-300">
        <span>接続中…</span>
      </main>
    );
  }

  return <RealtimeProvider client={client}>{children}</RealtimeProvider>;
}
