import { AlertTriangle, Loader2 } from 'lucide-react';

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
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      data-testid={`state-${kind}`}
      className="flex flex-col items-center gap-3 rounded-card border border-line bg-white px-4 py-10 text-center text-mute"
    >
      {kind === 'loading' && <Loader2 className="animate-spin" aria-hidden />}
      {kind === 'error' && <AlertTriangle aria-hidden className="text-red-700" />}
      <p>{text}</p>
      {actionLabel && onAction && (
        <button type="button" onClick={onAction} aria-label={actionLabel} className="tap rounded-lg bg-forest px-4 font-medium text-white">
          {actionLabel}
        </button>
      )}
    </div>
  );
}
