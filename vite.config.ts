import { defineConfig, type Plugin } from 'vite';

function renameIndexHtmlPlugin(newName: string): Plugin {
  return {
    name: 'rename-index-html',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const indexHtml = bundle['index.html'];
      if (indexHtml) {
        indexHtml.fileName = newName;
      }
    },
  };
}

export default defineConfig({
  plugins: [renameIndexHtmlPlugin('mk-stinger.html')],
  server: {
    port: 5173,
    open: false,
  },
  build: {
    target: 'es2022',
  },
});
