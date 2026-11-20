import { gzipSync } from 'node:zlib';
import { defineConfig, type Plugin } from 'vite';

const kB = (bytes: number) => `${(bytes / 1000).toFixed(1)} kB`;

/**
 * Writes the gzipped size of the zip321 chunk and of the JavaScript needed on first load
 * into the footer (`<!--bundle-size-->` in index.html). Dev builds leave the placeholder empty.
 */
function bundleSizeNote(): Plugin {
  return {
    name: 'bundle-size-note',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        const bundle = ctx.bundle;
        const gzipped = (fileName: string) => {
          const file = bundle[fileName];
          return file?.type === 'chunk' ? gzipSync(file.code, { level: 9 }).length : 0;
        };
        // First load = entry chunks and everything they import statically.
        const initialFiles = new Set<string>();
        const visit = (fileName: string) => {
          const file = bundle[fileName];
          if (file?.type !== 'chunk' || initialFiles.has(fileName)) return;
          initialFiles.add(fileName);
          file.imports.forEach(visit);
        };
        let library = 0;
        for (const [fileName, file] of Object.entries(bundle)) {
          if (file.type !== 'chunk') continue;
          if (file.isEntry) visit(fileName);
          if (file.name === 'zip321') library = gzipped(fileName);
        }
        let initial = 0;
        for (const fileName of initialFiles) initial += gzipped(fileName);
        const note = `zip321 is ${kB(library)} gzipped; this page needs ${kB(initial)} of JavaScript to start, and the QR code libraries load on demand.`;
        return html.replace('<!--bundle-size-->', note);
      },
    },
  };
}

export default defineConfig({
  // Relative asset URLs, so the build works at any path (e.g. GitHub Pages /zip321-playground/).
  base: './',
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        // Keep the library in its own chunk so its size can be reported on the page.
        codeSplitting: {
          groups: [{ name: 'zip321', test: /[\\/]node_modules[\\/]zcash-zip321[\\/]/ }],
        },
      },
    },
  },
  plugins: [bundleSizeNote()],
});
