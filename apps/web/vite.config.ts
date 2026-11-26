import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Stamps dist/sw.js with the exact emitted asset list and a build hash so deploys cleanly bust caches. */
function swVersionPlugin(): Plugin {
  let outDir = 'dist';
  let assets: string[] = [];
  return {
    name: 'sw-version',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    generateBundle(_options, bundle) {
      assets = Object.keys(bundle)
        .filter((f) => f !== 'sw.js' && f !== 'index.html' && !f.endsWith('.map'))
        .sort();
    },
    closeBundle() {
      const swPath = resolve(outDir, 'sw.js');
      let src: string;
      try {
        src = readFileSync(swPath, 'utf8');
      } catch {
        return;
      }
      const hash = createHash('sha256').update(assets.join('\n')).digest('hex').slice(0, 10);
      const stamped = src
        .replace("const VERSION = 'dev';", `const VERSION = '${hash}';`)
        .replace('const ASSETS = [];', `const ASSETS = ${JSON.stringify(assets)};`);
      writeFileSync(swPath, stamped);
    },
  };
}

export default defineConfig({
  // Relative asset paths let the app be hosted under any sub-path (e.g. GitHub Pages).
  base: './',
  plugins: [react(), swVersionPlugin()],
});
