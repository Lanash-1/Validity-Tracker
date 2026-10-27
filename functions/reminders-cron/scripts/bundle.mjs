import { build } from 'esbuild';

await build({
  entryPoints: ['src/handler.js'],
  outfile: 'dist/handler.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  external: ['zcatalyst-sdk-node'],
  logLevel: 'info',
});
