import { z } from 'zod';
import { CATEGORY_NAMES, type Dataset, type PriceVerification } from '@/types';
import type { ReportInput } from '@/lib/pricing/report';

export const menuItemSchema = z.object({
  name: z.string().trim().min(1, { error: '請輸入餐點名稱' }).max(40),
  price: z.number({ error: '請輸入價格' }).int({ error: '價格需為整數' }).min(1, { error: '價格最少 1 元' }).max(5000, { error: '價格最多 5000 元' }),
  category: z.enum(CATEGORY_NAMES),
});

export const menuSubmissionSchema = z.object({
  restaurant_name: z.string().trim().min(1, { error: '請輸入店名' }).max(60),
  restaurant_id: z.string().nullable(),
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  image: z.object({ name: z.string(), type: z.enum(['image/jpeg', 'image/png', 'image/webp']), size: z.number().max(8 * 1024 * 1024) }),
  items: z.array(menuItemSchema).min(1, { error: '至少填一道餐點' }).max(50),
});

export type MenuSubmissionInput = z.infer<typeof menuSubmissionSchema>;

export interface StoredMenuSubmission extends MenuSubmissionInput {
  id: string;
  status: 'pending';
  ocr_status: 'not_configured' | 'ok' | 'error';
  created_at: string;
}

export interface Repository {
  readonly kind: 'mock' | 'supabase';
  /** today 注入：模擬資料的更新日期以此為基準 */
  load(today: Date): Promise<Dataset>;
  /** 寫入一筆 status=pending 的 verification，不改 foods.price */
  submitReport(input: ReportInput, today: Date): Promise<PriceVerification>;
  /** 菜單上傳：一律 pending，人工確認前不成為正式價格 */
  submitMenu(input: MenuSubmissionInput, ocrStatus: StoredMenuSubmission['ocr_status'], today: Date): Promise<StoredMenuSubmission>;
}
