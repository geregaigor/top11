import * as esbuild from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, watch as fsWatch } from 'node:fs';

const watch = process.argv.includes('--watch');
const BUILD_FILE = '.build-number';
const time = () => new Date().toLocaleTimeString();

/** static/manifest.json "0.1.0" -> dist/manifest.json "0.1.0.N", N інкрементується на кожну збірку. */
function writeManifest() {
  const n = (existsSync(BUILD_FILE) ? Number(readFileSync(BUILD_FILE, 'utf8')) || 0 : 0) + 1;
  writeFileSync(BUILD_FILE, String(n));
  const manifest = JSON.parse(readFileSync('static/manifest.json', 'utf8'));
  const base = String(manifest.version).split('.').slice(0, 3).join('.');
  manifest.version = `${base}.${n % 65536}`;
  writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
  console.log(`[${time()}] build ${manifest.version}`);
}

function copyStatic() {
  cpSync('static', 'dist', { recursive: true });
}

const versionPlugin = {
  name: 'version',
  setup(build) {
    build.onEnd(result => { if (!result.errors.length) writeManifest(); });
  },
};

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist', { recursive: true });
copyStatic();

const ctx = await esbuild.context({
  entryPoints: {
    inject: 'src/content/inject.ts',
    bridge: 'src/content/bridge.ts',
    background: 'src/background/background.ts',
    viewer: 'src/viewer/viewer.ts',
  },
  outdir: 'dist',
  bundle: true,
  format: 'iife',
  target: 'chrome120',
  sourcemap: 'inline',
  logLevel: 'info',
  plugins: [versionPlugin],
});

if (watch) {
  await ctx.watch();
  let t;
  fsWatch('static', { recursive: true }, () => {
    clearTimeout(t);
    t = setTimeout(() => { copyStatic(); writeManifest(); }, 100);
  });
  console.log('watching src/ and static/ ...');
} else {
  await ctx.rebuild();
  await ctx.dispose();
}
