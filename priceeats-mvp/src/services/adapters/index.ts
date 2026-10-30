export interface PlaceSummary {
  place_id: string;
  name: string;
  rating: number | null;
  user_ratings_total: number | null;
}

export type PlacesResponse<T> = { status: 'not_configured' } | { status: 'ok'; data: T } | { status: 'error'; message?: string };

/**
 * Google Places 轉接介面 (第二階段實作)。
 * 注意 Google Maps Platform 條款：不爬蟲、不永久儲存 Places 照片、需標示歸屬；API Key 只走伺服器端。
 */
export interface GooglePlacesAdapter {
  findPlace(query: string, near: { lat: number; lng: number }): Promise<PlacesResponse<PlaceSummary | null>>;
}

export class GooglePlacesStub implements GooglePlacesAdapter {
  async findPlace(): Promise<PlacesResponse<PlaceSummary | null>> {
    return { status: 'not_configured' };
  }
}
