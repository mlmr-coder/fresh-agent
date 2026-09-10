import { PERSONA_REMOVAL_PREFIXES } from '../../shared/i18n.js';

// Old sessions persist removal events as localized system text. Recognize only
// those exact prefixes, leaving ordinary system and user messages untouched.
export function removedPersonaName(item) {
  if (item?.type !== 'system' || typeof item.text !== 'string') return null;
  const prefix = PERSONA_REMOVAL_PREFIXES.find(value => item.text.startsWith(value));
  return prefix ? item.text.slice(prefix.length).trim() : null;
}
