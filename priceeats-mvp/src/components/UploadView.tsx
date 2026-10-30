'use client';

import dynamic from 'next/dynamic';
import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_CENTER } from '@/data/centers';
import { KEYS, readJson, removeKey, writeJson } from '@/lib/storage/safe';
import { menuSubmissionSchema, type Repository } from '@/repositories/types';
import { MenuOCRService } from '@/services/ocr';
import { CATEGORY_NAMES, type CategoryName, type Dataset, type LatLng } from '@/types';

const MapPicker = dynamic(() => import('./MapPicker').then((m) => m.MapPicker), {
  ssr: false,
  loading: () => <p className="text-sm text-mute">地圖載入中…</p>,
});

const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'] as const;
const MAX_BYTES = 8 * 1024 * 1024;

interface Row {
  name: string;
  price: string;
  category: CategoryName;
}
interface Draft {
  name: string;
  mode: 'existing' | 'new';
  restaurantId: string;
  pos: LatLng | null;
  rows: Row[];
}

const emptyRow = (): Row => ({ name: '', price: '', category: '便當' });
const input = 'tap w-full rounded-lg border border-line bg-white px-3 text-base';

export function UploadView({
  repo,
  data,
  today,
  presetRestaurantId,
}: {
  repo: Repository;
  data: Dataset;
  today: Date;
  presetRestaurantId: string | null;
}) {
  const ocr = useMemo(() => new MenuOCRService(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [ocrMsg, setOcrMsg] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'existing' | 'new'>('existing');
  const [restaurantId, setRestaurantId] = useState('');
  const [pos, setPos] = useState<LatLng | null>(null);
  const [rows, setRows] = useState<Row[]>([emptyRow()]);
  const [errors, setErrors] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<'not_configured' | 'ok' | 'error'>('not_configured');
  const restored = useRef(false);

  const restaurants = useMemo(() => [...data.restaurants].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant')), [data.restaurants]);

  // 還原草稿 (只存文字欄位，不存照片)
  useEffect(() => {
    const d = readJson<Draft | null>(KEYS.draft, null);
    if (d) {
      setName(d.name);
      setMode(d.mode);
      setRestaurantId(d.restaurantId);
      setPos(d.pos);
      if (d.rows?.length) setRows(d.rows);
    }
    if (presetRestaurantId) {
      const r = data.restaurants.find((x) => x.id === presetRestaurantId);
      if (r) {
        setMode('existing');
        setRestaurantId(r.id);
        setName(r.name);
      }
    }
    restored.current = true;
  }, [presetRestaurantId, data.restaurants]);

  useEffect(() => {
    if (!restored.current) return;
    writeJson(KEYS.draft, { name, mode, restaurantId, pos, rows } satisfies Draft);
  }, [name, mode, restaurantId, pos, rows]);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setDone(false);
    setOcrMsg(null);
    setFileError(null);
    if (!f) return;
    if (!(ALLOWED as readonly string[]).includes(f.type)) {
      setFileError('只接受 JPEG、PNG、WebP 圖片');
      setFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (f.size > MAX_BYTES) {
      setFileError('圖片超過 8MB，請壓縮後再上傳');
      setFile(null);
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
    const r = await ocr.recognize(f);
    if (r.status === 'ok') {
      setOcrStatus('ok');
      setOcrMsg('已辨識出以下內容，請逐項確認或修改後再送出 (辨識結果不會直接成為正式價格)。');
      if (r.result.restaurant_name && !name) setName(r.result.restaurant_name);
      if (r.result.items.length)
        setRows(r.result.items.map((it) => ({ name: it.name, price: String(it.price), category: it.category })));
    } else if (r.status === 'error') {
      setOcrStatus('error');
      setOcrMsg('自動辨識發生錯誤，請改用人工輸入。');
    } else {
      setOcrStatus('not_configured');
      setOcrMsg('尚未設定自動辨識，請參照照片手動輸入餐點與價格。');
    }
  }

  function setRow(i: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setDone(false);
    const errs: string[] = [];
    if (!file) errs.push('請先選擇菜單照片');
    let loc: LatLng | null = null;
    let rid: string | null = null;
    if (mode === 'existing') {
      const r = data.restaurants.find((x) => x.id === restaurantId);
      if (!r) errs.push('請選擇店家，或改用地圖點選新位置');
      else {
        rid = r.id;
        loc = { lat: r.latitude, lng: r.longitude };
      }
    } else {
      if (!pos) errs.push('請在地圖上點選新店位置');
      loc = pos;
    }
    const items = rows
      .filter((r) => r.name.trim() || r.price.trim())
      .map((r) => ({ name: r.name, price: r.price.trim() === '' ? NaN : Number(r.price), category: r.category }));
    if (errs.length === 0 && file && loc) {
      const parsed = menuSubmissionSchema.safeParse({
        restaurant_name: name,
        restaurant_id: rid,
        location: loc,
        image: { name: file.name, type: file.type, size: file.size },
        items,
      });
      if (!parsed.success) {
        for (const iss of parsed.error.issues) {
          const where = iss.path[0] === 'items' && typeof iss.path[1] === 'number' ? `第 ${iss.path[1] + 1} 列：` : '';
          errs.push(`${where}${iss.message}`);
        }
      } else {
        await repo.submitMenu(parsed.data, ocrStatus, today);
        removeKey(KEYS.draft);
        setDone(true);
        setErrors([]);
        setFile(null);
        setPreview(null);
        setOcrMsg(null);
        setRows([emptyRow()]);
        setName('');
        if (fileRef.current) fileRef.current.value = '';
        return;
      }
    } else if (!name.trim()) {
      errs.push('請輸入店名');
    }
    if (!name.trim() && !errs.includes('請輸入店名')) errs.push('請輸入店名');
    setErrors([...new Set(errs)]);
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-5" noValidate>
      <div>
        <h1 className="text-xl font-bold text-forest">上傳菜單</h1>
        <p className="mt-1 text-sm text-mute">上傳的資料會先標示為「待確認」，不會直接改變店內價格。</p>
      </div>

      <section className="space-y-2 rounded-card border border-line bg-white p-4" aria-label="菜單照片">
        <label className="block text-sm font-semibold" htmlFor="menu-file">
          菜單照片 (JPEG／PNG／WebP，8MB 以內)
        </label>
        {/* 原生 input 只做視覺隱藏 (sr-only)，由中文按鈕觸發；aria-label 與 E2E 的選取方式不變 */}
        <input
          id="menu-file"
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          aria-label="選擇菜單照片"
          tabIndex={-1}
          onChange={onFile}
          className="sr-only"
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="pick-photo"
            onClick={() => fileRef.current?.click()}
            className="tap rounded-lg border border-forest px-4 text-sm font-semibold text-forest"
          >
            選擇照片
          </button>
          <span className="min-w-0 truncate text-sm text-mute" data-testid="picked-name">
            {file ? file.name : '尚未選擇照片'}
          </span>
        </div>
        {fileError && (
          <p role="alert" className="text-sm text-red-700" data-testid="file-error">
            {fileError}
          </p>
        )}
        {preview && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="菜單預覽" className="max-h-64 w-full rounded-lg border border-line object-contain" data-testid="menu-preview" />
        )}
        {ocrMsg && (
          <p role="status" className="rounded-lg bg-canvas px-3 py-2 text-sm text-mute" data-testid="ocr-msg">
            {ocrMsg}
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-card border border-line bg-white p-4" aria-label="店家與位置">
        <label className="block text-sm font-semibold">
          店名 (必填)
          <input aria-label="店名" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className={`${input} mt-1 font-normal`} />
        </label>
        <div role="group" aria-label="位置來源" className="flex gap-2">
          {(['existing', 'new'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              aria-label={m === 'existing' ? '選擇現有店家' : '地圖點選新位置'}
              onClick={() => setMode(m)}
              className={`tap rounded-lg border px-3 text-sm font-medium ${mode === m ? 'border-forest bg-lime text-forest' : 'border-line bg-white'}`}
            >
              {m === 'existing' ? '選現有店家' : '地圖點選新位置'}
            </button>
          ))}
        </div>
        {mode === 'existing' ? (
          <select
            aria-label="現有店家"
            value={restaurantId}
            onChange={(e) => {
              setRestaurantId(e.target.value);
              const r = data.restaurants.find((x) => x.id === e.target.value);
              if (r && !name.trim()) setName(r.name);
            }}
            className={input}
          >
            <option value="">請選擇店家</option>
            {restaurants.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        ) : (
          <div className="space-y-1">
            <MapPicker center={DEFAULT_CENTER} value={pos} onPick={setPos} />
            <p className="text-xs text-mute">{pos ? `已選位置：${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}` : '點一下地圖設定新店位置'}</p>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-card border border-line bg-white p-4" aria-label="餐點與價格">
        <h2 className="text-sm font-semibold">人工輸入餐點與價格 (店內價格)</h2>
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="space-y-2 rounded-lg border border-line p-2" data-testid="menu-row">
              <input aria-label={`餐點名稱 ${i + 1}`} placeholder="餐點名稱" value={r.name} onChange={(e) => setRow(i, { name: e.target.value })} className={input} />
              <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <input aria-label={`價格 ${i + 1}`} placeholder="價格 (元)" inputMode="numeric" value={r.price} onChange={(e) => setRow(i, { price: e.target.value })} className={`${input} tabular-nums`} />
                <select aria-label={`分類 ${i + 1}`} value={r.category} onChange={(e) => setRow(i, { category: e.target.value as CategoryName })} className={input}>
                  {CATEGORY_NAMES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  aria-label={`刪除第 ${i + 1} 列`}
                  disabled={rows.length === 1}
                  onClick={() => setRows((rs) => rs.filter((_, k) => k !== i))}
                  className="tap flex items-center justify-center rounded-lg border border-line disabled:opacity-40"
                >
                  <Trash2 size={16} aria-hidden />
                </button>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          aria-label="新增一列"
          onClick={() => setRows((rs) => [...rs, emptyRow()])}
          className="tap inline-flex items-center gap-1.5 rounded-lg border border-forest px-3 text-sm font-semibold text-forest"
        >
          <Plus size={16} aria-hidden /> 新增一列
        </button>
      </section>

      {errors.length > 0 && (
        <ul role="alert" className="list-disc rounded-lg bg-red-50 py-2 pl-8 pr-3 text-sm text-red-800" data-testid="upload-errors">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      {done && (
        <p role="status" className="rounded-lg bg-lime px-3 py-2 font-medium text-forest" data-testid="upload-done">
          已收到，待確認。人工確認後才會成為價格資料。
        </p>
      )}
      <button type="submit" aria-label="送出菜單" className="tap h-12 w-full rounded-card bg-forest text-base font-bold text-white">
        送出待確認
      </button>
    </form>
  );
}
