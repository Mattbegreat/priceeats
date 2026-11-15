import type { FoodBase } from './filter';

/** 多人份：名稱含「人份」「套餐（2 人以上）」「全家」「桶」，或價格 >= 500 */
export const MULTI_PRICE_MIN = 500;
const MULTI_NAME = /(人份|全家|桶(?!仔)|[2-9２-９二兩三四五六]\s*人(?:以上|套餐|餐|分))/;

export function isMultiServing(b: FoodBase): boolean {
  return b.food.price >= MULTI_PRICE_MIN || MULTI_NAME.test(b.food.name);
}
