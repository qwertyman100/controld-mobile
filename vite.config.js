import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Build stamp in Pacific time (America/Los_Angeles) → "YYYY-MM-DD HH:mm PDT/PST".
const buildStamp = (() => {
  const now = new Date()
  const t = now.toLocaleString('sv-SE', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  const zone = now
    .toLocaleTimeString('en-US', { timeZone: 'America/Los_Angeles', timeZoneName: 'short' })
    .split(' ')
    .pop()
  return `${t} ${zone}`
})()

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Build stamp (Pacific time) shown in Settings > About so you can see which
  // bundle is actually running.
  define: {
    __BUILD_STAMP__: JSON.stringify(buildStamp),
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
