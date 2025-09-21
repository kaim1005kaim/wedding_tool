import type { RealtimeMode } from '@wedding_tool/rt-adapter';

const mode = (process.env.NEXT_PUBLIC_MODE ?? 'cloud') as RealtimeMode;

export const appConfig = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'wedding_tool',
  mode,
  roomCodeLength: Number.parseInt(process.env.NEXT_PUBLIC_ROOM_CODE_LENGTH ?? '4', 10),
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  },
  lan: {
    socketUrl: process.env.NEXT_PUBLIC_LAN_SOCKET_URL ?? ''
  }
};

export const isCloudMode = mode === 'cloud';
export const isLanMode = mode === 'lan';
