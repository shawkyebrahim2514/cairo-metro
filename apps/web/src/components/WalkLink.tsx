import type { LatLng } from '@cairo-metro/core';
import { useI18n } from '../i18n';
import { isIos } from '../pwa';
import { walkLink } from '../walkLink';
import { Icon } from './Icon';

/** Opens a street-by-street walking route in the user's maps app. */
export function WalkLink({ from, to }: { from: LatLng; to: LatLng }) {
  const { t } = useI18n();
  return (
    <a
      className="pill walk-link"
      href={walkLink(from, to, isIos())}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
    >
      <Icon name="walk" size={16} /> {t('walkOpenMaps')}
    </a>
  );
}
