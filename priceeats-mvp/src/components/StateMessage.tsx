export function StateMessage({
  kind,
  text,
  actionLabel,
  onAction,
}: {
  kind: 'loading' | 'error' | 'empty';
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="receipt" role={kind === 'error' ? 'alert' : 'status'} data-testid={`state-${kind}`}>
      <div className="receipt-head">
        <span className="text-store">{kind === 'loading' ? '請稍候' : kind === 'error' ? '出了點問題' : '查無資料'}</span>
        {kind === 'error' && <span className="stamp">錯誤</span>}
      </div>
      <p className="mt-3 text-aux">{text}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} className="btn-ink mt-4 px-6">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
