import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        '/api/opencode': {
          target: 'https://opencode.ai/inference/openai',
          changeOrigin: true,
          headers: env.OPENCODE_API_KEY ? { Authorization: `Bearer ${env.OPENCODE_API_KEY}` } : {},
          rewrite: (path) => path.replace(/^\/api\/opencode/, ''),
        },
        '/api/openrouter': {
          target: 'https://openrouter.ai',
          changeOrigin: true,
          headers: env.OPENROUTER_API_KEY ? { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` } : {},
          rewrite: (path) => path.replace(/^\/api\/openrouter/, ''),
        },
      },
    },
    preview: {
      proxy: {
        '/api/opencode': {
          target: 'https://opencode.ai/inference/openai',
          changeOrigin: true,
          headers: env.OPENCODE_API_KEY ? { Authorization: `Bearer ${env.OPENCODE_API_KEY}` } : {},
          rewrite: (path) => path.replace(/^\/api\/opencode/, ''),
        },
        '/api/openrouter': {
          target: 'https://openrouter.ai',
          changeOrigin: true,
          headers: env.OPENROUTER_API_KEY ? { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` } : {},
          rewrite: (path) => path.replace(/^\/api\/openrouter/, ''),
        },
      },
    },
  }
})
