'use client';

import type { AdminEvent, ClientEvent, RealtimeClient } from '@wedding_tool/rt-adapter';
import { createRealtimeClient } from '@wedding_tool/rt-adapter';
import { appConfig } from './env';

async function dispatchEvent(roomId: string, event: ClientEvent | AdminEvent) {
  const response = await fetch(`/api/rooms/${roomId}/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(event)
  });

  if (!response.ok) {
    throw new Error(`Failed to dispatch event: ${response.statusText}`);
  }
}

export async function createRoomRealtimeClient(roomId: string): Promise<RealtimeClient> {
  if (appConfig.mode === 'cloud') {
    if (!appConfig.supabase.url || !appConfig.supabase.anonKey) {
      throw new Error('Supabase configuration is missing.');
    }

    return createRealtimeClient({
      mode: 'cloud',
      supabaseUrl: appConfig.supabase.url,
      supabaseKey: appConfig.supabase.anonKey,
      dispatch: (event) => dispatchEvent(roomId, event)
    });
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const socketUrl = appConfig.lan.socketUrl || origin.replace('3000', '5050');

  return createRealtimeClient({
    mode: 'lan',
    socketUrl
  });
}
