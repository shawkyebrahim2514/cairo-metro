import { useI18n } from '../i18n';
import { Icon } from './Icon';
import { isInAppBrowser, isIos, useInstall } from '../pwa';

/** Dismissible card that explains how to install the app on this phone. */
export function InstallCard() {
  const { t } = useI18n();
  const { canShow, canPrompt, install, dismiss } = useInstall();
  if (!canShow) return null;

  let hint: string | null = null;
  if (isInAppBrowser()) hint = t('installInApp');
  else if (!canPrompt) hint = isIos() ? t('installIos') : t('installAndroid');

  return (
    <aside className="install-card" aria-label={t('installTitle')}>
      <button type="button" className="shared-x" aria-label={t('close')} onClick={dismiss}>
        <Icon name="close" size={16} />
      </button>
      <img src="./icon-192.png" alt="" width="44" height="44" />
      <div className="install-text">
        <b>{t('installTitle')}</b>
        <span>{t('installBody')}</span>
        {hint && <span className="install-hint">{hint}</span>}
      </div>
      {canPrompt && (
        <button type="button" className="pill primary" onClick={() => void install()}>
          {t('installButton')}
        </button>
      )}
    </aside>
  );
}
