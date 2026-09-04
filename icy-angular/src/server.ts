import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine, isMainModule } from '@angular/ssr/node';
import express from 'express';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bootstrap from './main.server';
import { isKnownAppRoute, resolveCanonicalRedirect } from './app/app-route-policy';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const indexHtml = join(serverDistFolder, 'index.server.html');

const app = express();
const defaultAllowedHosts = ['iceforge.fr', 'www.iceforge.fr', 'localhost', '127.0.0.1'];
const allowedHosts = (process.env['NG_ALLOWED_HOSTS'] || defaultAllowedHosts.join(','))
  .split(',')
  .map((host) => host.trim())
  .filter(Boolean);
const commonEngine = new CommonEngine({ allowedHosts });

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/**', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.get('/{*splat}', (req, res, next) => {
  const destination = resolveCanonicalRedirect(req.originalUrl);
  if (!destination) {
    next();
    return;
  }

  const queryIndex = req.originalUrl.indexOf('?');
  const query = queryIndex >= 0 ? req.originalUrl.slice(queryIndex) : '';
  res.redirect(308, `${destination}${query}`);
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: 'index.html',
    // Avoid implicit 301 "/route" -> "/route/" from static directories.
    // Let Angular SSR answer app routes directly.
    redirect: false
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.get('/{*splat}', (req, res, next) => {
  const { protocol, originalUrl, baseUrl, headers } = req;
  const isKnownRoute = isKnownAppRoute(originalUrl);

  commonEngine
    .render({
      bootstrap,
      documentFilePath: indexHtml,
      url: `${protocol}://${headers.host}${originalUrl}`,
      publicPath: browserDistFolder,
      providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
    })
    .then((html) => res.status(isKnownRoute ? 200 : 404).send(html))
    .catch((err) => next(err));
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the host and port defined by `HOST` and `PORT`.
 */
if (isMainModule(import.meta.url)) {
  const host = process.env['HOST'] || '127.0.0.1';
  const port = Number.parseInt(process.env['PORT'] || '4000', 10);
  app.listen(port, host, () => {
    console.log(`Node Express server listening on http://${host}:${port}`);
  });
}

export default app;
