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
    path: '**',
    renderMode: RenderMode.Server
  }
];
