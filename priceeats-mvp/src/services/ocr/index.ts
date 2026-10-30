import type { CategoryName } from '@/types';

export interface OcrItem {
  name: string;
  price: number;
  category: CategoryName;
  confidence: number;
}

export interface OcrResult {
  restaurant_name: string;
  items: OcrItem[];
}

export type OcrResponse =
  | { status: 'not_configured' }
  | { status: 'ok'; result: OcrResult }
  | { status: 'error'; message?: string };

export interface OcrProvider {
  recognize(image: File | Blob): Promise<OcrResponse>;
}

/** 預設 provider：尚未設定，永遠回 not_configured (不假裝辨識) */
export class NotConfiguredProvider implements OcrProvider {
  async recognize(): Promise<OcrResponse> {
    return { status: 'not_configured' };
  }
}

/**
 * 第二階段可換成呼叫伺服器端 route (例如 Gemini 免費額度)；
 * 金鑰只放伺服器端環境變數，本階段不實作任何呼叫。
 */
export class MenuOCRService {
  constructor(private readonly provider: OcrProvider = new NotConfiguredProvider()) {}

  async recognize(image: File | Blob): Promise<OcrResponse> {
    try {
      return await this.provider.recognize(image);
    } catch (e) {
      return { status: 'error', message: e instanceof Error ? e.message : String(e) };
    }
  }
}
