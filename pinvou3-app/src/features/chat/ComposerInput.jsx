import { useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { composerSegments, readComposerNode, readComposerSelection, renderComposerValue, setComposerSelection } from './composer-input-dom.js';
import './composer-input.css';

// A small rich-text surface with the existing composer value/selection contract.
// No HTML leaves the editor: drafts, voice, clipboard and send all use plain text.
export function ComposerInput({ ref, value, skills, onChange, onSelect, onKeyDown, onPaste, placeholder, className, maxLength, resetKey, ...props }) {
  const rootRef = useRef(null);
  const composing = useRef(false);
  const selection = useRef({ start: 0, end: 0 });
  const latest = useRef({ skills });
  const history = useRef({ key: resetKey, entries: [{ value, start: value.length, end: value.length }], index: 0 });
  const pendingSelection = useRef(null);
  const lastPublished = useRef(null);

  useImperativeHandle(ref, () => {
    const root = rootRef.current;
    Object.defineProperties(root, {
      value: { configurable: true, get: () => readComposerNode(root), set: text => { root.textContent = String(text); } },
      selectionStart: { configurable: true, get: () => readComposerSelection(root, selection.current).start, set: start => { root.setSelectionRange(start, start); } },
      selectionEnd: { configurable: true, get: () => readComposerSelection(root, selection.current).end, set: end => { root.setSelectionRange(root.selectionStart, end); } },
    });
    root.setSelectionRange = (start, end = start) => {
      selection.current = { start, end };
      setComposerSelection(root, start, end);
    };
    root.select = () => root.setSelectionRange(0, root.value.length);
    return root;
  }, []);

  useLayoutEffect(() => {
    latest.current = { skills };
    if (composing.current) return;
    const root = rootRef.current;
    const focused = document.activeElement === root;
    const pending = pendingSelection.current;
    const caret = pending || readComposerSelection(root, selection.current);
    pendingSelection.current = null;
    const changed = renderComposerValue(root, value, skills);
    selection.current = { ...caret, start: Math.min(caret.start, value.length), end: Math.min(caret.end, value.length) };
    if (focused && (changed || pending)) setComposerSelection(root, selection.current.start, selection.current.end, caret.backward);
    const stack = history.current;
    if (stack.key !== resetKey || (!value && lastPublished.current !== value)) {
      history.current = { key: resetKey, entries: [{ value, ...selection.current }], index: 0 };
    } else if (stack.entries[stack.index].value !== value) {
      stack.entries = stack.entries.slice(0, stack.index + 1);
      stack.entries.push({ value, ...selection.current });
      if (stack.entries.length > 100) stack.entries.shift();
      stack.index = stack.entries.length - 1;
    }
  }, [value, skills, resetKey]);

  const publish = event => {
    const root = rootRef.current;
    selection.current = readComposerSelection(root, selection.current);
    lastPublished.current = readComposerNode(root);
    onChange?.({ ...event, target: root, currentTarget: root });
  };
  const replaceSelection = (text, event, range = readComposerSelection(rootRef.current, selection.current)) => {
    const root = rootRef.current;
    const raw = readComposerNode(root);
    const room = Math.max(0, maxLength - (raw.length - range.end + range.start));
    const inserted = String(text).slice(0, room);
    const next = raw.slice(0, range.start) + inserted + raw.slice(range.end);
    const caret = range.start + inserted.length;
    renderComposerValue(root, next, latest.current.skills);
    setComposerSelection(root, caret);
    publish(event);
  };
  const undo = (redo, event) => {
    const stack = history.current;
    const next = stack.index + (redo ? 1 : -1);
    event.preventDefault();
    if (next < 0 || next >= stack.entries.length) return;
    stack.index = next;
    const snapshot = stack.entries[next];
    pendingSelection.current = snapshot;
    renderComposerValue(rootRef.current, snapshot.value, latest.current.skills);
    setComposerSelection(rootRef.current, snapshot.start, snapshot.end);
    publish(event);
  };
  const handleKeyDown = event => {
    if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return;
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if ((event.metaKey || event.ctrlKey) && !event.altKey && /^[zy]$/i.test(event.key)) {
      undo(event.shiftKey || event.key.toLowerCase() === 'y', event);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      replaceSelection('\n', event);
      return;
    }
    if (!['Backspace', 'Delete'].includes(event.key) || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const range = readComposerSelection(rootRef.current, selection.current);
    if (range.start !== range.end) return;
    let start = 0;
    for (const segment of composerSegments(value, skills)) {
      const end = start + segment.text.length;
      const afterSeparator = range.start === end + 1 && value[end] === ' ';
      if (segment.name && (event.key === 'Backspace' ? range.start === end || afterSeparator : range.start === start)) {
        event.preventDefault();
        replaceSelection('', event, { start, end: event.key === 'Backspace' && afterSeparator ? end + 1 : end });
        return;
      }
      start = end;
    }
  };
  const copy = (event, cut) => {
    const range = readComposerSelection(rootRef.current, selection.current);
    if (range.start === range.end) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', readComposerNode(rootRef.current).slice(range.start, range.end));
    if (cut) replaceSelection('', event, range);
  };

  return <div {...props} ref={rootRef} contentEditable suppressContentEditableWarning
    aria-multiline="true" aria-label={placeholder} data-placeholder={placeholder}
    className={`composer-rich-input ${className}`}
    onInput={publish}
    onSelect={event => { selection.current = readComposerSelection(rootRef.current, selection.current); onSelect?.(event); }}
    onKeyDown={handleKeyDown}
    onBeforeInput={event => {
      const type = event.nativeEvent.inputType;
      if (type === 'historyUndo' || type === 'historyRedo') undo(type === 'historyRedo', event);
      else if (type === 'insertParagraph' || type === 'insertLineBreak') { event.preventDefault(); replaceSelection('\n', event); }
    }}
    onCompositionStart={() => { composing.current = true; }}
    onCompositionEnd={event => {
      composing.current = false;
      const root = rootRef.current;
      const caret = readComposerSelection(root, selection.current);
      renderComposerValue(root, readComposerNode(root).slice(0, maxLength), skills);
      setComposerSelection(root, caret.start, caret.end, caret.backward);
      publish(event);
    }}
    onPaste={event => {
      onPaste?.(event);
      if (event.defaultPrevented) return;
      event.preventDefault();
      replaceSelection(event.clipboardData.getData('text/plain').replaceAll(/\r\n?/g, '\n'), event);
    }}
    onCopy={event => copy(event, false)} onCut={event => copy(event, true)}
    onDrop={event => { event.preventDefault(); }}
  />;
}
