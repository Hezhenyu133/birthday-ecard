import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, './src')
    }
  },
  server: {
    host: '0.0.0.0', // 允许外部访问
    port: 5173, // 前端开发服务器端口（不能与后端 3000 冲突）
    open: true, // 自动打开浏览器
    cors: true, // 允许跨域
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        secure: false
      },
      '/uploads': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/template-previews': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/card': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/music': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/videos': {
        target: 'http://localhost:3000',
        changeOrigin: true
      },
      '/logo': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        // 分包策略
        manualChunks: {
          vendor: ['vue', 'vue-router', 'pinia'],
          elementPlus: ['element-plus'],
          axios: ['axios']
        },
        chunkFileNames: 'static/js/[name]-[hash].js',
        entryFileNames: 'static/js/[name]-[hash].js',
        assetFileNames: 'static/[ext]/[name]-[hash].[ext]'
      }
    }
  }
})