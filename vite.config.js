import {defineConfig} from 'vite';
export default defineConfig({optimizeDeps:{entries:['index.html']},build:{rollupOptions:{output:{manualChunks:{pdfjs:['pdfjs-dist'],pdfedit:['pdf-lib']}}}}});
