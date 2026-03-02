import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'recrutement',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'guide/minage',
    renderMode: RenderMode.Prerender
  },
  {
    path: 'guide/salvage',
    renderMode: RenderMode.Prerender
  },
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
