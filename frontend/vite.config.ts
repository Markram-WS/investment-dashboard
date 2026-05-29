import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
    host: '0.0.0.0',
    port: 5173,
    warmup: {
      clientFiles: ['./src/main.tsx', './src/App.tsx', './src/components/Navigation.tsx', './src/pages/PortfolioOverview.tsx'],
    },
  },
})
