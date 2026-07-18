import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import packageJson from './package.json'

export default defineConfig({
  base: './',
  define: { __APP_VERSION__: JSON.stringify(packageJson.version) },
  plugins: [react()],
  server: { port: 5173 },
})
