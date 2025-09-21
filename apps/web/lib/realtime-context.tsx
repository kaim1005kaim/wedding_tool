'use client';

import { createContext, useContext } from 'react';
import type { RealtimeClient } from '@wedding_tool/rt-adapter';

const RealtimeClientContext = createContext<RealtimeClient | null>(null);

export function useRealtimeClient() {
  const ctx = useContext(RealtimeClientContext);
  if (!ctx) {
    throw new Error('Realtime client is not available. Did you wrap component with RoomRuntime?');
  }
  return ctx;
}

export function RealtimeProvider({ client, children }: { client: RealtimeClient; children: React.ReactNode }) {
  return <RealtimeClientContext.Provider value={client}>{children}</RealtimeClientContext.Provider>;
}
