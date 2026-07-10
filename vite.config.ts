import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the build runs from any subpath (it's embedded on the
  // portfolio site under /play/orbital-mechanics/).
  base: './',
  server: { port: 5175 },
});
