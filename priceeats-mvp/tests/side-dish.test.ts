import { describe, expect, it } from 'vitest';
import { isSideDish } from '@/lib/search/side-dish';
import type { FoodBase } from '@/lib/search/filter';

const mk = (name: string, price: number, categoryName = '麵食'): FoodBase =>
  ({ food: { name, price }, categoryName }) as unknown as FoodBase;

describe('單點小菜判斷', () => {
  it('配料、湯、小菜、肉類單點算配菜', () => {
    for (const [n, p, c] of [
      ['滷蛋', 15, '小吃'],
      ['白飯', 15, '飯類'],
      ['貢丸湯', 45, '小吃'],
      ['豬耳朵', 45, '小吃'],
      ['炸排骨', 65, '肉類'],
      ['燙青菜', 40, '小吃'],
    ] as const) {
      expect(isSideDish(mk(n, p, c)), n).toBe(true);
    }
  });
  it('麵、飯、便當算主餐', () => {
    for (const [n, p, c] of [
      ['乾拌麵（小）', 40, '麵食'],
      ['餛飩麵', 75, '麵食'],
      ['魯肉飯', 40, '飯類'],
      ['鮮嫩炸雞腿飯', 120, '便當'],
      ['肉羹麵（小）', 65, '麵食'],
    ] as const) {
      expect(isSideDish(mk(n, p, c)), n).toBe(false);
    }
  });
});
