import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Build stamp baked in at build/dev-start time (UTC "YYYY-MM-DD HH:mm"), shown in
  // Settings > About so you can see which bundle is actually running.
  define: {
    __BUILD_STAMP__: JSON.stringify(
      new Date().toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
    ),
  },
  test: {
    // jsdom = a simulated browser DOM so component tests can render + query React.
    // Pure-function tests are unaffected (jsdom is a superset of the node env).
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://api.controld.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: true,
      },
    },
  },
})
