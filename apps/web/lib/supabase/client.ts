'use client';

import { createBrowserClient } from '@supabase/ssr';
import { appConfig } from '../env';

export function getSupabaseBrowserClient() {
  if (!appConfig.supabase.url || !appConfig.supabase.anonKey) {
    throw new Error('Supabase client requires URL and anon key.');
  }

  return createBrowserClient(appConfig.supabase.url, appConfig.supabase.anonKey);
}
