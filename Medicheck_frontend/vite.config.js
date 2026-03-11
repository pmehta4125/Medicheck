import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const proxyWithCorsBypass = {
  target: 'http://localhost:8080',
  changeOrigin: true,
  secure: false,
  configure: (proxy) => {
    proxy.on('proxyReq', (proxyReq) => {
      proxyReq.removeHeader('origin')
    })
  },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5173,
    strictPort: true,
    proxy: {
      '/analyze': proxyWithCorsBypass,
      '/auth': proxyWithCorsBypass,
    }
  }
})

