export const CATEGORY_NAMES = ['便當', '飯類', '麵食', '肉類', '海鮮', '早餐', '小吃', '自助餐'] as const;
export type CategoryName = (typeof CATEGORY_NAMES)[number];
/** UI 用的分類篩選值，'不限' 不入庫 */
export type CategoryFilter = '不限' | CategoryName;

export interface Category {
  id: string;
  name: CategoryName;
  parent_category_id: string | null;
}

export interface Restaurant {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  google_place_id: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  phone: string | null;
  is_test_data: boolean;
  created_at: string;
  updated_at: string;
}

export interface Food {
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  category_id: string;
  /** 店內現價，新台幣整數，搜尋唯一依據 */
  price: number;
  image_url: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface FoodTag {
  food_id: string;
  category_id: string;
}

export type VerificationStatus = 'store_confirmed' | 'menu_photo' | 'user_report' | 'pending';
export type SourceType = 'store' | 'menu_photo' | 'user_report';
export type ReportType = 'price_up' | 'price_down' | 'discontinued' | 'info_error';

export interface PriceVerification {
  id: string;
  food_id: string;
  reported_price: number | null;
  report_type: ReportType | null;
  note: string | null;
  source_type: SourceType;
  source_image_url: string | null;
  verification_status: VerificationStatus;
  verified_at: string;
  confidence_score: number;
  created_at: string;
}

export interface MenuImage {
  id: string;
  restaurant_id: string;
  image_url: string;
  uploaded_by: string | null;
  uploaded_at: string;
  ocr_status: 'pending' | 'ok' | 'not_configured' | 'error';
  source_date: string | null;
}

/** 整包資料集 (餐廳、餐點、分類、標籤、驗證紀錄、菜單照片) */
export interface Dataset {
  categories: Category[];
  restaurants: Restaurant[];
  foods: Food[];
  foodTags: FoodTag[];
  verifications: PriceVerification[];
  menuImages: MenuImage[];
}

export type SortKey = 'price' | 'distance' | 'rating';
export type ViewKey = 'home' | 'results' | 'map' | 'upload' | 'favorites';
export type Freshness = 'recent' | 'maybe' | 'old';

export interface LatLng {
  lat: number;
  lng: number;
}

/** 結果列：餐點 + 店 + 計算後欄位 */
export interface FoodView {
  food: Food;
  restaurant: Restaurant;
  categoryName: CategoryName;
  tagNames: CategoryName[];
  /** 最新一筆非 pending 的驗證，沒有則 null */
  verification: PriceVerification | null;
  freshness: Freshness | null;
  distanceM: number;
  rating: number | null;
}

export interface SearchParams {
  budget: number;
  cat: CategoryFilter;
  /** 半徑 (公尺) */
  dist: number;
  sort: SortKey;
  minRating: number;
  lat: number;
  lng: number;
}
