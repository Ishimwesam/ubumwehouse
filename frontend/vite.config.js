import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return

          if (id.includes('react-big-calendar') || id.includes('/moment/')) {
            return 'calendar-vendor'
          }

          if (id.includes('jspdf')) {
            return 'jspdf-vendor'
          }

          if (id.includes('html2canvas')) {
            return 'html2canvas-vendor'
          }

          if (id.includes('chart.js') || id.includes('react-chartjs-2')) {
            return 'chart-vendor'
          }

          if (id.includes('react-router-dom')) {
            return 'router-vendor'
          }

          if (id.includes('react') || id.includes('react-dom')) {
            return 'react-vendor'
          }

          return 'vendor'
        }
      }
    }
  },
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:5003',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://localhost:5003',
        changeOrigin: true,
      }
    }
  }
})
