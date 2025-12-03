import { defineConfig } from 'vite';

export default defineConfig({
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      name: 'worker',
      fileName: () => 'index.js'
    },
    rollupOptions: {
      output: {
        format: 'es'
      }
    }
  }
});
