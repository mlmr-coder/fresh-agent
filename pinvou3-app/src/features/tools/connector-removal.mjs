const CLI_CONNECTORS = new Set(['feishu', 'wecom', 'dingtalk', 'tmeet']);

export function canRemoveConnector(tool) {
  if (!tool?.backendId || tool.builtin) return false;
  if (tool.companionBundle) return Boolean(tool.connectorId && tool.packageInstalled);
  return Boolean(tool.packageInstalled || tool.installed || tool.mcpConfigured);
}

// Disconnect is best-effort: a third-party session/revoke failure must not
// trap a locally installed connector in the app. The marketplace uninstall is
// the authoritative local deletion and remains fail-loud.
export async function removeConnector(tool, invoke) {
  if (!canRemoveConnector(tool)) throw new Error('connector_not_installed');
  const id = tool.connectorId || tool.backendId;
  const cleanupFailures = [];
  if (CLI_CONNECTORS.has(id) || id === 'ima') {
    try {
      const result = await invoke(`${id}_logout`);
      if (result?.ok === false) cleanupFailures.push(`${id}_logout`);
    } catch {
      cleanupFailures.push(`${id}_logout`);
    }
    if (CLI_CONNECTORS.has(id)) {
      try {
        await invoke(`${id}_apply_skills`);
      } catch {
        cleanupFailures.push(`${id}_apply_skills`);
      }
    }
  }
  await invoke('uninstall_marketplace_tool', { toolId: id });
  return { cleanupFailures };
}
