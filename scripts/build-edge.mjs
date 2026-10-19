import { build } from 'esbuild';
await build({entryPoints:['edge/index.ts'],bundle:true,format:'esm',platform:'neutral',target:'es2022',outfile:'supabase/functions/monoral-api/index.ts',minify:true});
