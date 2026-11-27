#!/usr/bin/env node
// Rapatrie les images d'autres sites écrites en dur dans le code du frontend.
//
//   node mirror-code-images.mjs            liste seulement : rien n'est téléchargé ni modifié
//   node mirror-code-images.mjs --apply    télécharge dans public/assets/images/external/ et remplace les liens
//
// Relançable : manifest.json garde la correspondance lien d'origine -> fichier local, une image déjà
// copiée n'est pas retéléchargée et un lien déjà remplacé n'est plus trouvé.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('.', import.meta.url).pathname;
const SRC = join(ROOT, 'src');
const OUT_DIR = join(ROOT, 'public/assets/images/external');
const PUBLIC_PREFIX = '/assets/images/external/';
const MANIFEST = join(OUT_DIR, 'manifest.json');
const apply = process.argv.includes('--apply');

// Sites qui ne servent pas d'images (flux RSS, liens cliquables, exemples) : jamais téléchargés.
const NOT_IMAGES = [/\/comm-link\/rss/, /^https:\/\/media\.starcitizen\.tools\/?$/, /…/];
const IMAGE_URL = /https?:\/\/(?!(?:www\.)?iceforge\.fr\b)[^\s"'`()<>]+?\.(?:png|jpe?g|gif|webp|avif)(?:[?@][^\s"'`()<>]*)?(?=["'`)\s])/gi;
// Liens d'image sans extension finale : images redimensionnées de RSI et du wiki Fandom.
const RSI_IMAGE = /https:\/\/(?:robertsspaceindustries\.com\/i\/|static\.wikia\.nocookie\.net\/)[^\s"'`<>]+(?=["'`])/g;
const SIGNATURES = [
  ['.png', b => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47],
  ['.jpg', b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff],
  ['.gif', b => b.subarray(0, 4).toString('latin1') === 'GIF8'],
  ['.webp', b => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP'],
  ['.avif', b => b.subarray(4, 8).toString('latin1') === 'ftyp'],
];

function sourceFiles(dir) {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|html|css|scss)$/.test(name) && !name.endsWith('.spec.ts') ? [path] : [];
  });
}

function findUrls(text) {
  const urls = new Set([...text.matchAll(IMAGE_URL), ...text.matchAll(RSI_IMAGE)].map(m => m[0]));
  return [...urls].filter(url => !NOT_IMAGES.some(re => re.test(url)));
}

const manifest = existsSync(MANIFEST) ? JSON.parse(readFileSync(MANIFEST, 'utf8')) : {};
const files = sourceFiles(SRC);
const found = new Map();
for (const file of files) {
  for (const url of findUrls(readFileSync(file, 'utf8'))) {
    if (!found.has(url)) found.set(url, []);
    found.get(url).push(relative(ROOT, file));
  }
}

const byHost = {};
for (const url of found.keys()) {
  const host = new URL(url).host;
  byHost[host] = (byHost[host] ?? 0) + 1;
}
console.log(`${found.size} image(s) externe(s) dans le code :`, byHost);
for (const [url, where] of found) {
  console.log(`${manifest[url] ? 'copiée ' : 'externe'}  ${url}\n         ${[...new Set(where)].join(', ')}`);
}
if (!apply) {
  console.log('\nListe seulement. Relancer avec --apply pour télécharger et remplacer les liens.');
  process.exit(0);
}

mkdirSync(OUT_DIR, { recursive: true });
let failed = 0;
for (const url of found.keys()) {
  if (manifest[url] && existsSync(join(OUT_DIR, manifest[url]))) continue;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'IceForge-image-import/1.0', Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`réponse HTTP ${response.status}`);
    const body = Buffer.from(await response.arrayBuffer());
    if (body.length > 20_000_000) throw new Error('image de plus de 20 Mo');
    const ext = SIGNATURES.find(([, test]) => test(body))?.[0];
    if (!ext) throw new Error("le contenu n'est pas une image acceptée");
    const name = `${new URL(url).host.replace(/[^a-z0-9.-]/gi, '')}-${createHash('sha256').update(url).digest('hex').slice(0, 12)}${ext}`;
    writeFileSync(join(OUT_DIR, name), body);
    manifest[url] = name;
    console.log(`copiée   ${url} -> ${name} (${Math.round(body.length / 1024)} Ko)`);
  } catch (error) {
    failed++;
    console.error(`ÉCHEC    ${url} : ${error.message}`);
  }
}
writeFileSync(MANIFEST, JSON.stringify(Object.fromEntries(Object.entries(manifest).sort()), null, 2) + '\n');

let replaced = 0;
for (const file of files) {
  const before = readFileSync(file, 'utf8');
  let after = before;
  // Les liens les plus longs d'abord, pour qu'un lien ne soit jamais remplacé à l'intérieur d'un autre.
  for (const url of [...found.keys()].sort((a, b) => b.length - a.length)) {
    if (manifest[url]) after = after.split(url).join(PUBLIC_PREFIX + manifest[url]);
  }
  if (after !== before) {
    writeFileSync(file, after);
    replaced++;
  }
}
console.log(`\n${replaced} fichier(s) modifié(s), ${failed} image(s) en échec (lien d'origine gardé).`);
process.exit(failed ? 1 : 0);
