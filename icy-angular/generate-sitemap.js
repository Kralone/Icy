const fs = require('node:fs');
const path = require('node:path');

const site = 'https://iceforge.fr';
const today = new Date().toISOString().split('T')[0];
// Public, indexable routes from src/app/app.routes.ts.
// Excluded intentionally: /login, /icy/**, /** (not-found).
const routes = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/recrutement', changefreq: 'weekly', priority: '0.9' },

  { path: '/guides/minage-star-citizen', changefreq: 'weekly', priority: '0.9' },
  { path: '/guides/salvage', changefreq: 'weekly', priority: '0.8' },
  { path: '/guides/minage/confirmed', changefreq: 'monthly', priority: '0.6' },
  { path: '/guides/hathor', changefreq: 'weekly', priority: '0.9' },

  { path: '/utilitaires', changefreq: 'weekly', priority: '0.7' },
  { path: '/utilitaires/executive-hangar', changefreq: 'weekly', priority: '0.7' },
  { path: '/utilitaires/executive-hangar-maps', changefreq: 'weekly', priority: '0.7' },
  { path: '/utilitaires/wikelo', changefreq: 'weekly', priority: '0.7' },
  { path: '/utilitaires/achat-vaisseaux', changefreq: 'weekly', priority: '0.7' },
  { path: '/utilitaires/ressources-minage', changefreq: 'weekly', priority: '0.8' },
  { path: '/utilitaires/guides', changefreq: 'monthly', priority: '0.6' }
];

const items = routes
  .map((route) => {
    const loc = route.path === '/' ? `${site}/` : `${site}${route.path}`;
    return [
      '  <url>',
      `    <loc>${loc}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      `    <changefreq>${route.changefreq}</changefreq>`,
      `    <priority>${route.priority}</priority>`,
      '  </url>'
    ].join('\n');
  })
  .join('\n');

const xml = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  items,
  '</urlset>',
  ''
].join('\n');

const outputPath = path.join(__dirname, 'public', 'sitemap.xml');
fs.writeFileSync(outputPath, xml, 'utf8');
console.log(`sitemap generated: ${outputPath}`);
