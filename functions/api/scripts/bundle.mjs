// Bundles the Express app + @vt/shared + npm deps into a single file so the
// Catalyst function folder deploys without workspace symlinks.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/app.js'],
  outfile: 'dist/app.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  sourcemap: true,
  // The Catalyst runtime provides the SDK; keep it external so it uses the
  // function's own package.json dependency.
  external: ['zcatalyst-sdk-node'],
  logLevel: 'info',
});
