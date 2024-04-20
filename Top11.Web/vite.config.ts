import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import vueJsx from '@vitejs/plugin-vue-jsx';
import VueDevTools from 'vite-plugin-vue-devtools';

export default defineConfig({
    plugins: [
        vue(),
        vueJsx(),
        VueDevTools(),
    ],
    resolve: {
        alias: {
        '@': fileURLToPath(new URL('./Assets', import.meta.url))
        }
    },
    appType: 'custom',
  root: 'ClientApp',
    build: {
        manifest: true,
        outDir: '../dist',
        emptyOutDir: true,
        assetsDir: '',
        rollupOptions: {
            input: {
            main: 'ClientApp/main.ts',
            },
            output: {
                entryFileNames: '[name].js',
                chunkFileNames: '[name].js',
                assetFileNames: '[name].[ext]'
            }
        },
    },
    server: {
        port: 5173,
        strictPort: true,
        hmr: {
            clientPort: 5173
        }
    }
});