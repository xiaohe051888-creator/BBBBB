import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 生产构建：相对路径，适配 Docker 静态文件托管
  base: './',
  // 开发服务器代理（避免跨域）
  server: {
    port: 5173,
    host: '0.0.0.0', // 允许所有 IP 访问
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
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'antd-vendor': ['antd', '@ant-design/icons'],
          'query-vendor': ['@tanstack/react-query', 'axios'],
          'utils-vendor': ['dayjs']
        }
      }
    }
  }
})
