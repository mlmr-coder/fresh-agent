// UI insertion only: skill execution remains CodeWhale's load_skill flow.
export function composerToken(text, caret) {
  const before = String(text).slice(0, caret);
  const match = /([/@])([\p{L}\p{N}_.:-]*)$/u.exec(before);
  if (!match) return null;
  const start = caret - match[2].length - 1;
  const prefix = before.slice(0, start);
  let wordStart = prefix.length;
  while (wordStart > 0 && !/\s/u.test(prefix[wordStart - 1])) wordStart -= 1;
  const word = prefix.slice(wordStart);
  // URLs, email addresses and filesystem paths are ordinary text, not triggers.
  if (word.includes('/') || word.includes('\\') || word.endsWith(':')) return null;
  if (match[1] === '@' && /[A-Za-z0-9._%+-]$/.test(prefix)) return null;
  return { kind: match[1] === '/' ? 'skills' : 'files', query: match[2], start, end: caret };
}

export function insertComposerSuggestion(text, token, insertion) {
  const before = text.slice(0, token.start);
  const after = text.slice(token.end);
  const value = `${before}${insertion} ${after}`;
  return { value, caret: before.length + insertion.length + 1 };
}

export function composerSuggestions(kind, catalogue, query) {
  const entries = kind === 'files'
    ? catalogue.map(file => ({ id: file.path, title: file.name, description: file.path, insertion: `@${JSON.stringify(file.path)}`, kind: 'file' }))
    : catalogue.map(skill => ({ id: `skill:${skill.name}`, title: `/${skill.title || skill.name}`, code: skill.name, description: skill.description, aliases: [skill.name, ...(skill.aliases || [])], insertion: `/${skill.title || skill.name}`, kind: 'skill', icon: skill.icon, color: skill.color }));
  const needle = query.toLocaleLowerCase();
  return entries.filter(entry => [entry.title, entry.description, ...(entry.aliases || [])].join(' ').toLocaleLowerCase().includes(needle));
}
