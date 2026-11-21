import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminMenuComponent } from './menu.component';
import {coreTestProviders} from '@testing/test-providers';

describe('AdminMenuComponent', () => {
  let component: AdminMenuComponent;
  let fixture: ComponentFixture<AdminMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminMenuComponent],
      providers: coreTestProviders
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('range les pages d’administration en quatre groupes avec une image du site, une icône et une description', () => {
    const element: HTMLElement = fixture.nativeElement;
    const titles = Array.from(element.querySelectorAll('.admin-group-title')).map((title) => title.textContent?.trim());
    expect(titles).toEqual(['Communauté', 'Activités', 'Contenu', 'Données']);

    const links = Array.from(element.querySelectorAll('a.admin-card')) as HTMLAnchorElement[];
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      '/icy/admin/members',
      '/icy/admin/recrutement',
      '/icy/admin/operations',
      '/icy/admin/events',
      '/icy/admin/goals',
      '/icy/admin/sc-world-events',
      '/icy/admin/news',
      '/icy/admin/guides',
      '/icy/admin/icelinkBuilder',
      '/icy/admin/data'
    ]);
    for (const link of links) {
      expect(link.querySelector('.admin-card-icon svg')).toBeTruthy();
      expect(link.querySelector('.admin-card-description')?.textContent?.trim()).toBeTruthy();
      expect(link.querySelector('img')?.getAttribute('src')).toMatch(/^assets\/images\//);
    }
  });
});
