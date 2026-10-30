import { buildSeed, seedToDataset } from '@/data/seed';
import type { Dataset, PriceVerification } from '@/types';
import type { ReportInput } from '@/lib/pricing/report';
import { loadLocalReports, saveLocalReport, saveLocalSubmission, toPendingVerification } from './local';
import type { MenuSubmissionInput, Repository, StoredMenuSubmission } from './types';

/** 預設實作：資料來自 src/data/seed；回報與上傳草稿存 localStorage */
export class MockRepository implements Repository {
  readonly kind = 'mock' as const;

  async load(today: Date): Promise<Dataset> {
    const data = seedToDataset(buildSeed(), today);
    // E2E 測試縫隙：測試腳本可用 addInitScript 指定圖片網址，驗證「圖片失效時顯示 fallback」(正式使用不會設定)
    const testImage = typeof window !== 'undefined' ? (window as unknown as { __PRICEEATS_TEST_IMAGE_URL?: unknown }).__PRICEEATS_TEST_IMAGE_URL : undefined;
    const foods = typeof testImage === 'string' ? data.foods.map((f) => ({ ...f, image_url: testImage })) : data.foods;
    return { ...data, foods, verifications: [...data.verifications, ...loadLocalReports()] };
  }

  async submitReport(input: ReportInput, today: Date): Promise<PriceVerification> {
    const v = toPendingVerification(input, today);
    saveLocalReport(v);
    return v;
  }

  async submitMenu(
    input: MenuSubmissionInput,
    ocrStatus: StoredMenuSubmission['ocr_status'],
    today: Date,
  ): Promise<StoredMenuSubmission> {
    return saveLocalSubmission(input, ocrStatus, today);
  }
}
