import { useId, useRef, useState } from 'react';
import { ComposerPopover, POPOVER_SURFACE } from '../../components/ComposerPopover.jsx';
import { formatCompactCount } from '../../shared/format-number.js';

export function ComposerContextUsage({ tokens, copy }) {
  const triggerRef = useRef(null);
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const limit = Number(tokens?.max);
  if (!Number.isFinite(limit) || limit <= 0) return null;
  const used = Number.isFinite(Number(tokens?.input)) ? Math.max(0, Number(tokens.input)) : 0;
  const ratio = Math.min(1, used / limit);
  const percent = Math.round(ratio * 1000) / 10;
  const label = copy(percent, formatCompactCount(used), formatCompactCount(limit));
  const tone = ratio >= 0.9 ? 'text-red-500' : ratio >= 0.75 ? 'text-amber-500' : 'text-gray-400 dark:text-gray-500';
  return <div className="relative shrink-0">
    <button ref={triggerRef} type="button" data-testid="composer-context-usage"
      aria-label={label} aria-describedby={open ? tooltipId : undefined}
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
      onClick={() => setOpen(true)}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); setOpen(false); } }}
      className={`flex h-8 w-8 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/5 ${tone}`}>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="-rotate-90">
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2.5" opacity=".22" />
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"
          opacity={ratio > 0 ? 1 : 0}
          strokeDasharray={`${ratio * 50.2655} 50.2655`} />
      </svg>
    </button>
    <ComposerPopover open={open} onClose={() => setOpen(false)} triggerRef={triggerRef} portal menuWidth={290}
      occludeRightDock={false}
      desktopClassName={`absolute bottom-full right-0 ${POPOVER_SURFACE}`}
      menuProps={{ id: tooltipId, role: 'tooltip', 'data-testid': 'composer-context-tooltip' }}>
      <div className="px-2 py-1 text-[12px] leading-5 text-gray-700 dark:text-gray-200">{label}</div>
    </ComposerPopover>
  </div>;
}
