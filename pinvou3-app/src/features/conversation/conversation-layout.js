// 工作/设计/代码会话共用同一条桌面内容列。正文、临时提示与输入框必须使用
// 相同宽度，避免宽屏上正文很窄、输入框又是另一套边界。
const CONVERSATION_MAX_WIDTH = 1160;
const CONVERSATION_COLUMN_CLASS = 'w-full max-w-[1160px] mx-auto';

// 工作页是工作 / 设计 / 代码三种模式的输入框视觉基准。这里集中维护容器、
// 正文输入区和底栏，避免代码页再次长出一套独立的圆角、宽度与字号。
const CONVERSATION_COMPOSER_SURFACE_CLASS = 'relative bg-white/80 dark:bg-[#161618]/85 backdrop-blur-2xl border border-black/[0.06] dark:border-white/10 rounded-[28px] shadow-lg focus-within:border-blue-400/50 dark:focus-within:border-blue-500/50 transition-colors px-4 pt-3 pb-2.5';
const CONVERSATION_COMPOSER_INPUT_CLASS = 'w-full bg-transparent resize-none outline-none text-gray-800 dark:text-gray-100 text-[16px] leading-relaxed min-h-[88px] max-h-48 overflow-y-auto hide-scrollbar placeholder:text-gray-400 dark:placeholder:text-gray-500';
const CONVERSATION_COMPOSER_FOOTER_CLASS = 'flex items-center justify-between mt-1.5 gap-2';

function conversationGutterStyle() {
  return {
    paddingInline: `clamp(16px, calc((100% - ${CONVERSATION_MAX_WIDTH}px) / 2), 160px)`,
  };
}

export {
  CONVERSATION_COLUMN_CLASS,
  CONVERSATION_COMPOSER_FOOTER_CLASS,
  CONVERSATION_COMPOSER_INPUT_CLASS,
  CONVERSATION_COMPOSER_SURFACE_CLASS,
  CONVERSATION_MAX_WIDTH,
  conversationGutterStyle,
};
