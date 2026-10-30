import { z } from 'zod';

export const REPORT_TYPES = ['price_up', 'price_down', 'discontinued', 'info_error'] as const;

export const REPORT_LABEL: Record<(typeof REPORT_TYPES)[number], string> = {
  price_up: '價格已調漲',
  price_down: '價格已調降',
  discontinued: '餐點停售',
  info_error: '菜單資訊錯誤',
};

export const reportInputSchema = z.object({
  food_id: z.string().min(1),
  report_type: z.enum(REPORT_TYPES),
  reported_price: z.number().int({ error: '價格需為整數' }).min(1, { error: '價格最少 1 元' }).max(5000, { error: '價格最多 5000 元' }).nullable(),
  note: z.string().max(200, { error: '說明最多 200 字' }).nullable(),
});

export type ReportInput = z.infer<typeof reportInputSchema>;

/** 回報驗證：調漲需高於現價、調降需低於現價、資訊錯誤需說明 */
export function validateReport(input: ReportInput, currentPrice: number): string | null {
  const r = reportInputSchema.safeParse(input);
  if (!r.success) return r.error.issues[0]?.message ?? '回報內容有誤';
  if (input.report_type === 'price_up' || input.report_type === 'price_down') {
    if (input.reported_price === null) return '請輸入新價格';
    if (input.report_type === 'price_up' && input.reported_price <= currentPrice) return '調漲的新價格需高於目前價格';
    if (input.report_type === 'price_down' && input.reported_price >= currentPrice) return '調降的新價格需低於目前價格';
  }
  if (input.report_type === 'info_error' && !(input.note ?? '').trim()) return '請說明哪裡有誤';
  return null;
}
