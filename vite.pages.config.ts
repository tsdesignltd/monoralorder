import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
export default defineConfig({root:resolve('pages-site'),base:'/monoralorder/',publicDir:resolve('public'),plugins:[react()],build:{outDir:resolve('dist-pages'),emptyOutDir:true}});
