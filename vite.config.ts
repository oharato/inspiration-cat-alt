import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    target: 'es2022',
    rolldownOptions: {
      output: {
        assetFileNames: (assetInfo: { name?: string }) => {
          if (assetInfo.name?.endsWith('.wasm')) return 'wasm/[name][extname]';
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  optimizeDeps: {
    exclude: ['@huggingface/transformers'],
  },
});
