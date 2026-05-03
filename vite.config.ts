import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: {
    allowedHosts: ['localhost', 'manju.limitlesstech-co.com'],
    host: true,
    port: 5173,
  },
  plugins: [
    tailwindcss(),
  ],
})