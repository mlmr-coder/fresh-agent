// 输入框共享组件:模型选择器/工具菜单/技能菜单/产物 HTML 缩放预览。原生于
// SettingsView.jsx,但 ChatView(启动视图)与 CodexAcpView 也静态引用——只要
// 留在 SettingsView.jsx 里,SettingsView(3389 行)就永远进不了独立懒加载
// chunk。抽到本模块后 SettingsView 可整体懒加载,共享件随主 chunk 常驻。
// 组件实现与 SettingsView.jsx 原版逐字节一致。
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Cpu, Plus, Server, Sparkles, Store, Users, Wrench, X } from '../../components/icons.jsx';
import { ComposerPopover } from '../../components/ComposerPopover.jsx';
import { Toggle } from '../../components/Toggle.jsx';
import { bridge } from '../../hooks/useBridge.js';
import { visibleUserModels } from '../../shared/model-options.js';
import { can } from '../../shared/platform.js';
import { buildComposerToolMenuState } from './composer-tool-menu-logic.js';
import { invokeTauri } from '../../platform/tauri/client.js';
import { THIRD_PARTY_TOOL_LOGOS } from '../tools/tool-visuals.js';
import { TsToolIcon } from '../tools/ToolIcon.jsx';
import { tsToolsData, tsToolWelcomeData } from '../tools/tool-common.jsx';
import {
  artifactPreviewExternalUrlFromMessage,
  buildArtifactPreviewDocument,
} from '../artifacts/artifact-preview-navigation.js';
import {
  groupModelsForSelector, selectorMainLabel, selectorSubLabel,
  reasoningEffortTiersForModel, normalizeStoredReasoningEffort,
  alwaysThinkingSpecForModel, localReasoningTiers, reasoningEffortDisplayForTiers, baseUrlUsesLocalOrPrivate,
} from './model-catalog.js';
import { ReasoningTierPicker, useLocalServerKindProbe } from './local-server-tiers.jsx';

// 会话中「打开」是未提交态：新一轮对话发出前允许改回（误开可撤销），发出后
// code scope 下该工具/技能才真正进入上下文并按「只增不减」锁死。挂模块级按 scope 存，
// 菜单组件随切页重建时不丢未提交态；发送方通过 pinvou:chat-round-committed
// 事件提交（见 tool-events.js / bridge doSendFor、acceptPlan、editLastTurn）。
const pendingToolEnables = new Map(); // scope -> { ids: Set<string>, projectSkills: boolean }
function pendingEnablesFor(scope) {
  const key = scope === 'code' ? 'code' : 'plain';
  let entry = pendingToolEnables.get(key);
  if (!entry) {
    entry = { ids: new Set(), projectSkills: false, revision: 0 };
    pendingToolEnables.set(key, entry);
  }
  return entry;
}
// 转正（清空 pending）必须在模块级完成：受理事件可能在菜单组件已随切页卸载时
// 到达（会话 busy 时排队的消息在用户切走后 flush、后台定向发送等），挂在组件
// effect 里会漏清，重挂载后 pending 悬空、已进上下文的工具仍显示可关。本监听
// 在模块加载时注册、先于任何组件监听执行；在场组件（ComposerToolMenu 内）另
// 订阅同一事件 bump 重渲染，重渲染读到的必是已清空的 pending。
window.addEventListener('pinvou:chat-round-committed', (event) => {
  const committedScope = event && event.detail && event.detail.scope;
  const pending = pendingToolEnables.get(committedScope === 'code' ? 'code' : 'plain');
  if (!pending) return;
  pending.revision += 1;
  pending.ids.clear();
  pending.projectSkills = false;
});

    // 输入框底栏:模型选择器(iOS 化;darkMode:'class' 故用 dark: 变体)。
    // 可选“显式会话态驱动”props（代码模块原生车道用）：sessionId/sessionModelId/
    // busy/onSwitchModel 传入时绕开 bridge 聊天 active 绑定；不传走原 bs/bridge 路径。
    const ComposerModelSelector = ({
      t,
      bs,
      onGotoSettings,
      compact,
      sessionId: sessionIdProp,
      sessionModelId: sessionModelIdProp,
      busy: busyProp,
      onSwitchModel,
      multiAgentEnabled: multiAgentEnabledProp,
      multiAgentAvailable: multiAgentAvailableProp,
      onToggleMultiAgent,
      // eslint-disable-next-line sonarjs/cognitive-complexity -- the composer selector aggregates model/menu/multi-agent branches; splitting needs a dedicated design like the SettingsView suppression
    }) => {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef(null);
      const canManageModels = can('modelManagement');
      const canSwitchModels = can('sessionModelSwitch');
      // 多智能体模式 = 模型列表下方的会话级开关（ADR-0006）。状态权威在
      // 后端 mode_state，这里只读 bs 镜像；翻转后 bridge 回写权威状态。
      const canMultiAgent = can('multiAgent') && multiAgentAvailableProp !== false;
      const multiAgentOn = multiAgentEnabledProp === undefined
        ? !!(bs && bs.modeState && bs.modeState.multiAgent)
        : Boolean(multiAgentEnabledProp);
      const multiAgentCopy = (t && t.uiMultiAgent) || {};
      // 防重入（复核点名）：后端事务完成前再点会带着旧状态重复提交，
      // 其中一次名册推送失败的回滚还会覆盖另一次已开启的状态。切换期间
      // 禁用按钮；bridge 侧另有 in-flight 丢弃兜底（双入口防线）。
      const [multiAgentBusy, setMultiAgentBusy] = useState(false);
      // 揭幕动效只在用户点击开启这一刻播放：会话切换/重启同步出现的
      // 开启态、弹层关了再开，都不重播揭幕（真机点名），但光晕持续漂移
      // （真机点名"动画不能停"，挂在常态类上）。触发源是点击处理器而
      // 不是状态上升沿；点击关闭或弹层关闭时清掉标记，避免误续播。
      const [multiAgentRevealing, setMultiAgentRevealing] = useState(false);
      useEffect(() => {
        if (!open) setMultiAgentRevealing(false); // eslint-disable-line react-hooks/set-state-in-effect -- clear the reveal flag when the popup closes so reopening doesn't wrongly resume playback
      }, [open]);
      async function toggleMultiAgent() {
        if (multiAgentBusy || busy) return;
        if (!onToggleMultiAgent
          && !(bridge.available && bridge.interaction && bridge.interaction.setMultiAgentMode)) return;
        setMultiAgentRevealing(!multiAgentOn);
        setMultiAgentBusy(true);
        try {
          if (onToggleMultiAgent) await onToggleMultiAgent(!multiAgentOn);
          else await bridge.interaction.setMultiAgentMode(!multiAgentOn);
        } finally {
          setMultiAgentBusy(false);
        }
      }
      const savedModels = visibleUserModels((bs && bs.savedModels) || []);
      const activeSessionId = sessionIdProp === undefined ? (bs ? bs.activeSessionId : null) : sessionIdProp;
      const activeModelId = bs && bs.activeModelId;
      const currentSessionModelId = sessionModelIdProp === undefined ? (bs && bs.currentSessionModelId) : sessionModelIdProp;
      const busy = busyProp === undefined ? (bs ? bs.busy : false) : busyProp;
      const effectiveId = currentSessionModelId || activeModelId;
      const current = savedModels.find(m => m.id === effectiveId);
      // 本地/私网 openai_compatible 端点：探测服务类型，按探测结果下发真实档位
      // (vllm → four tiers, ollama → off/high, lmstudio/generic → unsupported hint). Credentials are saved values
      // that do not change per keystroke, so no debounce is needed (only the form entry needs 400ms, see the hook comment).
      const currentBaseUrl = current ? (current.base_url || '') : '';
      const currentModelId = current ? current.id : null;
      const isLocalCompatible = !!current && current.preset === 'openai_compatible' && baseUrlUsesLocalOrPrivate(currentBaseUrl);
      const { probedKind: currentProbedKind, probePending: currentProbePending } = useLocalServerKindProbe({
        enabled: isLocalCompatible,
        baseUrl: currentBaseUrl,
        apiKey: '',
        modelId: currentModelId,
        debounceMs: 0,
      });
      const reasoningEffortTiers = isLocalCompatible
        ? (currentProbePending ? [] : (localReasoningTiers(current ? current.model : null, currentProbedKind) || []))
        : (current ? (reasoningEffortTiersForModel(current) || []) : []);
      // Local routes (vllm preset / local-compatible endpoints) hit the "always-thinking,
      // no-control" knowledge table: the effort-tier area shows an "always on" hint instead of probe-unsupported.
      const currentNoControlThinking = !!current
        && (current.preset === 'local_vllm' || isLocalCompatible)
        && !!(alwaysThinkingSpecForModel(current.model) || {}).noControl;
      // 存量档位（可能保存过底座归一前的旧值，如 deepseek 的 medium）先归一到
      // 档位表内等价档位再高亮，避免「档位表不含该值 → 下拉无高亮」。
      const reasoningEffortValue = current ? normalizeStoredReasoningEffort(current, current.reasoning_effort) : null;
      // Highlight fallback: normalization uses the static four-tier table, but
      // once ollama is probed only the off/high tiers render, so a stored
      // low/medium would land on no button; the display maps to the nearest
      // tier (think:true is equivalent to high), while click comparison still
      // uses the normalized original value, so a saved low survives switching
      // back to a four-tier endpoint.
      const reasoningEffortDisplay = reasoningEffortDisplayForTiers(reasoningEffortValue, reasoningEffortTiers);
      const [effortSaveError, setEffortSaveError] = useState('');
      function setReasoningEffortForCurrent(tier) {
        if (!current) return;
        if (tier === reasoningEffortValue) return;
        setEffortSaveError('');
        const next = { ...current, reasoning_effort: tier };
        if (!bridge.available) { setOpen(false); return; }
        // 保存成功才收弹层；失败保留弹层以便展示 effortSaveError（否则错误渲染
        // 在已关闭的 popover 内不可达）。
        bridge.models.saveModel(next)
          .then(() => { setOpen(false); setEffortSaveError(''); })
          .catch((error) => {
            const message = (error && error.message)
              ? error.message
              : ((t && t.saveModelFailed) || '保存失败');
            setEffortSaveError(message);
          });
      }
      if (!savedModels.length) return null;
      function pick(id) {
        setOpen(false);
        setEffortSaveError('');
        if (id === effectiveId) return;
        if (onSwitchModel) { onSwitchModel(activeSessionId, id); return; }
        if (bridge.available) bridge.models.switchModel(activeSessionId, id);
      }
      return (
        <div className="relative min-w-0">
          <button type="button" ref={triggerRef} data-testid="composer-model-selector-trigger" onClick={() => { if (!busy && canSwitchModels) setOpen(o => !o); }} disabled={busy || !canSwitchModels}
            title={(current ? selectorMainLabel(current, t) : t.modelNonePick) + (busy ? ' · ' + t.modelSwitchBusy : '')}
            className={`relative shrink-0 flex items-center justify-center ${multiAgentOn ? 'text-[#6d28d9] dark:text-[#c4b5fd]' : 'text-gray-700 dark:text-gray-200'} transition-colors border disabled:opacity-50 ${compact ? 'w-9 h-9 rounded-full bg-transparent hover:bg-black/5 dark:hover:bg-white/10 border-transparent' : 'h-8 gap-1.5 rounded-[12px] px-2.5 text-[12px] font-semibold min-w-0 max-w-full bg-black/[0.045] dark:bg-white/[0.055] hover:bg-black/[0.07] dark:hover:bg-white/[0.09] border-black/[0.045] dark:border-white/[0.06]'}`}>
            {compact ? (
              <>
                <Cpu size={18} className="opacity-80" />
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#34C759] ring-2 ring-white dark:ring-[#161618]"></span>
              </>
            ) : (
              <>
                <span className="w-1.5 h-1.5 shrink-0 rounded-full bg-[#34C759]"></span>
                <span className="max-w-[116px] truncate">{current ? selectorMainLabel(current, t) : t.modelNonePick}</span>
                <ChevronDown size={13} className="opacity-50 shrink-0" />
              </>
            )}
          </button>
          <ComposerPopover open={open && canSwitchModels} onClose={() => setOpen(false)} triggerRef={triggerRef} compact={compact}
            desktopClassName="absolute bottom-full left-0 mb-2 z-50 w-64 max-h-[340px] overflow-y-auto bg-white dark:bg-[#1E1E20] border border-black/5 dark:border-white/10 rounded-2xl shadow-xl p-1.5">
                {(() => {
                  const { preset, custom } = groupModelsForSelector(savedModels);
                  const renderGroup = (label, items, withDivider) => items.length > 0 && (
                    <>
                      {withDivider && <div className="h-px bg-black/5 dark:bg-white/10 my-1.5 mx-2" />}
                      <div className="px-3 pt-1.5 pb-1 text-[11px] font-semibold text-gray-400 dark:text-gray-500">{label}</div>
                      {items.map(m => (
                        <button type="button" key={m.id} onClick={() => pick(m.id)}
                          className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left rounded-xl transition-colors group hover:bg-[#007AFF] hover:text-white">
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Cpu size={15} className="shrink-0 text-gray-400 group-hover:text-white/90" />
                            <span className="min-w-0">
                              <span className="block text-[13px] truncate text-gray-700 dark:text-gray-200 group-hover:text-white">{selectorMainLabel(m, t)}</span>
                              <span className="block text-[11px] truncate text-gray-400 dark:text-gray-500 group-hover:text-white/80">{selectorSubLabel(m, t)}</span>
                            </span>
                          </span>
                          {m.id === effectiveId && <Check size={15} className="shrink-0 text-[#007AFF] group-hover:text-white" />}
                        </button>
                      ))}
                    </>
                  );
                  return (
                    <>
                      {renderGroup(t.modelGroupPreset, preset, false)}
                      {renderGroup(t.modelGroupCustom, custom, preset.length > 0)}
                    </>
                  );
                })()}
                {current && (reasoningEffortTiers.length > 0 || isLocalCompatible || currentNoControlThinking) && (
                  <>
                    <div className="h-px bg-black/5 dark:bg-white/10 my-1.5 mx-2" />
                    <div className="px-3 pt-1 pb-1">
                      <div className="text-[11px] font-semibold text-gray-400 dark:text-gray-500 mb-1.5">{t.thinkingDepth}</div>
                      <ReasoningTierPicker
                        t={t}
                        variant="composer"
                        tiers={reasoningEffortTiers}
                        selected={reasoningEffortDisplay}
                        onSelect={setReasoningEffortForCurrent}
                        pending={currentProbePending}
                        noControlThinking={currentNoControlThinking}
                      />
                      {effortSaveError && (
                        <div className="mt-1.5 text-[11px] leading-4 text-[#FF3B30] dark:text-[#FF6B6B]">{effortSaveError}</div>
                      )}
                    </div>
                  </>
                )}
                {canMultiAgent && (
                  <>
                    <div className="h-px bg-black/5 dark:bg-white/10 my-1.5 mx-2" />
                    <button type="button" data-testid="multiagent-toggle" onClick={toggleMultiAgent}
                      disabled={multiAgentBusy || busy}
                      title={multiAgentCopy.toggleHint || ''}
                      onAnimationEnd={(event) => {
                        if (event.animationName === 'pinvou-ultra-reveal') setMultiAgentRevealing(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2.5 text-[13px] rounded-xl ${
                        multiAgentOn
                          ? 'pinvou-ultra-row'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-black/[0.045] dark:hover:bg-white/[0.07]'
                      } ${multiAgentRevealing ? 'pinvou-ultra-row-reveal' : ''}`}>
                      <span className="flex items-center gap-2.5 min-w-0">
                        <Users size={15} className={`shrink-0 ${multiAgentOn ? 'text-current' : 'text-gray-400'}`} />
                        <span className={`truncate ${multiAgentOn ? 'font-medium' : ''}`}>{multiAgentCopy.toggleLabel || ''}</span>
                      </span>
                      <span aria-hidden="true" className={`relative shrink-0 w-8 h-[18px] rounded-full transition-colors ${multiAgentOn ? 'bg-white/30' : 'bg-black/20 dark:bg-white/25'}`}>
                        <span className={`absolute top-[2px] left-0 w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${multiAgentOn ? 'translate-x-[16px]' : 'translate-x-[2px]'}`} />
                      </span>
                    </button>
                  </>
                )}
                {canManageModels && (
                  <>
                    <div className="h-px bg-black/5 dark:bg-white/10 my-1.5 mx-2" />
                    <button type="button" onClick={() => { setOpen(false); if (onGotoSettings) onGotoSettings(); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-[#007AFF] hover:text-white rounded-xl transition-colors group">
                      <Plus size={15} className="text-gray-400 group-hover:text-white/90" />
                      {t.manageModels}
                    </button>
                  </>
                )}
          </ComposerPopover>
        </div>
      );
    };

    // 产物 HTML 预览：测内容自然尺寸，比面板宽就整体等比缩小铺满（只缩不放）。
    // 治"固定尺寸 banner 在窄预览面板里溢出、出滚动条、只露一角"。响应式整页缩放比≈1、不受影响。
    const clampPreviewScale = value => Math.max(0.1, Math.min(3, Number(value) || 1));
    const ScaledHtmlPreview = ({ html, title, onFrameLoad, onOpenExternal, zoomMode = 'auto-width', customScale = 1, onScaleChange, onCustomScaleChange }) => {
      const wrapRef = useRef(null);
      const frameRef = useRef(null);
      const naturalRef = useRef(null); // 当前 html 的内容自然尺寸缓存(在面板参考宽度下测得)
      const [box, setBox] = useState(null); // { w, h, scale }
      const [ready, setReady] = useState(false);
      const managedZoom = zoomMode !== 'auto-width';
      const canvasW = managedZoom ? 1440 : null;
      const measure = () => {
        try {
          const fr = frameRef.current, wrap = wrapRef.current;
          if (!fr || !wrap || !fr.contentWindow) return;
          const doc = fr.contentWindow.document;
          const de = doc.documentElement, bd = doc.body;
          const panelW = wrap.clientWidth;
          const panelH = wrap.clientHeight;
          // 内容自然尺寸只在面板参考宽度下测量一次并缓存；后续仅依据面板尺寸重算缩放。
          // 若把「已按自然宽度撑开的 iframe 视口」每次再喂回测量，弹层里的 vw/vh 与
          // 溢出内容（如 right:-120px 的绝对定位元素）会让 scrollWidth/scrollHeight 随 iframe
          // 被撑大而继续放大，触发 ResizeObserver 无限反馈 → 预览无限放大。
          let nat = naturalRef.current;
          if (!nat) {
            const cw = Math.max(de ? de.scrollWidth : 0, bd ? bd.scrollWidth : 0);
            const ch = Math.max(de ? de.scrollHeight : 0, bd ? bd.scrollHeight : 0);
            nat = { w: cw, h: ch };
            // iframe 内容可能尚未真正加载(scrollWidth=0 或 scrollHeight=0)：这种空测量不写入缓存，
            // 等 onLoad 后测到真实尺寸再缓存，避免把首轮空值固化导致正常页面缩放出错。
            if (cw > 0 && ch > 0) naturalRef.current = nat;
          }
          const w = managedZoom ? Math.max(canvasW, nat.w || 0) : nat.w;
          const h = nat.h;
          let scale = 1;
          if (zoomMode === 'fit') {
            const widthScale = w > 0 && panelW > 0 ? panelW / w : 1;
            const heightScale = h > 0 && panelH > 0 ? panelH / h : 1;
            scale = Math.min(widthScale, heightScale);
          } else if (zoomMode === 'custom') {
            scale = clampPreviewScale(customScale);
          } else if (zoomMode === 'fit-width' || zoomMode === 'auto-width') {
            scale = (w > panelW && w > 0) ? panelW / w : 1;
          }
          scale = clampPreviewScale(scale);
          const nextBox = { w, h, scale, panelW, panelH };
          setBox(prev => (
            prev &&
            Math.abs(prev.w - nextBox.w) < 0.5 &&
            Math.abs(prev.h - nextBox.h) < 0.5 &&
            Math.abs(prev.scale - nextBox.scale) < 0.001 &&
            Math.abs(prev.panelW - nextBox.panelW) < 0.5 &&
            Math.abs(prev.panelH - nextBox.panelH) < 0.5
              ? prev
              : nextBox
          ));
          if (onScaleChange) onScaleChange(scale);
        } catch { /* not ready/cross-origin; ignore */ }
      };
      useEffect(() => { setReady(false); setBox(null); naturalRef.current = null; }, [html]); // eslint-disable-line react-hooks/set-state-in-effect -- an html switch means a different artifact; synchronously clear measurement state
      // eslint-disable-next-line react-hooks/exhaustive-deps -- measure is an in-component closure; re-measure only when the zoom parameters change
      useEffect(() => { measure(); }, [zoomMode, customScale]);
      useEffect(() => {
        if (!wrapRef.current || typeof ResizeObserver === 'undefined') return;
        const ro = new ResizeObserver(() => measure());
        ro.observe(wrapRef.current);
        return () => ro.disconnect();
      // eslint-disable-next-line react-hooks/exhaustive-deps -- measure is an in-component closure; rebuild the observer only when the zoom parameters change
      }, [zoomMode, customScale]);
      const applyWheelZoom = deltaY => {
        const base = box ? box.scale : customScale;
        const next = clampPreviewScale(base + (deltaY < 0 ? 0.1 : -0.1));
        if (onCustomScaleChange) onCustomScaleChange(next);
      };
      const handleWheel = event => {
        if (!managedZoom || !event.ctrlKey) return;
        event.preventDefault();
        event.stopPropagation();
        applyWheelZoom(event.deltaY);
      };
      useEffect(() => {
        const fr = frameRef.current;
        if (!managedZoom || !fr || !fr.contentWindow) return;
        let doc = null;
        try {
          doc = fr.contentWindow.document;
        } catch {
          return;
        }
        if (!doc) return;
        const handleFrameWheel = event => {
          if (!event.ctrlKey) return;
          event.preventDefault();
          event.stopPropagation();
          applyWheelZoom(event.deltaY);
        };
        doc.addEventListener('wheel', handleFrameWheel, { passive: false, capture: true });
        return () => doc.removeEventListener('wheel', handleFrameWheel, { capture: true });
      // eslint-disable-next-line react-hooks/exhaustive-deps -- applyWheelZoom is an in-component closure; the box && box.scale compound expression is intentional so nothing is reattached while box is null
      }, [managedZoom, ready, box && box.scale, customScale, onCustomScaleChange]);
      useEffect(() => {
        const handlePreviewMessage = event => {
          const frameWindow = frameRef.current && frameRef.current.contentWindow;
          if (!frameWindow || event.source !== frameWindow) return;
          const url = artifactPreviewExternalUrlFromMessage(event.data);
          if (url && onOpenExternal) onOpenExternal(url);
        };
        window.addEventListener('message', handlePreviewMessage);
        return () => window.removeEventListener('message', handlePreviewMessage);
      }, [onOpenExternal]);
      const scaled = box && box.scale !== 1;
      const scaledW = box ? Math.max(1, Math.ceil(box.w * box.scale)) : 0;
      const scaledH = box ? Math.max(1, Math.ceil(box.h * box.scale)) : 0;
      const stageStyle = box
        ? {
          minWidth: Math.max(box.panelW || 0, scaledW || box.w) + 'px',
          minHeight: Math.max(box.panelH || 0, scaledH || box.h) + 'px',
          display: 'flex',
          justifyContent: (zoomMode === 'fit' || zoomMode === 'custom') && scaledW <= (box.panelW || 0) ? 'center' : 'flex-start',
          alignItems: (zoomMode === 'fit' || zoomMode === 'custom') && scaledH <= (box.panelH || 0) ? 'center' : 'flex-start',
        }
        : { minWidth: '100%', minHeight: '100%' };
      const frameStyle = () => {
        if (box && scaled) {
          return { position: 'absolute', left: 0, top: 0, width: box.w + 'px', height: box.h + 'px', transform: 'scale(' + box.scale + ')', transformOrigin: 'top left', colorScheme: 'dark' };
        }
        if (managedZoom && box) return { width: box.w + 'px', height: box.h + 'px', minHeight: '480px', colorScheme: 'dark' };
        return { width: '100%', height: '100%', minHeight: '480px', colorScheme: 'dark' };
      };
      const wrapStyle = managedZoom
        ? { minHeight: 0, height: '100%', overflow: zoomMode === 'fit' ? 'hidden' : 'auto' }
        : (scaled ? { height: scaledH } : { minHeight: 480, height: '100%' });
      return (
        <div ref={wrapRef} data-testid="artifact-html-preview-scroll" onWheel={handleWheel} className="relative w-full bg-[#15171a]" style={wrapStyle}>
          {!ready && <div className="h-[480px] bg-[#15171a]"></div>}
          <div data-testid="artifact-html-preview-stage" style={managedZoom ? stageStyle : (box && scaled ? { width: scaledW + 'px', height: scaledH + 'px', position: 'relative' } : { width: '100%', height: '100%' })}>
            <div style={box && scaled ? { width: scaledW + 'px', height: scaledH + 'px', position: 'relative', flex: '0 0 auto' } : (managedZoom && box ? { width: box.w + 'px', height: box.h + 'px', flex: '0 0 auto' } : { width: '100%', height: '100%' })}>
              <iframe ref={frameRef} sandbox="allow-same-origin allow-scripts" title={title || 'Artifact preview'} data-testid="artifact-html-preview-frame" onLoad={() => { measure(); if (onFrameLoad) { onFrameLoad(frameRef.current); } setTimeout(() => setReady(true), 80); }}
                className={`border-0 block bg-[#15171a] transition-opacity duration-300 ${ready ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'}`}
                data-zoom-mode={zoomMode}
                data-zoom-scale={box ? String(box.scale) : ''}
                style={frameStyle()}
                srcDoc={buildArtifactPreviewDocument(html)} />
            </div>
          </div>
        </div>
      );
    };

    const CONNECTOR_VISUALS = new Map(
      [...tsToolsData, ...tsToolWelcomeData]
        .filter(tool => tool.backendId)
        .map(tool => [tool.backendId, tool]),
    );

    function connectorVisual(row) {
      const preset = CONNECTOR_VISUALS.get(row.id);
      return {
        icon: preset?.icon || Server,
        color: preset?.color || 'bg-gradient-to-b from-slate-400 to-slate-600',
        // 上传插件的包内图标优先；内置连接器回退共享品牌资产。两者均按原图
        // 渲染，不加 grayscale/filter，和能力中心保持一致。
        logoSrc: row.icon_data_url || THIRD_PARTY_TOOL_LOGOS[row.id] || null,
      };
    }

    const CapabilityMiniAvatar = ({ row, kind }) => {
      if (kind === 'connectors') {
        return (
          <TsToolIcon
            tool={row.visual || connectorVisual(row)}
            title={row.title}
            data-tool-icon={row.id}
            className="h-6 w-6 shrink-0 rounded-full border-2 border-white shadow-sm dark:border-[#161618]"
            imageClassName="h-4 w-4"
            fallbackSize={13}
            fallbackStrokeWidth={2}
          />
        );
      }
      return (
        <span
          title={row.title}
          className="relative flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-gradient-to-br from-[#AF7BFF] to-[#7847D9] text-white shadow-sm dark:border-[#161618]"
        >
          <Sparkles size={13} strokeWidth={2} />
        </span>
      );
    };

    const CapabilityAvatarTrigger = ({ buttonRef, kind, preview, label, testId, open, disabled, onClick }) => (
      <button
        ref={buttonRef}
        type="button"
        data-testid={testId}
        data-capability-kind={kind}
        aria-label={label}
        aria-expanded={open}
        disabled={disabled}
        title={label + (preview.total > 0 ? ' · ' + preview.total : '')}
        onClick={onClick}
        className="flex h-9 shrink-0 items-center rounded-full px-1.5 transition-colors hover:bg-black/5 disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent dark:hover:bg-white/10 dark:disabled:hover:bg-transparent"
      >
        <span className="flex -space-x-1.5">
          {preview.rows.length > 0
            ? preview.rows.map(row => <CapabilityMiniAvatar key={`${kind}:${row.id}`} row={row} kind={kind} />)
            : (
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-black/15 text-gray-400 dark:border-white/20 dark:text-gray-500">
                {kind === 'connectors' ? <Wrench size={13} /> : <Sparkles size={13} />}
              </span>
            )}
          {preview.overflow > 0 && (
            <span className="relative flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-white bg-[#EEF1F5] px-1 text-[10px] font-bold text-[#5F6368] shadow-sm dark:border-[#161618] dark:bg-[#34363A] dark:text-[#DADCE0]">
              +{preview.overflow}
            </span>
          )}
        </span>
      </button>
    );

    // 输入框底栏:工具菜单(只展示已装工具 + 跳工具商店;无会话级开关——后端无此概念)。
    // 可选触发器变体：triggerVariant='pill' 时触发器渲染为代码页配置组同款 pill
    //（triggerLabel 为可选 10px 前缀文案；triggerTestId 覆盖默认 testid），
    // capability-groups 仅展示连接器头像；原生代码 pill 保留完整工具/技能菜单。
    const ComposerToolMenu = ({ t, onGotoTools, compact, activeSkill, triggerVariant, triggerLabel, triggerTestId, scope, activeSessionId: activeSessionIdProp, busy = false }) => {
      const [open, setOpen] = useState(false);
      const triggerRef = useRef(null);
      const connectorTriggerRef = useRef(null);
      const refreshSequence = useRef(0);
      const savingToolRef = useRef(false);
      const [savingTool, setSavingTool] = useState(false);
      const [toolSaveError, setToolSaveError] = useState(false);
      const [toolLoadError, setToolLoadError] = useState(false);
      const canMutateToolStore = can('toolStoreMutations');
      // 代码会话保持只增不减：有活动会话时只阻隔「关闭」——已进入上下文的
      // 工具撤不回。普通聊天支持热刷能力目录与工具规则，因此允许随时开关。
      // 代码 scope 的「打开」是未提交态：发送新一轮对话前可改回（误开可撤销），
      // 新一轮被后端受理（pinvou:chat-round-committed）后才真正进入上下文并锁死。
      // scope='code'（原生代码车道）时由调用方传入该车道的活动会话 id——显式会话态
      // 驱动，绕开 bridge 聊天 active 绑定（二轮评审：code 门控不得读聊天域
      // activeSessionId）；plain 缺省沿用聊天侧。
      // 无权限才全局禁用；会话中的「关闭」阻隔是逐行判断（只有已开 = enabled 才禁）。
      // 当前轮次的模型工具表与技能目录已经提交，执行中修改无法追回本轮。
      // 处理完成后恢复开关，变更从下一轮起生效。
      const toolSwitchDisabled = !canMutateToolStore || busy || savingTool;
      // scope: 'code' = 原生代码会话(独立开关,默认全关),缺省 = 普通会话(plain)。
      const toolScope = scope === 'code' ? 'code' : 'plain';
      const removalLocked = toolScope === 'code' && !!activeSessionIdProp;
      const [marketplaceTools, setMarketplaceTools] = useState([]);
      const [marketplaceSkills, setMarketplaceSkills] = useState([]);
      const [disabled, setDisabled] = useState(() => new Set()); // 被关掉的包 id(开关 off，按 scope 持久)
      const [hidden, setHidden] = useState(() => new Set()); // 被不可见的包 id(可见性预过滤，按 scope 持久)
      const [projectSkillsEnabled, setProjectSkillsEnabled] = useState(false); // 项目级 skills(仅 code scope 生效)
      const [projectSkillsHelp, setProjectSkillsHelp] = useState(false); // 项目技能帮助弹窗(功能说明+扫描目录)
      // 启动时加载已装工具 + 全局持久的禁用列表(持久语义:新窗口/新对话都继承)
      const refreshToolsMenu = useCallback(async (isMounted) => {
        if (savingToolRef.current) return;
        const sequence = ++refreshSequence.current;
        const isAlive = () => isMounted() && sequence === refreshSequence.current;
        const [tools, dis, hid, skills, proj] = await Promise.allSettled([
          invokeTauri('list_composer_connectors'),
          invokeTauri('get_disabled_connectors', { scope: toolScope }),
          invokeTauri('get_bundle_visibility', { scope: toolScope }),
          invokeTauri('list_marketplace_skills'),
          invokeTauri('get_project_skills_enabled'),
        ]);
        if (!isAlive()) return;
        // 同一轮连接状态、开关和可见性一起发布，避免混用新旧结果短暂亮起头像。
        const loaded = [tools, dis, hid].every(result => result.status === 'fulfilled');
        setToolLoadError(!loaded);
        if (loaded) {
          setMarketplaceTools(Array.isArray(tools.value) ? tools.value : []);
          setDisabled(new Set(dis.value || []));
          setHidden(new Set(hid.value || []));
        }
        if (skills.status === 'fulfilled') setMarketplaceSkills(Array.isArray(skills.value) ? skills.value : []);
        if (proj.status === 'fulfilled') setProjectSkillsEnabled(!!proj.value);
      }, [toolScope]);
      useEffect(() => {
        let alive = true;
        const isAlive = () => alive;
        const onChanged = () => refreshToolsMenu(isAlive);
        refreshToolsMenu(isAlive); // eslint-disable-line react-hooks/set-state-in-effect -- fetch the tools menu on mount; refreshToolsMenu is async and its setState happens after the await
        window.addEventListener('pinvou:tools-changed', onChanged);
        window.addEventListener('focus', onChanged);
        return () => { alive = false; window.removeEventListener('pinvou:tools-changed', onChanged); window.removeEventListener('focus', onChanged); };
      }, [refreshToolsMenu]);
      useEffect(() => {
        if (!open) return;
        let alive = true;
        refreshToolsMenu(() => alive); // eslint-disable-line react-hooks/set-state-in-effect -- reopening queries the external store; state updates only occur after Promise.allSettled resolves
        return () => { alive = false; };
      }, [open, refreshToolsMenu]);
      // 新一轮对话已被后端受理 → 本 scope 未提交的「打开」已由文件头的模块级
      // 监听清空（组件不在场也清）。此处仅 bump 版本号触发重渲染刷新开关禁用
      // 态；模块级监听先注册先执行，保证先清后刷。
      const [, bumpPendingVersion] = useReducer(c => c + 1, 0);
      useEffect(() => {
        const onCommitted = (event) => {
          const committedScope = event && event.detail && event.detail.scope;
          if ((committedScope === 'code' ? 'code' : 'plain') !== toolScope) return;
          bumpPendingVersion();
        };
        window.addEventListener('pinvou:chat-round-committed', onCommitted);
        return () => window.removeEventListener('pinvou:chat-round-committed', onCommitted);
      }, [toolScope]);
      // 项目技能帮助弹窗 Esc 关闭（与项目其他 modal 惯例一致，仅弹窗打开时挂监听）
      useEffect(() => {
        if (!projectSkillsHelp) return;
        const onKey = event => { if (event.key === 'Escape') setProjectSkillsHelp(false); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [projectSkillsHelp]);
      async function toggleTool(id, enabled) {
        const pending = pendingEnablesFor(toolScope);
        if (savingToolRef.current || toolSwitchDisabled || (removalLocked && enabled && !pending.ids.has(id))) return;
        const next = new Set(disabled);
        next.has(id) ? next.delete(id) : next.add(id);
        const wasPending = pending.ids.has(id);
        const revision = pending.revision;
        // Record before awaiting: a Code turn may be accepted while saving.
        if (enabled) pending.ids.delete(id); else pending.ids.add(id);
        savingToolRef.current = true;
        refreshSequence.current += 1; // 保存开始后，旧的刷新结果不能覆盖本次开关。
        setSavingTool(true);
        setToolSaveError(false);
        try {
          if (bridge.available) await invokeTauri('set_disabled_connectors', { connectorIds: [...next], scope: toolScope });
          setDisabled(next);
        } catch {
          // Do not revive pending permissions consumed by an intervening turn.
          if (pending.revision === revision) {
            if (wasPending) pending.ids.add(id); else pending.ids.delete(id);
          }
          setToolSaveError(true);
        } finally {
          savingToolRef.current = false;
          setSavingTool(false);
          window.dispatchEvent(new Event('pinvou:tools-changed'));
        }
      }
      function toggleProjectSkills() {
        // 与 toggleTool 同一规则：pending 的「打开」在发送新一轮前可改回。
        const pending = pendingEnablesFor(toolScope);
        if (toolSwitchDisabled || (removalLocked && projectSkillsEnabled && !pending.projectSkills)) return;
        const next = !projectSkillsEnabled;
        setProjectSkillsEnabled(next);
        pending.projectSkills = next;
        if (bridge.available) {
          invokeTauri('set_project_skills_enabled', { enabled: next }).catch(() => {});
        }
      }
      const menuState = buildComposerToolMenuState({
        marketplaceTools: marketplaceTools.map(tool => ({
          ...tool,
          visual: connectorVisual(tool),
          name: t.uiToolDetails?.tools?.[tool.id]?.title || tool.name,
        })),
        marketplaceSkills,
        disabledIds: [...disabled],
        hiddenIds: [...hidden],
        activeSkill,
        scope: toolScope,
      });
      const { connectorRows, connectorPreview, skillRows, enabledCount, allSkillsDisabled } = menuState;
      // 内置技能名称/描述由 composer-tool-menu-logic.js 数据提供，在 UI 边界按当前语言覆盖
      const localizedSkillRows = skillRows.map(row => (row.kind === 'builtin-skill' && row.skillId === 'visual-design')
        ? { ...row, title: t.uiSettingsView.visualDesignSkillName, description: t.uiSettingsView.visualDesignSkillDesc }
        : row);
      const avatarGroups = triggerVariant === 'capability-groups';
      const showConnectors = true;
      const showSkills = !avatarGroups;
      const statusBadge = (label, tone = 'green') => {
        const cls = tone === 'blue'
          ? 'text-[#007AFF] dark:text-[#5AC8FA] bg-[#007AFF]/10 dark:bg-[#0A84FF]/15'
          : 'text-[#34C759] bg-[#34C759]/10';
        return <span className={`shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold ${cls} px-2 py-0.5 rounded-full leading-none`}><span className={`w-1.5 h-1.5 rounded-full ${tone === 'blue' ? 'bg-[#007AFF] dark:bg-[#5AC8FA]' : 'bg-[#34C759]'}`} />{label}</span>;
      };
      const switchRow = (row) => {
        const isConnector = row.kind === 'tool' || row.kind === 'service';
        const needsConnection = isConnector && !row.connected;
        // 未提交的「打开」（pending）不锁：发送新一轮前允许改回。
        const rowDisabled = toolSwitchDisabled
          || (removalLocked && row.enabled && !pendingEnablesFor(toolScope).ids.has(row.id));
        return (
        <div key={row.id} data-connector-id={isConnector ? row.id : undefined} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl font-medium">
          <span className="min-w-0 flex items-center gap-1.5">
            {isConnector && (
              <TsToolIcon
                tool={row.visual || connectorVisual(row)}
                data-tool-icon={row.id}
                className="h-5 w-5 shrink-0 rounded-[6px]"
                imageClassName="h-3.5 w-3.5"
                fallbackSize={12}
                fallbackStrokeWidth={2}
              />
            )}
            <span className="block text-[13px] text-gray-700 dark:text-gray-200 truncate">{row.title}</span>
            {row.available && statusBadge(t.composerConnected, 'green')}
            {isConnector && !row.available && <span className="shrink-0 text-[10px] text-gray-400 dark:text-gray-500">{needsConnection ? t.composerNeedsConnection : t.composerConnectorOff}</span>}
          </span>
          {needsConnection ? (
            <button type="button" disabled={!canMutateToolStore || busy || savingTool} aria-label={t.composerConnectNamed(row.title)} title={t.composerConnectHint}
              onClick={() => { setOpen(false); onGotoTools?.(); }}
              className="shrink-0 rounded-lg px-1.5 py-1 text-[12px] text-[#007AFF] hover:bg-[#007AFF]/10 disabled:opacity-45 dark:text-[#5AC8FA]">
              {t.composerGoConnect}
            </button>
          ) : <Toggle checked={isConnector ? row.available : row.enabled} onChange={() => toggleTool(row.id, row.enabled)} aria-label={row.id} disabled={rowDisabled} size="sm" />}
        </div>
        );
      };
      const readonlyRow = (row, label, tone = 'green') => (
        <div key={row.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl font-medium">
          <span className="min-w-0">
            <span className="block text-[13px] text-gray-700 dark:text-gray-200 truncate">{row.title}</span>
          </span>
          {statusBadge(label, tone)}
        </div>
      );
      // 权限只读开关：显示开关状态（受静态表控制），但不可手动切换；保留「内置」标识。
      const readonlySwitchRow = (row) => (
        <div key={row.id} className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl font-medium">
          <span className="min-w-0 flex items-center gap-1.5">
            <span className="block text-[13px] text-gray-700 dark:text-gray-200 truncate">{row.title}</span>
            {statusBadge(row.active ? t.composerSkillInUse : t.composerBuiltinAuto, row.active ? 'green' : 'blue')}
          </span>
          <button type="button" disabled aria-label={row.id} title={t.composerReadonlySwitch}
            className={`relative inline-flex h-5 w-[34px] shrink-0 items-center rounded-full transition-colors cursor-not-allowed bg-[#34C759]/60`}>
            <span className="inline-block h-4 w-4 rounded-full bg-white shadow translate-x-[16px]" />
          </button>
        </div>
      );
      return (
        <div className="relative shrink-0">
          {avatarGroups ? (
            <div ref={triggerRef} className="flex items-center" data-testid="composer-capability-groups">
              <CapabilityAvatarTrigger
                buttonRef={connectorTriggerRef}
                kind="connectors"
                preview={connectorPreview}
                label={t.composerConnectors}
                testId={triggerTestId || 'composer-tool-menu-trigger'}
                open={open}
                disabled={busy}
                onClick={() => setOpen(current => !current)}
              />
            </div>
          ) : triggerVariant === 'pill' ? (
            <button
              ref={triggerRef}
              type="button"
              data-testid={triggerTestId || 'composer-tool-menu-trigger'}
              onClick={() => setOpen(o => !o)}
              disabled={busy}
              title={t.composerTools}
              aria-expanded={open}
              className="inline-flex h-8 min-w-0 max-w-[220px] items-center gap-1.5 overflow-hidden rounded-xl border px-2.5 transition-all cursor-pointer hover:-translate-y-px hover:shadow-sm disabled:cursor-default disabled:opacity-45 disabled:hover:translate-y-0 disabled:hover:shadow-none focus-within:border-[#007AFF]/45 focus-within:ring-2 focus-within:ring-[#007AFF]/10 border-black/[0.07] bg-black/[0.025] text-[#1F1F1F] dark:border-white/[0.09] dark:bg-white/[0.055] dark:text-[#E8EAED]"
            >
              {triggerLabel && (
                <span className="pointer-events-none shrink-0 text-[10px] font-medium text-gray-400 dark:text-gray-500">
                  {triggerLabel}
                </span>
              )}
              <span className="pointer-events-none min-w-0 truncate text-[11px] font-semibold">
                {t.composerTools}
              </span>
              {enabledCount > 0 && (
                <span className="min-w-4 h-4 rounded-full bg-[#007AFF] px-1 text-center text-[10px] font-bold leading-4 text-white shrink-0">{enabledCount}</span>
              )}
              <ChevronDown
                size={12}
                aria-hidden="true"
                className={`pointer-events-none ml-auto shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
              />
            </button>
          ) : (
          <button type="button" ref={triggerRef} data-testid={triggerTestId || 'composer-tool-menu-trigger'} onClick={() => setOpen(o => !o)} disabled={busy} title={t.composerTools}
            className={`relative shrink-0 flex items-center justify-center text-gray-700 disabled:cursor-default disabled:opacity-45 dark:text-gray-200 transition-colors border ${compact ? 'w-9 h-9 rounded-full bg-transparent hover:bg-black/5 disabled:hover:bg-transparent dark:hover:bg-white/10 dark:disabled:hover:bg-transparent border-transparent' : 'h-8 gap-1.5 rounded-[12px] px-2.5 text-[12px] font-semibold whitespace-nowrap bg-black/[0.045] dark:bg-white/[0.055] hover:bg-black/[0.07] disabled:hover:bg-black/[0.045] dark:hover:bg-white/[0.09] dark:disabled:hover:bg-white/[0.055] border-black/[0.045] dark:border-white/[0.06]'}`}>
            <Wrench size={compact ? 18 : 13} className="opacity-80" />
            {!compact && t.composerTools}
            {enabledCount > 0 && (compact
              ? <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-[10px] leading-4 text-center font-bold bg-[#007AFF] text-white rounded-full">{enabledCount}</span>
              : <span className="min-w-4 h-4 rounded-full bg-[#007AFF] px-1 text-center text-[10px] font-bold leading-4 text-white shrink-0">{enabledCount}</span>)}
            {!compact && <ChevronDown size={13} className="opacity-50 shrink-0" />}
          </button>
          )}
          <ComposerPopover open={open} onClose={() => setOpen(false)} triggerRef={triggerRef} compact={compact}
            menuProps={{ 'data-testid': 'composer-tool-menu' }}
            desktopClassName="absolute bottom-full left-0 mb-2 w-72 max-h-[420px] z-50 overflow-y-auto custom-scrollbar bg-white dark:bg-[#1E1E20] border border-black/5 dark:border-white/10 rounded-2xl shadow-xl p-1.5">
                {avatarGroups && (
                  <div className="px-3 pb-1 pt-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                    {t.composerConnectors}
                  </div>
                )}
                {toolSaveError && <div role="alert" className="px-3 py-2 text-[12px] text-red-500">{t.composerUpdateFailed}</div>}
                {toolLoadError && <div role="alert" className="px-3 py-2 text-[12px] text-red-500">{t.composerStatusRefreshFailed}</div>}
                {showConnectors && connectorRows.map(switchRow)}
                {showConnectors && connectorRows.length === 0 && (
                  <div className="px-3 py-2 text-[13px] text-gray-400 dark:text-gray-500">{t.composerNoConnectors}</div>
                )}
                {showSkills && (localizedSkillRows.length === 0 ? (
                  <div className="px-3 py-2 text-[13px] text-gray-400 dark:text-gray-500">{t.composerModeNone}</div>
                ) : (
                  <>
                    {localizedSkillRows.map(row => row.switchable
                      ? switchRow(row)
                      : row.readonly
                        ? readonlySwitchRow(row)
                        : readonlyRow(row, row.active ? t.composerSkillInUse : t.composerBuiltinAuto, row.active ? 'green' : 'blue'))}
                    {/* 该 scope 全部技能被关：空态提示（组合目录为空 → 模型看不到任何技能） */}
                    {allSkillsDisabled && (
                      <div className="px-3 pt-1 pb-1 text-[11px] text-gray-400 dark:text-gray-500">{t.composerSkillAllDisabled}</div>
                    )}
                  </>
                ))}
                {toolScope === 'code' && (
                  <>
                    <div className="h-px bg-black/5 dark:bg-white/10 my-1.5 mx-2" />
                    <div className="px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0">
                          <span className="block text-[13px] text-gray-700 dark:text-gray-200 truncate">
                            {t.composerProjectSkills}
                            <button type="button" onClick={() => setProjectSkillsHelp(true)} aria-label={t.composerProjectSkillsHelpTitle}
                              className="inline-flex items-center justify-center w-[15px] h-[15px] ml-1 rounded-full text-[10px] font-semibold leading-none text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-black/5 dark:hover:bg-white/10 align-middle">?</button>
                          </span>
                          <span className="block text-[10px] text-gray-400 dark:text-gray-500">{t.composerProjectSkillsDesc}</span>
                        </span>
                        <Toggle checked={projectSkillsEnabled} onChange={toggleProjectSkills} aria-label="project-skills" disabled={toolSwitchDisabled || (removalLocked && projectSkillsEnabled && !pendingEnablesFor(toolScope).projectSkills)} size="sm" />
                      </div>
                      {projectSkillsEnabled && (
                        <div className="mt-1.5 text-[11px] leading-snug text-amber-600 dark:text-amber-400">{t.composerProjectSkillsWarning}</div>
                      )}
                    </div>
                  </>
                )}
                <div className="h-px bg-black/5 dark:bg-white/10 my-1.5 mx-2" />
                <button type="button" onClick={() => {
                  setOpen(false);
                  if (onGotoTools) onGotoTools();
                }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] text-gray-700 dark:text-gray-200 hover:bg-[#007AFF] hover:text-white rounded-xl transition-colors group">
                  {avatarGroups
                    ? <Plus size={15} className="text-gray-400 group-hover:text-white/90" />
                    : <Store size={15} className="text-gray-400 group-hover:text-white/90" />}
                  {avatarGroups ? t.composerAddConnectors : t.composerManageTools}
                </button>
          </ComposerPopover>
          {projectSkillsHelp && createPortal(
            // biome-ignore lint/a11y/useKeyWithClickEvents: background click-to-close layer; the keyboard path is covered by the dialog's top-right close button
            // biome-ignore lint/a11y/noStaticElementInteractions: background click-to-close layer; non-interactive container
            <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/45" onClick={() => setProjectSkillsHelp(false)}>
              {/* biome-ignore lint/a11y/useKeyWithClickEvents: click-bubbling stop layer; keyboard events don't need bubbling here */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: click-bubbling stop layer; non-interactive container */}
              <div onClick={e => e.stopPropagation()} className="relative w-full max-w-[380px] rounded-[22px] shadow-2xl p-5 bg-white text-[#1F1F1F] dark:bg-[#1E1F20] dark:text-[#E3E3E3]">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="text-[16px] font-semibold">{t.composerProjectSkillsHelpTitle}</div>
                  <button type="button" onClick={() => setProjectSkillsHelp(false)} className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/10"><X size={17} /></button>
                </div>
                <div className="text-[12px] leading-relaxed text-[#5F6368] dark:text-[#AEB4BC]">{t.composerProjectSkillsHelpBody}</div>
                <div className="mt-3 text-[12px] font-medium">{t.composerProjectSkillsHelpDirsLabel}</div>
                <div className="mt-1.5 rounded-[14px] border p-3 border-black/10 bg-[#F8F9FA] dark:border-white/10 dark:bg-white/[0.035]">
                  {String(t.composerProjectSkillsHelpDirs).split('\n').map((dir, i) => (
                    <div key={dir} className="flex items-center gap-2 text-[11px] font-mono text-gray-600 dark:text-gray-300 py-0.5">
                      <span className="text-[10px] text-gray-400 dark:text-gray-500">{i + 1}</span>{dir}
                    </div>
                  ))}
                </div>
                <div className="mt-3 text-[11px] leading-snug text-amber-600 dark:text-amber-400">{t.composerProjectSkillsWarning}</div>
              </div>
            </div>,
            document.body
          )}
        </div>
      );
    };

export { ComposerModelSelector, ScaledHtmlPreview, ComposerToolMenu };
