import { RenderMode, ServerRoute } from '@angular/ssr';
import { canonicalPrerenderRoutes } from './app-route-policy';

export const serverRoutes: ServerRoute[] = [
  ...canonicalPrerenderRoutes.map((path): ServerRoute => ({ path, renderMode: RenderMode.Prerender })),
  {
    // Private member area relies on browser storage for JWT.
    // Rendering this area on the server causes auth mismatch/flicker on refresh.
    path: 'icy/**',
    renderMode: RenderMode.Client
  },
  {
    path: '**',
    renderMode: RenderMode.Server
  }
];
