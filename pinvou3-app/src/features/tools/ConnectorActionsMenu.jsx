import { useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, FileText, I, Trash2 } from '../../components/icons.jsx';
import { useOutsidePointerClose } from '../../components/ComposerPopover.jsx';

export function CapabilityActionsMenu({ tool, copy, kind = 'connector', removable, busy, onRemove, onDetails, onDisconnect }) {
  const [open, setOpen] = useState(false);
  const [keyboardNavigation, setKeyboardNavigation] = useState(false);
  const [position, setPosition] = useState({});
  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const id = useId();
  const close = () => setOpen(false);
  useOutsidePointerClose(open, close, [triggerRef, panelRef], { viewportClose: true });
  useLayoutEffect(() => {
    if (!open) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const width = Math.min(176, window.innerWidth - 24);
    const height = panelRef.current.getBoundingClientRect().height;
    const below = rect.bottom + 5;
    const top = below + height <= window.innerHeight - 12 ? below : rect.top - height - 5;
    setPosition({ left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
      top: Math.max(12, top), width });
    panelRef.current?.querySelector('button:not(:disabled)')?.focus({ preventScroll: true });
  }, [open]);
  const choose = action => { close(); triggerRef.current?.focus(); action(); };
  const onKeyDown = event => {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); close(); triggerRef.current?.focus();
    } else if (event.key === 'Tab') close();
    else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      setKeyboardNavigation(true);
      const buttons = [...panelRef.current.querySelectorAll('button:not(:disabled)')];
      const current = buttons.indexOf(document.activeElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
        : (current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }
  };
  const isSkill = kind === 'skill';
  const moreLabel = isSkill ? copy.skillMore(tool.title) : copy.connectorMore(tool.title);
  const removeLabel = isSkill ? copy.removeSkill : copy.removeConnector;
  const nothingToDelete = isSkill
    ? (tool.builtin ? copy.builtinSkillCannotDelete : copy.skillNothingToDelete)
    : copy.connectorNothingToDelete;
  return <>
    <button type="button" ref={triggerRef} className="capability-more" data-testid={isSkill ? 'skill-more' : 'connector-more'} data-tool-id={tool.backendId}
      aria-label={moreLabel} aria-expanded={open} aria-haspopup="menu" aria-controls={open ? id : undefined}
      disabled={busy} onClick={event => { event.stopPropagation(); setKeyboardNavigation(event.detail === 0); setOpen(value => !value); }}>
      <MoreHorizontal size={18} />
    </button>
    {open && createPortal(<div id={id} ref={panelRef} role="menu" aria-label={moreLabel}
      className="capability-action-menu" data-keyboard={keyboardNavigation} style={position} onKeyDown={onKeyDown} onClick={event => event.stopPropagation()}>
      <button type="button" role="menuitem" onClick={event => { event.stopPropagation(); choose(onDetails); }}><FileText size={14} />{copy.connectorDetails}</button>
      {onDisconnect && <button type="button" role="menuitem" data-tool-id={tool.backendId}
        onClick={event => { event.stopPropagation(); choose(onDisconnect); }}><I size={14}><path d="M18.4 5.6a9 9 0 1 1-12.8 0" /><path d="M12 2v10" /></I>{copy.connectorDisconnect}</button>}
      <div className="capability-menu-divider" />
      <button type="button" role="menuitem" data-testid={`tool-store-remove-${kind}`} data-tool-id={tool.backendId}
        disabled={!removable || busy} className="capability-menu-delete"
        onClick={event => { event.stopPropagation(); choose(() => onRemove(tool)); }}><Trash2 size={14} />{removeLabel}</button>
      {!removable && <p>{nothingToDelete}</p>}
    </div>, document.body)}
  </>;
}

export const ConnectorActionsMenu = CapabilityActionsMenu;
