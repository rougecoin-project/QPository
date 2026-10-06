import { build } from 'esbuild';
await build({entryPoints:['src/app.mjs'],bundle:true,format:'esm',platform:'browser',outfile:'dist/app.js',minify:true,sourcemap:false});
console.log('QPository browser application built');
