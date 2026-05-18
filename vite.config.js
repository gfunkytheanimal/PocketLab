import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    chunkSizeWarningLimit: 2600,
    rollupOptions: {
      input: {
        pocketlab: resolve(__dirname, 'index.html'),
        blackhole: resolve(__dirname, 'blackhole.html'),
        vacuum: resolve(__dirname, 'vacuum.html')
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three-nebula') || id.includes('node_modules/@babel/runtime') || id.includes('node_modules/lodash') || id.includes('node_modules/uuid') || id.includes('node_modules/potpack')) return 'vendor-nebula';
          if (id.includes('node_modules/three')) return 'vendor-three';
        }
      }
    }
  }
});
