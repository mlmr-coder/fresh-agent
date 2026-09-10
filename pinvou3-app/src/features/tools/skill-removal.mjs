export function canRemoveSkill(tool) {
  return Boolean(tool?.backendId && tool.installed && !tool.builtin);
}

// Companion skills are part of one connector package. Removing only their
// materialized skill directory would leave a partial package, so delete the
// owning connector package when it is installed. Standalone skills use the
// skill marketplace uninstall path.
export async function removeSkill(tool, invoke) {
  if (!canRemoveSkill(tool)) throw new Error('skill_not_installed');
  if (tool.companionBundle && tool.connectorId && tool.packageInstalled) {
    await invoke('uninstall_marketplace_tool', { toolId: tool.connectorId });
    return { removedWithConnector: true };
  }
  await invoke('uninstall_marketplace_skill', { skillId: tool.backendId });
  return { removedWithConnector: false };
}
