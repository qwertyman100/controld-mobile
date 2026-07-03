import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
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
