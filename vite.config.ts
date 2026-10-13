import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { readMenuHandler } from './server/readMenu'

const BASE = '/lexi-move-menu-order/'

export default defineConfig(({ mode }) => {
  // '' prefix: load every var, but only into this Node process.
  // Nothing here is exposed to the client bundle.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env } as Record<string, string>

  return {
    plugins: [
      react(),
      {
        name: 'read-menu',
        configureServer(server) {
          server.middlewares.use(`${BASE}api/read-menu`, readMenuHandler(env))
        },
      },
    ],
    base: BASE,
  }
})
