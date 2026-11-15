'use client';

import { useEffect, useState } from 'react';
import { QUICK_BUDGETS, parseBudgetInput } from '@/lib/search/params';

/** 預算：$50／$100／$150／$200 快捷鍵＋自訂 (輸入 1–2000)；選中＝ink 底 */
export function BudgetControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const isQuick = (QUICK_BUDGETS as readonly number[]).includes(value);
  const [customOpen, setCustomOpen] = useState(false);
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) setText(String(value));
  }, [value, error]);

  const showCustom = customOpen || !isQuick;

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="預算上限">
        {QUICK_BUDGETS.map((b) => (
          <button
            key={b}
            type="button"
            aria-pressed={value === b && !customOpen}
            onClick={() => {
              setError(null);
              setCustomOpen(false);
              onChange(b);
            }}
            className="opt opt-mono"
          >
            ${b}
          </button>
        ))}
        <button type="button" aria-pressed={showCustom} onClick={() => setCustomOpen((o) => !o)} className="opt opt-mono !font-sans !font-bold">
          自訂
        </button>
      </div>
      {showCustom && (
        <div className="mt-3">
          <label className="flex items-center gap-2 text-aux font-bold">
            輸入預算 (1–2000 元)
            <input
              type="text"
              inputMode="numeric"
              aria-label="自訂預算金額"
              aria-invalid={error ? true : undefined}
              value={text}
              onChange={(e) => {
                const t = e.target.value;
                setText(t);
                const r = parseBudgetInput(t);
                if (r.ok) {
                  setError(null);
                  onChange(r.value);
                } else {
                  setError(r.error);
                }
              }}
              className="field amount !w-28 text-[18px]"
            />
          </label>
          {error && (
            <p role="alert" className="mt-1 text-aux font-bold text-stamp">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
