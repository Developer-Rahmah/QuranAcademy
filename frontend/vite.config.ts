import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
  build: {
    // Separate big third-party libraries into their own chunks so the
    // landing-page bundle stays tiny (better LCP on slow mobile
    // connections) and repeat visits hit the browser cache for the
    // vendor code that rarely changes.
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'supabase-vendor': ['@supabase/supabase-js'],
        },
      },
    },
    // Slightly higher per-chunk warning ceiling now that vendors are
    // split out — silences a false-positive warning on the supabase
    // bundle which is already as small as it gets.
    chunkSizeWarningLimit: 700,
  },
})
