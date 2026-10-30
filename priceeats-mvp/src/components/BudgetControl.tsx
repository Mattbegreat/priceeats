'use client';

import { useEffect, useState } from 'react';
import { QUICK_BUDGETS, SLIDER_MAX, SLIDER_MIN, SLIDER_STEP, parseBudgetInput } from '@/lib/search/params';

const chipBase = 'tap rounded-lg border px-3 text-sm font-medium transition';
const chipOn = 'border-forest bg-lime text-forest';
const chipOff = 'border-line bg-white text-ink hover:border-forest';

export function BudgetControl({
  value,
  onChange,
  compact = false,
}: {
  value: number;
  onChange: (v: number) => void;
  compact?: boolean;
}) {
  const isQuick = (QUICK_BUDGETS as readonly number[]).includes(value);
  const [customOpen, setCustomOpen] = useState(false);
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!error) setText(String(value));
  }, [value, error]);

  const showCustom = customOpen || (!isQuick && (value < SLIDER_MIN || value > SLIDER_MAX));

  const numberInput = (
    <>
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
        className="tap w-24 rounded-lg border border-line bg-white px-3 text-base tabular-nums"
      />
      <span className="text-sm text-mute">元</span>
    </>
  );

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-mute">預算上限</span>
        {compact && <label className="ml-auto flex items-center gap-1.5 text-xs text-mute">自訂 {numberInput}</label>}
        <output
          className={`${compact ? 'text-2xl' : 'text-3xl'} font-bold text-forest tabular-nums`}
          aria-live="polite"
          data-testid="budget-value"
        >
          ${value}
        </output>
      </div>
      <input
        type="range"
        aria-label="預算滑桿"
        min={SLIDER_MIN}
        max={SLIDER_MAX}
        step={SLIDER_STEP}
        value={Math.min(SLIDER_MAX, Math.max(SLIDER_MIN, value))}
        onChange={(e) => {
          setError(null);
          setCustomOpen(false);
          onChange(Number(e.target.value));
        }}
        className="mt-2 h-11 w-full"
      />
      {!compact && (
        <div className="mt-1 flex flex-wrap gap-2" role="group" aria-label="快速預算">
          {QUICK_BUDGETS.map((b) => (
            <button
              key={b}
              type="button"
              aria-label={`預算 ${b} 元`}
              aria-pressed={value === b && !customOpen}
              onClick={() => {
                setError(null);
                setCustomOpen(false);
                onChange(b);
              }}
              className={`${chipBase} ${value === b && !customOpen ? chipOn : chipOff}`}
            >
              ${b}
            </button>
          ))}
          <button
            type="button"
            aria-label="自訂預算"
            aria-pressed={showCustom}
            onClick={() => setCustomOpen((o) => !o)}
            className={`${chipBase} ${showCustom ? chipOn : chipOff}`}
          >
            自訂
          </button>
        </div>
      )}
      {(compact || showCustom) && error && (
        <p role="alert" className="mt-1 text-sm text-red-700">
          {error}
        </p>
      )}
      {!compact && showCustom && (
        <label className="mt-2 flex items-center gap-2 text-sm text-mute">
          輸入預算 (1–2000 元) {numberInput}
        </label>
      )}
    </div>
  );
}
