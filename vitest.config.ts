import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      siyuan: resolve(__dirname, 'scripts/stubs/siyuan.ts'),
      'foliate-js': resolve(__dirname, 'node_modules/foliate-js'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['scripts/**/*.test.ts', 'src/**/*.test.ts'],
  },
})
