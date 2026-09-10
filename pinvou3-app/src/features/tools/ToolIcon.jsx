const FULL_TILE_LOGOS = new Set([
  'assets/tool-icons/amap-user-v3.png',
  'assets/tool-icons/dingtalk-user-v2.png',
  'assets/tool-icons/iwencai-user-v3.png',
  'assets/tool-icons/qcc-user.png',
  'assets/tool-icons/wb-ima-mcp.png',
  'assets/tool-icons/wb-tencent-meeting.png',
  'assets/tool-icons/wb-yuandian-mcp.svg',
  'assets/tool-icons/wecom-user.png',
]);

const CROPPED_TILE_LOGOS = new Set(['assets/tool-icons/wb-yuandian-mcp.svg']);

// Capability Center cards and composer connector controls share this renderer.
// Keep logo cropping and vector fallbacks identical across both surfaces.
const TsToolIcon = ({ tool, title, className = '', imageClassName = 'h-8 w-8', fallbackSize = 30, fallbackStrokeWidth = 1.5, children, ...rootProps }) => {
  const Icon = tool.icon;
  const isFullTileLogo = tool.logoSrc && FULL_TILE_LOGOS.has(tool.logoSrc);
  const cropTileLogo = tool.logoSrc && CROPPED_TILE_LOGOS.has(tool.logoSrc);
  const logoBg = tool.logoSrc ? (isFullTileLogo ? 'bg-transparent' : 'bg-white dark:bg-white') : '';
  const logoFg = tool.logoSrc ? 'text-slate-900' : `${tool.color || 'bg-gradient-to-b from-slate-400 to-slate-600'} text-white`;
  const logoBox = tool.logoSrc ? `${logoBg} ${logoFg}` : logoFg;
  return (
    <span {...rootProps} title={title} className={`relative flex items-center justify-center overflow-hidden ${logoBox} ${className}`}>
      {tool.logoSrc ? (
        <img
          src={tool.logoSrc}
          alt=""
          className={isFullTileLogo ? `h-full w-full rounded-[inherit] object-cover ${cropTileLogo ? 'scale-[1.22]' : ''}` : `object-contain ${imageClassName}`}
          loading="lazy"
        />
      ) : Icon ? (
        <Icon size={fallbackSize} strokeWidth={fallbackStrokeWidth} />
      ) : null}
      {children}
    </span>
  );
};

export { TsToolIcon };
