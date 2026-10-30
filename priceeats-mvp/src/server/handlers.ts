import { reportInputSchema } from '@/lib/pricing/report';
import type { Repository } from '@/repositories/types';
import { menuSubmissionSchema } from '@/repositories/types';

export interface HandlerResult {
  status: number;
  body: Record<string, unknown>;
}

/** 薄包裝用的伺服器邏輯：route handler 只負責轉呼叫，demo 建置時 app/api 會被排除 */
export async function handleReport(body: unknown, repo: Repository, today = new Date()): Promise<HandlerResult> {
  if (repo.kind === 'mock') return { status: 501, body: { error: 'not_configured', message: '未設定 Supabase，回報僅存於瀏覽器 localStorage' } };
  const parsed = reportInputSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { error: 'invalid', message: parsed.error.issues[0]?.message ?? '格式錯誤' } };
  // 伺服器端只驗證格式；與現價的比對由 UI 負責 (見 lib/pricing/report.ts validateReport)
  const v = await repo.submitReport(parsed.data, today);
  return { status: 202, body: { id: v.id, verification_status: v.verification_status } };
}

export async function handleMenuSubmission(body: unknown, repo: Repository, today = new Date()): Promise<HandlerResult> {
  if (repo.kind === 'mock') return { status: 501, body: { error: 'not_configured', message: '未設定 Supabase，菜單投稿僅存於瀏覽器 localStorage' } };
  const parsed = menuSubmissionSchema.safeParse(body);
  if (!parsed.success) return { status: 400, body: { error: 'invalid', message: parsed.error.issues[0]?.message ?? '格式錯誤' } };
  const rec = await repo.submitMenu(parsed.data, 'not_configured', today);
  return { status: 202, body: { id: rec.id, status: rec.status } };
}
