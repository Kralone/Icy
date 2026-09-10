import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {of, Subject, throwError} from 'rxjs';
import {vi} from 'vitest';
import {CigWatchManagementComponent} from './cig-watch-management.component';
import {CigRawEntry, CigWatchService} from '../../../core/services/news/cig-watch.service';

describe('CIG Watch publication states', () => {
  it('shows failed translation and archived status without claiming publication', async () => {
    const feed = {items: [{sourceId: 1, sourceLabel: 'RSI', title: 'Original title', link: 'https://robertsspaceindustries.com/en/comm-link', translationStatus: 'FAILED', publicationStatus: 'ARCHIVED', deliveryStatus: 'DISABLED', lastError: 'Traduction indisponible'}], errors: []};
    await TestBed.configureTestingModule({
      imports: [CigWatchManagementComponent], providers: [provideRouter([]), {provide: CigWatchService, useValue: {
        listSources: () => of({data: []}), getFeed: () => of({data: feed})
      }}]
    }).compileComponents();
    const fixture = TestBed.createComponent(CigWatchManagementComponent);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Traduction à reprendre');
    expect(text).toContain('Archive · non publiée');
    expect(text).toContain('Relais Discord désactivé');
    expect(text).not.toContain('Publiée sur le site');
    expect(text).not.toContain('Traduit en français');
    fixture.destroy();
  });

  it('reports collection errors after refresh rather than an unconditional success', () => {
    const service = {forceRefresh: () => of({data: {items: [], errors: [{sourceId: 1, message: 'Indisponible'}]}})};
    const component = new CigWatchManagementComponent(service as unknown as CigWatchService);
    component.forceRefresh();
    expect(component.success).toBe('Collecte terminée avec des erreurs.');
    expect(component.isForcingRefresh).toBe(false);
  });

  it('polls an asynchronous refresh with GET and stops after completion', () => {
    vi.useFakeTimers();
    const forceRefresh = vi.fn(() => of({data: {items: [], errors: [], refreshing: true}}));
    const getFeed = vi.fn(() => of({data: {items: [], errors: [], refreshing: false}}));
    const component = new CigWatchManagementComponent({forceRefresh, getFeed} as unknown as CigWatchService);
    try {
      component.forceRefresh();
      expect(component.isForcingRefresh).toBe(true);
      expect(component.success).toBe('');
      vi.advanceTimersByTime(3000);
      expect(getFeed).toHaveBeenCalledOnce();
      expect(forceRefresh).toHaveBeenCalledOnce();
      expect(component.isForcingRefresh).toBe(false);
      expect(component.success).toBe('Collecte terminée.');
      vi.advanceTimersByTime(6000);
      expect(getFeed).toHaveBeenCalledOnce();
    } finally {
      component.ngOnDestroy();
      vi.useRealTimers();
    }
  });
  it('blocks duplicate clicks while a publication is in flight', () => {
    const pending = new Subject<any>();
    const entryAction = vi.fn(() => pending);
    const component = new CigWatchManagementComponent({entryAction} as unknown as CigWatchService);
    component.feed = {publishingEnabled: true} as any;
    const entry = {id: 7, translationStatus: 'TRANSLATED', fetchedAt: new Date().toISOString()} as CigRawEntry;
    component.runEntryAction(entry, 'publish');
    component.runEntryAction(entry, 'publish');
    expect(entryAction).toHaveBeenCalledTimes(1);
    expect(component.busyEntryId).toBe(7);
    pending.error({});
    expect(component.busyEntryId).toBeNull();
    expect(component.success).toBe('');
  });

  it('keeps a failed correction draft and never publishes it implicitly', () => {
    const correctTranslation = vi.fn(() => throwError(() => ({})));
    const entryAction = vi.fn();
    const component = new CigWatchManagementComponent({correctTranslation, entryAction} as unknown as CigWatchService);
    const entry = {id: 7, title: 'Titre', rawExcerpt: 'Texte'} as CigRawEntry;
    component.editTranslation(entry);
    component.draftTitle = 'Titre corrigé';
    component.saveTranslation(entry);
    expect(component.editingEntryId).toBe(7);
    expect(component.draftTitle).toBe('Titre corrigé');
    expect(entryAction).not.toHaveBeenCalled();
    expect(component.error).toContain('Impossible');
  });

  it('does not offer publication for old archives or retry delivered messages', () => {
    const component = new CigWatchManagementComponent({} as CigWatchService);
    component.feed = {publishingEnabled: true, discordRelayEnabled: true} as any;
    expect(component.canPublish({id: 7, translationStatus: 'TRANSLATED', fetchedAt: '2020-01-01'} as CigRawEntry)).toBe(false);
    expect(component.canRetry({id: 7, newsId: 2, deliveryStatus: 'DELIVERED'} as CigRawEntry)).toBe(false);
  });
});
