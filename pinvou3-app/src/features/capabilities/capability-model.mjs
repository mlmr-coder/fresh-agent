export const CAPABILITY_TABS = ['experts', 'skills', 'connectors'];

// Marketplace tools are connectors. Marketplace skills stay in the skill list
// unless a connector owns them through companion_skills, in which case the
// combined package has one connector card.
export function capabilityKindForEntry(entry, sourceKind) {
  if (sourceKind === 'expert') return 'expert';
  if (entry?.capabilityKind === 'skill' || entry?.capabilityKind === 'connector') {
    return entry.capabilityKind;
  }
  if (sourceKind === 'connector' || entry?.companionBundle) return 'connector';
  if (sourceKind === 'skill') return 'skill';

  if (entry?.mcpServer || entry?.oauthMcp || entry?.feishuCli || entry?.wecomCli
    || entry?.dingtalkCli || entry?.tmeetCli || entry?.imaOpenapi) {
    return 'connector';
  }
  return 'skill';
}

export function resolveLiveCapabilitySelection(selected, entries) {
  if (!selected) return null;
  const live = (Array.isArray(entries) ? entries : []).find((entry) => (
    selected.backendId
      ? entry.backendId === selected.backendId
      : entry.id === selected.id
  ));
  return live ? { ...selected, ...live } : selected;
}
