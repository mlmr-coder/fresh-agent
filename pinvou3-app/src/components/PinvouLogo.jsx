import { resolveAppAssetUrl } from '../shared/asset-url.mjs';
import { BRAND_ICON_PATH } from '../shared/brand.js';

const PINVOU_BRAND_BLUE_URL = resolveAppAssetUrl(BRAND_ICON_PATH);

export function PinvouLogo({ className = 'h-4 w-4', title }) {
  return (
    <img
      src={PINVOU_BRAND_BLUE_URL}
      alt={title || ''}
      aria-hidden={title ? undefined : true}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}
