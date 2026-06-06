import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Get API URL from environment
const API_BASE_URL = process.env.BACKEND_API_BASE_URL || 'http://localhost:8000';

export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.BACKEND_API_BASE_URL': JSON.stringify(
      process.env.BACKEND_API_BASE_URL || 'http://localhost:8000'
    ),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', '@tanstack/react-query'],
    force: true,
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      // Proxy API calls to backend service
      '/api': {
        target: API_BASE_URL,
        changeOrigin: true,
        secure: false,
      },
    },
    warmup: {
      clientFiles: ['./src/main.tsx', './src/App.tsx', './src/components/Navigation.tsx', './src/pages/PortfolioOverview.tsx'],
    },
  },
})
