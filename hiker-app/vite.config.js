import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    viteSingleFile(),
    {
      name: 'embed-json-data',
      transformIndexHtml(html) {
        const jsonFiles = ['trails.json', 'trail_details.json', 'lookup.json', 'schedule.json'];
        const injections = [];

        jsonFiles.forEach(file => {
          try {
            const filePath = resolve(process.cwd(), 'public', 'data', file);
            const data = readFileSync(filePath, 'utf-8');
            
            injections.push({
              tag: 'script',
              attrs: { type: 'application/json', 'data-name': file },
              children: data,
              injectTo: 'head'
            });
          } catch (err) {
            console.warn(`Could not embed ${file}:`, err.message);
          }
        });

        // Add loader script at end
        injections.push({
          tag: 'script',
          children: `
(function() {
  window.__EMBEDDED_DATA__ = {};
  document.querySelectorAll('script[type="application/json"]').forEach(function(el) {
    var name = el.getAttribute('data-name').replace('.json', '').replace(/-/g, '_');
    try {
      window.__EMBEDDED_DATA__[name] = JSON.parse(el.textContent);
    } catch(e) {
      console.error('Failed to parse embedded JSON:', name, e);
    }
  });
})();`,
          injectTo: 'head'
        });

        return injections;
      }
    }
  ],
})
