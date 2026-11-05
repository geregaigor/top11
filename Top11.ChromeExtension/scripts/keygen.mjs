// Одноразово: пара ключів для підпису коду, що роздається з сайту.
// Приватний -> .keys/payload-private.jwk (НЕ комітити), публічний -> src/shell/pubkey.ts (вшивається в пакет).
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
const { subtle } = globalThis.crypto;

if (existsSync('.keys/payload-private.jwk') && !process.argv.includes('--force')) {
  console.error('Key already exists (.keys/payload-private.jwk). Regenerate: node scripts/keygen.mjs --force (installed extensions will stop accepting updates).');
  process.exit(1);
}
const kp = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const priv = await subtle.exportKey('jwk', kp.privateKey);
const pub = await subtle.exportKey('jwk', kp.publicKey);
mkdirSync('.keys', { recursive: true });
writeFileSync('.keys/payload-private.jwk', JSON.stringify(priv));
writeFileSync('src/shell/pubkey.ts',
  `// Згенеровано scripts/keygen.mjs. Публічний ключ для перевірки коду з сайту.\nexport const PUBLIC_KEY_JWK: JsonWebKey = ${JSON.stringify({ kty: pub.kty, crv: pub.crv, x: pub.x, y: pub.y })};\n`);
console.log('OK: .keys/payload-private.jwk + src/shell/pubkey.ts');
