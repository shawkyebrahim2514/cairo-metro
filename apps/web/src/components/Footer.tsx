import { useI18n } from '../i18n';
import { reportUrl } from '../report';

export function Footer() {
  const { t, lang } = useI18n();
  return (
    <footer>
      <a
        href={reportUrl(lang)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => {
          // refresh so the link carries the current route
          e.currentTarget.href = reportUrl(lang);
        }}
      >
        {t('reportProblem')}
      </a>
      <small>{t('attribution')}</small>
    </footer>
  );
}
