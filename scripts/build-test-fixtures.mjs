import { build } from 'esbuild';
await build({ entryPoints: ['tests/browser/fixtures/turbo-bootstrap.js'], bundle: true, format: 'esm', target: 'es2022', outfile: 'tests/browser/fixtures/generated/turbo.js' });
