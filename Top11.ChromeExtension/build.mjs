// Збірка:
//   node build.mjs            — dist/ (оболонка + вбудований код у dist/payload)
//   node build.mjs --watch    — те саме з перезбиранням
//   node build.mjs --publish  — + підписаний payload.json і копія dist у ../Top11.Web/ext (сайт роздає як /ext/code/*)
import * as esbuild from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, watch as fsWatch } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { execSync } from 'node:child_process';

const watch = process.argv.includes('--watch');
const publish = process.argv.includes('--publish');
const BUILD_FILE = '.build-number';
const PAYLOAD_FILES = ['inject.js', 'viewer.js', 'viewer.html'];
const SITE_EXT = '../Top11.Web/ext';
const time = () => new Date().toLocaleTimeString();

function nextBuild() {
  const n = (existsSync(BUILD_FILE) ? Number(readFileSync(BUILD_FILE, 'utf8')) || 0 : 0) + 1;
  writeFileSync(BUILD_FILE, String(n));
  return n % 65536;
}

/** dist/manifest.json "0.7.0" -> "0.7.0.N"; dist/payload/payload.json з версією коду 1.0.N і хешами */
function finish() {
  const n = nextBuild();
  const manifest = JSON.parse(readFileSync('static/manifest.json', 'utf8'));
  const base = String(manifest.version).split('.').slice(0, 3).join('.');
  manifest.version = `${base}.${n}`;
  writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));

  const files = {};
  for (const f of PAYLOAD_FILES) files[f] = createHash('sha256').update(readFileSync(`dist/payload/${f}`)).digest('base64');
  const payload = { version: `1.0.${n}`, built: new Date().toISOString(), files };
  writeFileSync('dist/payload/payload.json', JSON.stringify(payload, null, 2));
  console.log(`[${time()}] build: shell ${manifest.version}, code ${payload.version}`);
  if (publish) sign(payload).catch(e => { console.error(`[${time()}] publish FAILED: ${e.message}`); process.exitCode = 1; });
}

/** Підпис ECDSA P-256 приватним ключем із .keys (scripts/keygen.mjs) і викладка на сайт */
const BW_ITEM = 'Top11 extension signing key';
const KEY_FILE = '.keys/payload-private.jwk';

/** Приватний ключ: змінна T11_SIGNING_KEY -> Bitwarden CLI (нотатка BW_ITEM) -> файл .keys */
function loadSigningKey() {
  if (process.env.T11_SIGNING_KEY) return { jwk: JSON.parse(process.env.T11_SIGNING_KEY), from: 'T11_SIGNING_KEY' };
  try {
    const out = execSync(`bw get notes "${BW_ITEM}"`, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    if (out.startsWith('{')) return { jwk: JSON.parse(out), from: 'Bitwarden' };
  } catch (e) {
    const msg = String(e.stderr || e.message || '').trim().split('\n')[0];
    console.log(`[${time()}] Bitwarden CLI not available (${msg || 'bw not found'}), trying ${KEY_FILE}`);
  }
  if (existsSync(KEY_FILE)) return { jwk: JSON.parse(readFileSync(KEY_FILE, 'utf8')), from: KEY_FILE };
  throw new Error(`No signing key: set T11_SIGNING_KEY, unlock Bitwarden CLI (BW_SESSION) or put ${KEY_FILE}`);
}

async function sign(payload) {
  const { jwk, from } = loadSigningKey();
  console.log(`[${time()}] signing key: ${from}`);
  payload.shell = publishShell();
  const key = await webcrypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const text = JSON.stringify(payload);
  const sig = Buffer.from(await webcrypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, Buffer.from(text))).toString('base64');

  // На сайті: ext/payload.json (підписаний) + ext/shell/** — точна копія dist (оболонка + код у shell/payload/)
  for (const e of existsSync(SITE_EXT) ? readdirSync(SITE_EXT) : []) {
    if (e !== 'shell.json') rmSync(`${SITE_EXT}/${e}`, { recursive: true, force: true }); // старе: shell/, версії, zip
  }
  mkdirSync(SITE_EXT, { recursive: true });
  cpSync('dist', `${SITE_EXT}/shell`, { recursive: true });
  writeFileSync(`${SITE_EXT}/payload.json`, JSON.stringify({ manifest: text, sig }));
  console.log(`[${time()}] published code ${payload.version}, shell ${payload.shell.latest} -> ${SITE_EXT}`);
}

// ---------- оболонка (те, що люди ставлять папкою) ----------

function listFiles(dir, rel = '') {
  const out = [];
  for (const e of readdirSync(`${dir}/${rel}`, { withFileTypes: true })) {
    const p = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...listFiles(dir, p));
    else out.push(p);
  }
  return out.sort();
}

/** Хеш зібраної оболонки: усе з dist, крім payload/ і номера збірки в manifest.json */
function shellHash() {
  const h = createHash('sha256');
  for (const f of listFiles('dist')) {
    if (f.startsWith('payload/')) continue;
    h.update(f + '\0');
    if (f === 'manifest.json') {
      const m = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
      delete m.version;
      h.update(JSON.stringify(m));
    } else h.update(readFileSync(`dist/${f}`));
  }
  return h.digest('base64');
}

/**
 * Оболонка змінилась з минулої публікації -> нова версія (у людей зʼявиться банер «Оновити розширення»).
 * Не змінилась -> лишаємо стару версію в manifest.json, щоб у людей не було «оновлень» без змін.
 * Повертає { latest, min, files }: files — sha256 усіх файлів dist (для запису в папку людини).
 */
function publishShell() {
  const prevFile = `${SITE_EXT}/shell.json`;
  const prev = existsSync(prevFile) ? JSON.parse(readFileSync(prevFile, 'utf8')) : null;
  const hash = shellHash();
  const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
  let shell;
  if (!prev || prev.hash !== hash) {
    shell = { version: manifest.version, hash, published: new Date().toISOString() };
    console.log(`[${time()}] SHELL CHANGED -> ${shell.version}: after deploy users will see the 'update extension' banner`);
  } else {
    shell = prev;
    manifest.version = prev.version;
    writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2));
    console.log(`[${time()}] shell unchanged (${prev.version}): users need no update`);
  }
  mkdirSync(SITE_EXT, { recursive: true });
  writeFileSync(prevFile, JSON.stringify(shell, null, 2));
  const files = {};
  for (const f of listFiles('dist')) files[f] = createHash('sha256').update(readFileSync(`dist/${f}`)).digest('base64');
  return { latest: shell.version, min: shell.version, files };
}

function copyStatic() {
  cpSync('static', 'dist', { recursive: true });
}

let pending = 0;
const donePlugin = {
  name: 'done',
  setup(build) {
    build.onEnd(result => {
      if (result.errors.length) return;
      if (--pending <= 0) { pending = 0; finish(); }
    });
  },
};

rmSync('dist', { recursive: true, force: true });
mkdirSync('dist/payload', { recursive: true });
copyStatic();

const common = { bundle: true, format: 'iife', target: 'chrome120', logLevel: 'info', plugins: [donePlugin] };
const shell = await esbuild.context({
  ...common,
  entryPoints: {
    background: 'src/background/background.ts',
    bridge: 'src/content/bridge.ts',
    host: 'src/shell/host.ts',
    'app-boot': 'src/shell/app-boot.ts',
  },
  outdir: 'dist',
  sourcemap: 'inline',
});
const payload = await esbuild.context({
  ...common,
  entryPoints: { inject: 'src/content/inject.ts', viewer: 'src/viewer/viewer.ts' },
  outdir: 'dist/payload',
  minify: publish,
  sourcemap: false,
});

if (watch) {
  pending = 2;
  await shell.watch();
  await payload.watch();
  let t;
  fsWatch('static', { recursive: true }, () => {
    clearTimeout(t);
    t = setTimeout(() => { copyStatic(); finish(); }, 100);
  });
  console.log('watching src/ and static/ ...');
} else {
  pending = 2;
  await shell.rebuild();
  await payload.rebuild();
  await shell.dispose();
  await payload.dispose();
}
