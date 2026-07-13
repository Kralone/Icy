import { Inject, Injectable, DOCUMENT } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRoute, NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

interface SeoRouteData {
  title?: string;
  description?: string;
  robots?: string;
  image?: string;
}

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly siteUrl = 'https://iceforge.fr';
  private readonly defaultSeo: Required<SeoRouteData> = {
    title: 'IceForge Industries | Corporation Star Citizen FR',
    description: 'IceForge Industries est une corporation Star Citizen FR.',
    robots: 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1',
    image: 'https://iceforge.fr/assets/icons/icon-512x512.png'
  };

  constructor(
    private readonly router: Router,
    private readonly activatedRoute: ActivatedRoute,
    private readonly title: Title,
    private readonly meta: Meta,
    @Inject(DOCUMENT) private readonly document: Document
  ) {}

  init(): void {
    this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        const seo = this.resolveSeoData();
        const currentUrl = this.normalizeUrl(this.router.url);

        this.title.setTitle(seo.title);
        this.meta.updateTag({ name: 'description', content: seo.description });
        this.meta.updateTag({ name: 'robots', content: seo.robots });
        this.meta.updateTag({ property: 'og:title', content: seo.title });
        this.meta.updateTag({ property: 'og:description', content: seo.description });
        this.meta.updateTag({ property: 'og:image', content: seo.image });
        this.meta.updateTag({ property: 'og:url', content: currentUrl });
        this.meta.updateTag({ name: 'twitter:title', content: seo.title });
        this.meta.updateTag({ name: 'twitter:description', content: seo.description });
        this.meta.updateTag({ name: 'twitter:image', content: seo.image });
        this.meta.updateTag({ name: 'twitter:url', content: currentUrl });
        this.updateCanonical(currentUrl);
      });
  }

  private resolveSeoData(): Required<SeoRouteData> {
    const merged: SeoRouteData = {};
    let current: ActivatedRoute | null = this.activatedRoute.root;

    while (current) {
      const data = current.snapshot.data?.['seo'] as SeoRouteData | undefined;
      if (data) {
        Object.assign(merged, data);
      }
      current = current.firstChild;
    }

    return {
      title: merged.title || this.defaultSeo.title,
      description: merged.description || this.defaultSeo.description,
      robots: merged.robots || this.defaultSeo.robots,
      image: merged.image || this.defaultSeo.image
    };
  }

  private normalizeUrl(path: string): string {
    const [cleanPath] = path.split('?');
    if (!cleanPath || cleanPath === '/') return `${this.siteUrl}/`;
    return `${this.siteUrl}${cleanPath}`;
  }

  private updateCanonical(url: string): void {
    let link = this.document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }
}
