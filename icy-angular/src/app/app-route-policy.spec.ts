import { canonicalPrerenderRoutes, isKnownAppRoute, resolveCanonicalRedirect } from './app-route-policy';

describe('SSR route policy', () => {
  it('prerenders canonical guide URLs instead of legacy aliases', () => {
    expect(canonicalPrerenderRoutes).toContain('guides/minage-star-citizen');
    expect(canonicalPrerenderRoutes).toContain('guides/salvage');
    expect(canonicalPrerenderRoutes).not.toContain('guide/minage');
    expect(canonicalPrerenderRoutes).not.toContain('guide/salvage');
  });

  it('recognizes public, protected and admin application routes', () => {
    expect(isKnownAppRoute('/guides/hathor?source=test')).toBe(true);
    expect(isKnownAppRoute('/utilitaires/wikelo/')).toBe(true);
    expect(isKnownAppRoute('/icy/outils/ressources-minage')).toBe(true);
    expect(isKnownAppRoute('/icy/admin/goals')).toBe(true);
    expect(isKnownAppRoute('/definitely-not-a-route')).toBe(false);
    expect(isKnownAppRoute('/guides/also-not-a-route')).toBe(false);
  });

  it('maps every legacy guide URL to its canonical destination', () => {
    expect(resolveCanonicalRedirect('/guide/minage?utm_source=legacy')).toBe('/guides/minage-star-citizen');
    expect(resolveCanonicalRedirect('/guide/salvage')).toBe('/guides/salvage');
    expect(resolveCanonicalRedirect('/guides/minage/ressources')).toBe('/utilitaires/ressources-minage');
    expect(resolveCanonicalRedirect('/guides/hathor')).toBeUndefined();
  });
});
