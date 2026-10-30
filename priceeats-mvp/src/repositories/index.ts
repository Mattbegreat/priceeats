import { MockRepository } from './mock';
import { SupabaseRepository } from './supabase';
import type { Repository } from './types';

export type { Repository } from './types';

/** 沒有任何環境變數 → Mock；兩個 Supabase 變數都有 → Supabase */
export function createRepository(env: { url?: string; anonKey?: string } = readEnv()): Repository {
  if (env.url && env.anonKey) return new SupabaseRepository(env.url, env.anonKey);
  return new MockRepository();
}

function readEnv() {
  // 必須以完整字面量存取，Next.js 才會在建置時內嵌
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  };
}
