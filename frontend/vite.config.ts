import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 必须使用绝对路径，否则多级前端路由（如 /admin/logs）会导致资源请求变成 /admin/assets/xxx
  base: '/',
  // 开发服务器代理（避免跨域）
  server: {
    port: 5173,
    host: '0.0.0.0', // 允许所有 IP 访问
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'react-vendor';
            if (id.includes('antd') || id.includes('@ant-design')) return 'antd-vendor';
            if (id.includes('@tanstack') || id.includes('axios')) return 'query-vendor';
            return 'vendor';
          }
        }
      }
    }
  }
})
