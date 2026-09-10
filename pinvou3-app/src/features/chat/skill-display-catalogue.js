const SKILL_DISPLAY_CACHE_KEY = 'pinvou3:skill-display-catalogue:v1';

function cleanText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export function skillReferenceNames(skill) {
  return [...new Set([
    cleanText(skill?.title),
    cleanText(skill?.name),
    cleanText(skill?.catalogue_id),
    ...(Array.isArray(skill?.aliases) ? skill.aliases.map(cleanText) : []),
  ].filter(Boolean))];
}

function normalizedSkill(skill) {
  const name = cleanText(skill?.name) || cleanText(skill?.catalogue_id) || cleanText(skill?.title);
  if (!name) return null;
  return {
    name,
    catalogue_id: cleanText(skill?.catalogue_id) || name,
    title: cleanText(skill?.title) || name,
    aliases: [...new Set((Array.isArray(skill?.aliases) ? skill.aliases : []).map(cleanText).filter(Boolean))],
    icon: cleanText(skill?.icon) || 'Package',
    color: cleanText(skill?.color) || 'bg-gradient-to-b from-slate-400 to-slate-600',
  };
}

// Lists are ordered from oldest/least specific to newest/most specific. A later
// entry refreshes presentation metadata while retaining identifiers learned from
// older catalogues, so a renamed skill continues to render old references.
export function mergeSkillDisplayCatalogues(...catalogues) {
  const merged = [];
  const keyToIndex = new Map();
  for (const catalogue of catalogues) {
    for (const raw of Array.isArray(catalogue) ? catalogue : []) {
      const skill = normalizedSkill(raw);
      if (!skill) continue;
      const keys = skillReferenceNames(skill).map(value => value.toLocaleLowerCase());
      const existingIndex = keys.map(key => keyToIndex.get(key)).find(index => index !== undefined);
      if (existingIndex === undefined) {
        const index = merged.length;
        merged.push(skill);
        keys.forEach(key => keyToIndex.set(key, index));
        continue;
      }
      const previous = merged[existingIndex];
      const previousNames = skillReferenceNames(previous);
      const next = {
        ...previous,
        ...skill,
        aliases: [...new Set([
          ...(previous.aliases || []),
          ...previousNames.filter(name => name !== skill.name && name !== skill.title && name !== skill.catalogue_id),
          ...(skill.aliases || []),
        ])],
      };
      merged[existingIndex] = next;
      skillReferenceNames(next).forEach(name => keyToIndex.set(name.toLocaleLowerCase(), existingIndex));
    }
  }
  return merged;
}

function browserStorage(storage) {
  if (storage) return storage;
  return typeof localStorage === 'undefined' ? null : localStorage;
}

export function readSkillDisplayCache(storage) {
  try {
    return mergeSkillDisplayCatalogues(JSON.parse(browserStorage(storage)?.getItem(SKILL_DISPLAY_CACHE_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function writeSkillDisplayCache(skills, storage) {
  try {
    browserStorage(storage)?.setItem(SKILL_DISPLAY_CACHE_KEY, JSON.stringify(mergeSkillDisplayCatalogues(skills)));
  } catch {
    // Rendering history must remain usable when storage is unavailable or full.
  }
}

export function marketplaceSkillForDisplay(skill, title) {
  return normalizedSkill({
    name: skill?.id,
    catalogue_id: skill?.id,
    title: title || skill?.title || skill?.id,
    aliases: skill?.aliases,
    icon: skill?.icon,
    color: skill?.color,
  });
}
