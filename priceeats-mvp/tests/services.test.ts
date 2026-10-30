import { describe, expect, it } from 'vitest';
import { createRepository } from '@/repositories';
import { MockRepository } from '@/repositories/mock';
import { SupabaseRepository } from '@/repositories/supabase';
import { GooglePlacesStub, type GooglePlacesAdapter } from '@/services/adapters';
import { MenuOCRService } from '@/services/ocr';

describe('服務與資料層選擇', () => {
  it('14. 沒有任何環境變數 → MockRepository', async () => {
    const repo = createRepository({});
    expect(repo).toBeInstanceOf(MockRepository);
    const data = await repo.load(new Date('2026-10-30T00:00:00Z'));
    expect(data.restaurants.length).toBeGreaterThanOrEqual(30);
  });
  it('只設一個變數仍用 Mock；兩個都設 → SupabaseRepository', () => {
    expect(createRepository({ url: 'https://x.supabase.co' })).toBeInstanceOf(MockRepository);
    expect(createRepository({ url: 'https://x.supabase.co', anonKey: 'anon' })).toBeInstanceOf(SupabaseRepository);
  });
  it('SupabaseRepository 以 anon key 讀取，回報強制 pending', async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const fake = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return new Response(init?.method === 'POST' ? null : '[]', { status: init?.method === 'POST' ? 201 : 200 });
    }) as unknown as typeof fetch;
    const repo = new SupabaseRepository('https://x.supabase.co', 'anon-key', fake);
    await repo.load();
    expect(calls.some((c) => c.url.includes('/rest/v1/foods?'))).toBe(true);
    const h = calls[0]!.init?.headers as Record<string, string>;
    expect(h.apikey).toBe('anon-key');
    await repo.submitReport({ food_id: 'f1', report_type: 'price_up', reported_price: 120, note: null }, new Date());
    const post = calls.find((c) => c.init?.method === 'POST')!;
    const body = JSON.parse(post.init!.body as string);
    expect(body.verification_status).toBe('pending');
    expect(body.source_type).toBe('user_report');
  });
  it('MenuOCRService 預設回 not_configured，不假裝辨識成功', async () => {
    const r = await new MenuOCRService().recognize(new Blob(['x']));
    expect(r).toEqual({ status: 'not_configured' });
  });
  it('provider 丟出例外 → status error', async () => {
    const svc = new MenuOCRService({ recognize: async () => { throw new Error('boom'); } });
    const r = await svc.recognize(new Blob(['x']));
    expect(r.status).toBe('error');
  });
  it('GooglePlacesAdapter stub 回 not_configured', async () => {
    const adapter: GooglePlacesAdapter = new GooglePlacesStub();
    expect(await adapter.findPlace('x', { lat: 0, lng: 0 })).toEqual({ status: 'not_configured' });
  });
});
