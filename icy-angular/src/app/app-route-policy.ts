/** Routes that can be rendered at build time without a member session. */
export const canonicalPrerenderRoutes = [
  '',
  'recrutement',
  'guides/minage-star-citizen',
  'guides/salvage'
] as const;

const knownRoutes = new Set([
  '/',
  '/login',
  '/recrutement',
  '/guides/minage-star-citizen',
  '/guides/salvage',
  '/guides/minage/confirmed',
  '/guides/hathor',
  '/utilitaires',
  '/utilitaires/collection',
  '/utilitaires/executive-hangar',
  '/utilitaires/executive-hangar-players',
  '/utilitaires/executive-hangar-maps',
  '/utilitaires/wikelo',
  '/utilitaires/achat-vaisseaux',
  '/utilitaires/ressources-minage',
  '/utilitaires/fiches-minage',
  '/utilitaires/guides',
  '/icy',
  '/icy/dashboard',
  '/icy/profile',
  '/icy/scwe',
  '/icy/hangar',
  '/icy/fleet',
  '/icy/events',
  '/icy/goals',
  '/icy/collection',
  '/icy/admin',
  '/icy/admin/members',
  '/icy/admin/collections',
  '/icy/admin/events',
  '/icy/admin/sc-world-events',
  '/icy/admin/ships',
  '/icy/admin/items',
  '/icy/admin/data',
  '/icy/admin/planets',
  '/icy/admin/stations',
  '/icy/admin/recrutement',
  '/icy/admin/news',
  '/icy/admin/icelinkBuilder',
  '/icy/admin/images',
  '/icy/admin/uex-cache',
  '/icy/admin/catalog',
  '/icy/admin/cig-watch',
  '/icy/admin/ore-locations',
  '/icy/admin/goals',
  '/icy/admin/orbit-spinner-maker'
]);

const canonicalRedirects = new Map<string, string>([
  ['/guides/minage', '/guides/minage-star-citizen'],
  ['/guides/minage/ressources', '/utilitaires/ressources-minage'],
  ['/guides', '/guides/minage-star-citizen'],
  ['/guide', '/guides/minage-star-citizen'],
  ['/guide/minage', '/guides/minage-star-citizen'],
  ['/guide-minage-star-citizen', '/guides/minage-star-citizen'],
  ['/guide/salvage', '/guides/salvage'],
  ['/guide/hathor', '/guides/hathor'],
  ['/guide/avance', '/guides/minage/confirmed'],
  ['/guide/ressources', '/utilitaires/ressources-minage']
]);

function normalizePath(url: string): string {
  const path = (url.split('?')[0] || '/').replace(/\/+$/, '');
  return path || '/';
}

export function isKnownAppRoute(url: string): boolean {
  const path = normalizePath(url);
  return knownRoutes.has(path) || canonicalRedirects.has(path);
}

export function resolveCanonicalRedirect(url: string): string | undefined {
  return canonicalRedirects.get(normalizePath(url));
}
