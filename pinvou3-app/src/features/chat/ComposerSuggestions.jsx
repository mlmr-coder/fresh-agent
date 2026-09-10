import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { ComposerPopover, POPOVER_SURFACE } from '../../components/ComposerPopover.jsx';
import { FileText, Sparkles } from '../../components/icons.jsx';
import { invokeTauri } from '../../platform/tauri/client.js';
import { composerSuggestions, composerToken, insertComposerSuggestion } from './composer-suggestions.js';
import {
  marketplaceSkillForDisplay,
  mergeSkillDisplayCatalogues,
  readSkillDisplayCache,
  writeSkillDisplayCache,
} from './skill-display-catalogue.js';

export function useComposerSuggestions({ text, setText, inputRef, sessionId, language, scope = 'plain', workspacePath = null, copy, disabled, onManageSkills, skillLabels, builtinSkillTitle }) {
  const listId = useId();
  const [caret, setCaret] = useState(0);
  const [dismissed, setDismissed] = useState(null);
  const [selection, setSelection] = useState(0);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState(null);
  const [skillsResult, setSkillsResult] = useState(null);
  const [displaySkills, setDisplaySkills] = useState(() => readSkillDisplayCache());
  const pendingCaret = useRef(null);
  const token = composerToken(text, caret);
  const key = `${sessionId}:${text}:${caret}`;
  const open = !disabled && !!token && key !== dismissed;
  const kind = open ? token.kind : null;
  const requestKey = `${sessionId}:${kind}:${language}:${revision}`;
  const skillsKey = `${scope}:${workspacePath || ''}:${language}:${revision}`;

  useLayoutEffect(() => {
    const pending = pendingCaret.current;
    if (!pending || !inputRef.current) return;
    pendingCaret.current = null;
    if (pending.value !== text) return;
    // Restore the caret with the DOM commit, before the next keystroke.
    inputRef.current.focus();
    inputRef.current.setSelectionRange(pending.caret, pending.caret);
  }, [text, inputRef]);

  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('pinvou:tools-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('pinvou:tools-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    invokeTauri('list_composer_skills', { language, scope, workspacePath }).then(items => {
      if (!Array.isArray(items)) throw new Error('Invalid composer catalogue response');
      if (alive) {
        const localized = items.map(item => ({
          ...item, title: skillLabels?.[item.catalogue_id || item.name]?.title
            || (item.name === 'visual-design' ? builtinSkillTitle : item.title) || item.name,
        }));
        setSkillsResult({ key: skillsKey, items: localized });
        setDisplaySkills(previous => {
          const next = mergeSkillDisplayCatalogues(previous, localized);
          writeSkillDisplayCache(next);
          return next;
        });
      }
    }).catch(() => {
      if (alive) setSkillsResult({ key: skillsKey, items: [], error: true });
    });
    return () => { alive = false; };
  }, [language, scope, workspacePath, skillsKey, skillLabels, builtinSkillTitle]);

  useEffect(() => {
    let alive = true;
    Promise.allSettled([
      invokeTauri('list_marketplace_skills'),
      invokeTauri('list_composer_display_skills', { language, workspacePath }),
    ]).then(results => {
      const marketplace = results[0].status === 'fulfilled' && Array.isArray(results[0].value)
        ? results[0].value.map(item => marketplaceSkillForDisplay(
          item,
          skillLabels?.[item.id]?.title
            || (item.id === 'visual-design' ? builtinSkillTitle : item.title),
        )).filter(Boolean)
        : [];
      const installed = results[1].status === 'fulfilled' && Array.isArray(results[1].value)
        ? results[1].value.map(item => ({
          ...item,
          title: skillLabels?.[item.catalogue_id || item.name]?.title
            || (item.name === 'visual-design' ? builtinSkillTitle : item.title) || item.name,
        }))
        : [];
      if (alive) setDisplaySkills(previous => {
        const next = mergeSkillDisplayCatalogues(previous, marketplace, installed);
        writeSkillDisplayCache(next);
        return next;
      });
    });
    return () => { alive = false; };
  }, [language, workspacePath, revision, skillLabels, builtinSkillTitle]);

  useEffect(() => {
    if (kind !== 'files') return;
    let alive = true;
    const request = sessionId ? invokeTauri('list_composer_files', { sessionId }) : Promise.resolve([]);
    request.then(items => {
      if (!Array.isArray(items)) throw new Error('Invalid composer catalogue response');
      if (alive) setResult({ key: requestKey, items });
    }).catch(() => {
      if (alive) setResult({ key: requestKey, items: [], error: true });
    });
    return () => { alive = false; };
  }, [kind, sessionId, requestKey]);

  const catalogue = kind === 'skills' ? skillsResult : result;
  const loaded = catalogue?.key === (kind === 'skills' ? skillsKey : requestKey);
  const entries = kind && loaded ? composerSuggestions(kind, catalogue.items, token.query) : [];
  const codeSkills = kind === 'skills' && scope === 'code';
  const skillsTitle = codeSkills ? (copy.codeSkills || copy.skillsAndCommands) : copy.skillsAndCommands;
  const emptySkills = codeSkills ? (copy.noCodeSkills || copy.noMatches) : copy.noMatches;
  const skillKind = codeSkills ? (copy.codeAvailable || copy.skill) : copy.skill;
  const manageSkills = codeSkills ? (copy.manageCodeSkills || copy.manageSkills) : copy.manageSkills;
  const selectedIndex = Math.min(selection, Math.max(0, entries.length - 1));
  const close = () => setDismissed(key);
  const select = entry => {
    const inserted = insertComposerSuggestion(text, token, entry.insertion);
    pendingCaret.current = inserted;
    setText(inserted.value);
    setCaret(inserted.caret);
    close();
  };
  const onSelect = event => {
    const input = event.currentTarget;
    setCaret(input.selectionStart);
    setSelection(0);
    if (input.isContentEditable) {
      let offset = 0;
      for (const child of input.childNodes) {
        offset += (child.dataset?.skillText || child.textContent || '').length;
        if (child.dataset?.skillText && offset === input.selectionStart) {
          setDismissed(`${sessionId}:${input.value}:${input.selectionStart}`);
          break;
        }
      }
    }
  };
  const onKeyDown = event => {
    if (!open || event.isComposing || event.nativeEvent?.isComposing || event.keyCode === 229) return false;
    if (event.key === 'Escape') { event.preventDefault(); close(); return true; }
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return false;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const next = entries.length ? (selectedIndex + (event.key === 'ArrowDown' ? 1 : entries.length - 1)) % entries.length : 0;
      setSelection(next);
      document.querySelector(`[id="${listId}-${next}"]`)?.scrollIntoView({ block: 'nearest' });
      return true;
    }
    if (event.key === 'Enter' || event.key === 'Tab') {
      // Never submit while a suggestion is loading or the list is empty.
      event.preventDefault();
      if (entries[selectedIndex]) select(entries[selectedIndex]);
      return true;
    }
    return false;
  };

  const menu = (
    <ComposerPopover open={open} onClose={close} triggerRef={inputRef} portal menuWidth={440}
      desktopClassName={`absolute bottom-full left-0 ${POPOVER_SURFACE}`}
      menuProps={{ 'data-testid': 'composer-suggestions' }}>
      <div className="flex items-center justify-between gap-3 px-3 py-2 text-[12px] font-semibold text-gray-500">
        <span>{kind === 'files' ? copy.files : skillsTitle}</span>
        {codeSkills && <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500">{copy.codeScopeHint}</span>}
      </div>
      <div id={listId} role="listbox" aria-label={kind === 'files' ? copy.files : skillsTitle}>
        {!loaded && <div role="status" className="px-3 py-3 text-[13px] text-gray-400">{copy.loading}</div>}
        {loaded && !entries.length && <div role="status" className="px-3 py-3 text-[13px] text-gray-400">{catalogue.error ? copy.loadFailed : kind === 'files' ? copy.noFiles : emptySkills}</div>}
        {entries.map((entry, index) => {
          const Icon = entry.kind === 'file' ? FileText : Sparkles;
          return <button type="button" role="option" aria-selected={index === selectedIndex} id={`${listId}-${index}`} key={entry.id}
            onMouseDown={event => event.preventDefault()} onClick={() => select(entry)}
            className={`flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left ${index === selectedIndex ? 'bg-[#007AFF]/10 text-[#007AFF]' : 'text-gray-700 hover:bg-black/5 dark:text-gray-200 dark:hover:bg-white/10'}`}>
            <Icon size={16} className="mt-0.5 shrink-0" />
            <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{entry.title}</span>
              {entry.kind === 'skill' && entry.code && (
                <span data-testid="composer-skill-code" className="mt-0.5 block truncate font-mono text-[10px] text-[#007AFF]/75 dark:text-blue-300/75">
                  {copy.skillCode(entry.code)}
                </span>
              )}
              <span className="mt-0.5 block truncate text-[11px] text-gray-500 dark:text-gray-400">{entry.description}</span></span>
            <span className="text-[10px] text-gray-400">{entry.kind === 'skill' ? skillKind : copy[entry.kind]}</span>
          </button>;
        })}
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 border-t border-black/5 px-3 pt-2 pb-1 text-[11px] text-gray-400 dark:border-white/10">
        <span>{copy.keyboardHint}</span>
        {kind === 'skills' && <button type="button" onClick={() => { close(); onManageSkills?.(); }} className="text-[#007AFF]">{manageSkills}</button>}
        {catalogue?.error && <button type="button" onClick={() => setRevision(value => value + 1)} className="text-[#007AFF]">{copy.retry}</button>}
      </div>
    </ComposerPopover>
  );
  return { menu, onSelect, onKeyDown, close, skills: skillsResult?.items || [], displaySkills, inputProps: {
    role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': open,
    'aria-controls': open ? listId : undefined,
    'aria-activedescendant': open && entries.length ? `${listId}-${selectedIndex}` : undefined,
  } };
}
