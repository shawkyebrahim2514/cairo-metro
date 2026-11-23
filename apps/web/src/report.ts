const REPO = 'https://github.com/shawkyebrahim2514/cairo-metro';

// Opens a prefilled GitHub issue. Nothing is sent anywhere until the user submits it on GitHub.
export function reportUrl(lang: string): string {
  const body = [
    '**What is wrong?** (wrong station name, time, fare, missing place, ...)',
    '',
    '',
    '---',
    `Page: ${location.href}`,
    `Language: ${lang}`,
    `Device: ${navigator.userAgent}`,
  ].join('\n');
  const q = new URLSearchParams({ title: 'Report: ', body, labels: 'data' });
  return `${REPO}/issues/new?${q.toString()}`;
}
