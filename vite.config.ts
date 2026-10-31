import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api/opencode': {
        target: 'https://opencode.ai/inference/openai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/opencode/, ''),
      },
      '/api/openrouter': {
        target: 'https://openrouter.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openrouter/, ''),
      },
    },
  },
  preview: {
    proxy: {
      '/api/opencode': {
        target: 'https://opencode.ai/inference/openai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/opencode/, ''),
      },
      '/api/openrouter': {
        target: 'https://openrouter.ai',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/openrouter/, ''),
      },
    },
  },
})
