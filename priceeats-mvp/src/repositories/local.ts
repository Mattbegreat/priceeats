import { KEYS, readJson, writeJson } from '@/lib/storage/safe';
import type { PriceVerification } from '@/types';
import type { ReportInput } from '@/lib/pricing/report';
import type { MenuSubmissionInput, StoredMenuSubmission } from './types';

export function newId(): string {
  try {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  } catch {
    /* 忽略 */
  }
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export function toPendingVerification(input: ReportInput, today: Date): PriceVerification {
  const iso = today.toISOString();
  return {
    id: newId(),
    food_id: input.food_id,
    reported_price: input.reported_price,
    report_type: input.report_type,
    note: input.note && input.note.trim() ? input.note.trim() : null,
    source_type: 'user_report',
    source_image_url: null,
    verification_status: 'pending',
    verified_at: iso,
    confidence_score: 0.5,
    created_at: iso,
  };
}

export function loadLocalReports(): PriceVerification[] {
  return readJson<PriceVerification[]>(KEYS.reports, []);
}

export function saveLocalReport(v: PriceVerification): boolean {
  return writeJson(KEYS.reports, [...loadLocalReports(), v]);
}

export function loadLocalSubmissions(): StoredMenuSubmission[] {
  return readJson<StoredMenuSubmission[]>(KEYS.submissions, []);
}

export function saveLocalSubmission(
  input: MenuSubmissionInput,
  ocrStatus: StoredMenuSubmission['ocr_status'],
  today: Date,
): StoredMenuSubmission {
  const rec: StoredMenuSubmission = {
    ...input,
    id: newId(),
    status: 'pending',
    ocr_status: ocrStatus,
    created_at: today.toISOString(),
  };
  writeJson(KEYS.submissions, [...loadLocalSubmissions(), rec]);
  return rec;
}
