import { CardPoolView } from '../personas/Personas.jsx';
import { ToolStoreView } from '../tools/ToolStoreView.jsx';
import { CAPABILITY_TABS } from './capability-model.mjs';

export function CapabilityCenterView({
  theme,
  t,
  bs,
  activeTab,
  onTabChange,
  onEquipped,
  onAICreate,
  initialMyOnly,
  onNewChat,
}) {
  const labels = {
    experts: t.capabilityExperts,
    skills: t.capabilitySkills,
    connectors: t.capabilityConnectors,
  };

  return (
    <div data-testid="capability-center" className="flex-1 min-h-0 flex flex-col bg-white text-slate-900 dark:bg-[#131314] dark:text-white">
      <header className="shrink-0 border-b border-slate-200/70 px-4 py-4 dark:border-white/10 sm:px-6 lg:px-10 lg:py-6">
        <div className="mx-auto flex max-w-[1400px] flex-col gap-3 sm:flex-row sm:items-center sm:gap-7">
          <h1 className="text-[26px] font-normal tracking-tight">{t.capabilityCenter}</h1>
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar" aria-label={t.capabilityCenter}>
            {CAPABILITY_TABS.map((tab) => {
              const selected = activeTab === tab;
              return (
                <button
                  type="button"
                  key={tab}
                  data-testid={`capability-tab-${tab}`}
                  aria-current={selected ? 'page' : undefined}
                  onClick={() => onTabChange(tab)}
                  className={`h-10 shrink-0 rounded-xl px-4 text-[14px] font-semibold transition-colors ${selected
                    ? 'bg-[#3A3A3C] text-white shadow-sm dark:bg-white dark:text-black'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10'}`}
                >
                  {labels[tab]}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {activeTab === 'experts' && (
          <CardPoolView theme={theme} t={t} bs={bs} onEquipped={onEquipped} onAICreate={onAICreate} initialMyOnly={initialMyOnly} />
        )}
        {activeTab === 'skills' && (
          <ToolStoreView theme={theme} t={t} onNewChat={onNewChat} capabilityKind="skill" embedded />
        )}
        {activeTab === 'connectors' && (
          <ToolStoreView theme={theme} t={t} onNewChat={onNewChat} capabilityKind="connector" embedded />
        )}
      </div>
    </div>
  );
}
