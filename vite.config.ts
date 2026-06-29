import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(process.env.GOOGLE_MAPS_PLATFORM_KEY || '')
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    build: {
      rollupOptions: {
        output: {
          // Split heavy vendors into focused chunks so no single chunk dominates
          // the initial load (Firestore is the largest Firebase module).
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('firebase/firestore') || id.includes('@firebase/firestore')) return 'fb-firestore';
            if (id.includes('firebase/auth') || id.includes('@firebase/auth')) return 'fb-auth';
            if (id.includes('firebase/storage') || id.includes('@firebase/storage')) return 'fb-storage';
            if (id.includes('firebase') || id.includes('@firebase') || id.includes('@grpc') || id.includes('protobufjs') || id.includes('idb')) return 'fb-core';
            if (id.includes('@vis.gl/react-google-maps')) return 'maps';
            if (id.includes('motion')) return 'motion';
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react-vendor';
            return undefined;
          },
        },
      },
    },
  };
});
