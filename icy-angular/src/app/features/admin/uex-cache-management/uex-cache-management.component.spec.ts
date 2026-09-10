import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of, Subject, throwError} from 'rxjs';
import {vi} from 'vitest';
import {UexCacheManagementComponent} from './uex-cache-management.component';
import {UexDatasetService} from '../../../core/services/uex/uex-dataset.service';

describe('UexCacheManagementComponent conflict recovery', () => {
  it('retries only the failed read and prevents concurrent reads', async () => {
    const retry = new Subject<any>();
    const service = {
      listDatasets: vi.fn(() => of({data: []})),
      getCurrentCatalogSync: vi.fn(() => of({data: {id: 7, status: 'WAITING_FOR_REVIEW', operation: 'SCRAPE_ALL'}})),
      getCatalogConflicts: vi.fn().mockReturnValueOnce(throwError(() => new Error('network'))).mockReturnValue(retry),
      scrapeAllCatalogSources: vi.fn(),
      scrapeAndMapCatalogScope: vi.fn(),
      resolveCatalogConflict: vi.fn()
    };
    await TestBed.configureTestingModule({imports: [UexCacheManagementComponent], providers: [provideRouter([]), {provide: UexDatasetService, useValue: service}]}).compileComponents();
    const fixture = TestBed.createComponent(UexCacheManagementComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain('Impossible');
    const button = [...fixture.nativeElement.querySelectorAll('button')].find((element: any) => element.textContent.includes('Réessayer')) as HTMLButtonElement;
    button.click();
    fixture.componentInstance.loadCatalogConflicts();
    expect(service.getCatalogConflicts).toHaveBeenCalledTimes(2);
    retry.next({data: []});
    retry.complete();
    fixture.detectChanges();
    expect(fixture.componentInstance.conflictsError).toBe('');
    expect(fixture.nativeElement.textContent).toContain('Aucune variante à afficher');
    expect(service.scrapeAllCatalogSources).not.toHaveBeenCalled();
    expect(service.scrapeAndMapCatalogScope).not.toHaveBeenCalled();
    expect(service.resolveCatalogConflict).not.toHaveBeenCalled();
  });
});
