import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  root: __dirname,
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: false,
      manifest: {
        name: 'Pocket Claude',
        short_name: 'Claude',
        description: 'Chat with Claude Code on your Mac',
        theme_color: '#141413',
        background_color: '#141413',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: { globPatterns: ['**/*.{js,css,html,png,svg}'] },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': 'http://127.0.0.1:7878',
      '/ws': { target: 'ws://127.0.0.1:7878', ws: true },
    },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
