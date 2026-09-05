export function utilityRouteFor(currentUrl: string, path = ''): string {
  const base = currentUrl.startsWith('/icy/outils') ? '/icy/outils' : '/utilitaires';
  return path ? `${base}/${path}` : base;
}
