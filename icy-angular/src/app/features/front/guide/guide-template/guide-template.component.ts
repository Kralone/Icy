
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewEncapsulation,
  ChangeDetectionStrategy
} from '@angular/core';
import { Subscription } from 'rxjs';
import { ItemCatalogItem, ItemCatalogService } from '../../../../core/services/item/item-catalog.service';
import { ShipService } from '../../../../core/services/ship/ship.service';
import { Ship } from '../../../../model/ship.model';
import { GuideTopbarComponent } from '../guide-topbar/guide-topbar.component';
import { GuideContentBlock, GuideDocument, GuideGlossaryItem, GuideSection } from './guide-template.types';

@Component({
  selector: 'front-guide-template',
  standalone: true,
  imports: [GuideTopbarComponent],
  templateUrl: './guide-template.component.html',
  styleUrl: './guide-template.component.css',
  changeDetection: ChangeDetectionStrategy.Eager,
  encapsulation: ViewEncapsulation.None
})
export class GuideTemplateComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) guide!: GuideDocument;
  activeSectionId = '';
  copiedSectionId = '';
  private readonly dbTokenPattern = /\[\[db:(ship|item):([^\]|]+?)(?:\|([^\]]+?))?\]\]/giu;
  private trackedSections: HTMLElement[] = [];
  private onScrollBound?: () => void;
  private onResizeBound?: () => void;
  private frameRequestId?: number;
  private copyResetTimer?: ReturnType<typeof setTimeout>;
  private readonly glossaryPatternCache = new Map<string, RegExp>();
  private shipLookupLoaded = false;
  private shipLookupLoading = false;
  private shipLookupError = false;
  private itemLookupLoaded = false;
  private itemLookupLoading = false;
  private itemLookupError = false;
  private readonly shipLookupByKey = new Map<string, Ship>();
  private readonly itemLookupByKey = new Map<string, ItemCatalogItem>();
  private shipLookupSubscription?: Subscription;
  private itemLookupSubscription?: Subscription;

  constructor(
    private readonly hostRef: ElementRef<HTMLElement>,
    private readonly shipService: ShipService,
    private readonly itemCatalogService: ItemCatalogService
  ) {}

  formatStep(step: number): string {
    return step < 10 ? `0${step}` : `${step}`;
  }

  formatSectionTitle(index: number, rawTitle: string): string {
    const title = this.stripLeadingIndex(rawTitle);
    return `${index + 1}. ${title}`;
  }

  formatSectionLabel(rawTitle: string): string {
    return this.stripLeadingIndex(rawTitle);
  }

  formatInline(text: string, _section?: GuideSection, applyGlossary = true): string {
    const dbTokens = this.extractDbTokens(text);
    const formatted = this.formatMarkdownLinks(
      this.escapeHtml(dbTokens.textWithPlaceholders)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
    );

    if (!applyGlossary) {
      return this.restoreDbTokens(formatted, dbTokens.replacements);
    }

    const glossary = this.resolveGlossary();
    if (!glossary.length) {
      return this.restoreDbTokens(formatted, dbTokens.replacements);
    }
    return this.restoreDbTokens(this.applyGlossaryToHtml(formatted, glossary), dbTokens.replacements);
  }

  scrollToSection(event: Event, sectionId: string): void {
    event.preventDefault();
    const section = this.hostRef.nativeElement.querySelector<HTMLElement>(`#${sectionId}`);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.setHash(sectionId);
      this.activeSectionId = sectionId;
    }
  }

  copySectionLink(sectionId: string): void {
    const section = this.hostRef.nativeElement.querySelector<HTMLElement>(`#${sectionId}`);
    if (!section) {
      return;
    }

    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    this.setHash(sectionId);
    this.activeSectionId = sectionId;

    if (typeof window === 'undefined') {
      return;
    }

    const link = `${window.location.origin}${window.location.pathname}${window.location.search}#${sectionId}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard
        .writeText(link)
        .then(() => this.markSectionLinkCopied(sectionId))
        .catch(() => this.fallbackCopy(link, sectionId));
      return;
    }

    this.fallbackCopy(link, sectionId);
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.connectObserver());
  }

  ngOnChanges(_: SimpleChanges): void {
    if (!this.activeSectionId && this.guide?.sections?.length) {
      this.activeSectionId = this.guide.sections[0].id;
    }
    queueMicrotask(() => this.connectObserver());
  }

  ngOnDestroy(): void {
    this.disconnectObserver();
    if (this.copyResetTimer) {
      clearTimeout(this.copyResetTimer);
      this.copyResetTimer = undefined;
    }
    if (this.shipLookupSubscription) {
      this.shipLookupSubscription.unsubscribe();
      this.shipLookupSubscription = undefined;
    }
    if (this.itemLookupSubscription) {
      this.itemLookupSubscription.unsubscribe();
      this.itemLookupSubscription = undefined;
    }
  }

  trackSection(index: number, section: GuideSection): string {
    return section.id || `${index}`;
  }

  trackGlossary(index: number, item: GuideGlossaryItem): string {
    return `${item.term}-${index}`;
  }

  trackBlock(index: number, block: GuideContentBlock): string {
    if (block.type === 'paragraph') {
      return `p-${index}-${block.text.slice(0, 24)}`;
    }
    if (block.type === 'list') {
      return `l-${index}-${block.items.length}`;
    }
    if (block.type === 'image') {
      return `i-${index}-${block.imageUrl}`;
    }
    return `c-${index}-${block.callout.title}`;
  }

  private connectObserver(): void {
    this.disconnectObserver();
    if (typeof window === 'undefined') {
      return;
    }

    this.trackedSections = Array.from(this.hostRef.nativeElement.querySelectorAll<HTMLElement>('.guide-card[id]'));
    if (!this.trackedSections.length) {
      return;
    }

    this.activeSectionId = this.activeSectionId || this.trackedSections[0].id;

    this.onScrollBound = () => {
      this.scheduleActiveUpdate();
    };
    this.onResizeBound = () => {
      this.scheduleActiveUpdate();
    };
    window.addEventListener('scroll', this.onScrollBound, { passive: true });
    window.addEventListener('resize', this.onResizeBound, { passive: true });
    this.updateActiveSectionFromScroll();
  }

  private scheduleActiveUpdate(): void {
    if (typeof window === 'undefined' || this.frameRequestId !== undefined) {
      return;
    }
    this.frameRequestId = window.requestAnimationFrame(() => {
      this.frameRequestId = undefined;
      this.updateActiveSectionFromScroll();
    });
  }

  private updateActiveSectionFromScroll(): void {
    if (!this.trackedSections.length || typeof window === 'undefined') {
      return;
    }

    if (this.isNearPageBottom()) {
      this.activeSectionId = this.trackedSections[this.trackedSections.length - 1].id;
      return;
    }

    const anchorY = window.scrollY + (window.innerHeight * 0.28);
    let active = this.trackedSections[0];
    for (const section of this.trackedSections) {
      if (section.offsetTop <= anchorY) {
        active = section;
      } else {
        break;
      }
    }
    this.activeSectionId = active.id;
  }

  private disconnectObserver(): void {
    this.trackedSections = [];
    if (typeof window !== 'undefined' && this.onScrollBound) {
      window.removeEventListener('scroll', this.onScrollBound);
      this.onScrollBound = undefined;
    }
    if (typeof window !== 'undefined' && this.onResizeBound) {
      window.removeEventListener('resize', this.onResizeBound);
      this.onResizeBound = undefined;
    }
    if (typeof window !== 'undefined' && this.frameRequestId !== undefined) {
      window.cancelAnimationFrame(this.frameRequestId);
      this.frameRequestId = undefined;
    }
  }

  private resolveGlossary(): GuideGlossaryItem[] {
    const merged = this.guide?.glossary ?? [];
    const uniqueByTerm = new Map<string, GuideGlossaryItem>();
    for (const item of merged) {
      const key = item.term.trim().toLocaleLowerCase();
      if (!key) {
        continue;
      }
      if (!uniqueByTerm.has(key)) {
        uniqueByTerm.set(key, item);
      }
    }
    return Array.from(uniqueByTerm.values());
  }

  private applyGlossaryToHtml(html: string, glossary: GuideGlossaryItem[]): string {
    const sorted = glossary
      .filter((item) => item.term.trim().length > 0)
      .sort((a, b) => b.term.length - a.term.length);

    if (!sorted.length) {
      return html;
    }

    const key = sorted.map((item) => item.term.trim().toLocaleLowerCase()).join('|');
    let pattern = this.glossaryPatternCache.get(key);
    if (!pattern) {
      const terms = sorted.map((item) => this.escapeRegExp(item.term.trim()));
      pattern = new RegExp(`(${terms.join('|')})`, 'giu');
      this.glossaryPatternCache.set(key, pattern);
    }

    const definitionsByTerm = new Map<string, string>();
    sorted.forEach((item) => {
      definitionsByTerm.set(item.term.trim().toLocaleLowerCase(), item.definition);
    });

    const chunks = html.split(/(<[^>]+>)/g);
    return chunks.map((chunk) => {
      if (!chunk || chunk.startsWith('<')) {
        return chunk;
      }

      return chunk.replace(pattern as RegExp, (match: string, _: string, offset: number, source: string) => {
        if (!this.isWordBoundary(source, offset, offset + match.length)) {
          return match;
        }

        const definition = definitionsByTerm.get(match.toLocaleLowerCase());
        if (!definition) {
          return match;
        }

        return `<span class="guide-term guide-term--inline" tabindex="0">${match}<span class="guide-term__tooltip">${this.escapeHtml(definition)}</span></span>`;
      });
    }).join('');
  }

  private isWordBoundary(text: string, start: number, end: number): boolean {
    const prev = start > 0 ? text[start - 1] : '';
    const next = end < text.length ? text[end] : '';
    const isWord = (char: string): boolean => /[\p{L}\p{N}]/u.test(char);
    return !isWord(prev) && !isWord(next);
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private stripLeadingIndex(title: string): string {
    return title.replace(/^\s*\d+\s*[\.\-:]\s*/u, '').trim();
  }

  private isNearPageBottom(): boolean {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return false;
    }
    const scrollBottom = window.innerHeight + window.scrollY;
    const fullHeight = document.documentElement.scrollHeight;
    return scrollBottom >= fullHeight - 6;
  }

  private setHash(sectionId: string): void {
    if (typeof window === 'undefined') {
      return;
    }
    const nextUrl = `${window.location.pathname}${window.location.search}#${sectionId}`;
    window.history.replaceState(window.history.state, '', nextUrl);
  }

  private fallbackCopy(link: string, sectionId: string): void {
    if (typeof document === 'undefined') {
      return;
    }
    const textarea = document.createElement('textarea');
    textarea.value = link;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    if (copied) {
      this.markSectionLinkCopied(sectionId);
    }
  }

  private markSectionLinkCopied(sectionId: string): void {
    this.copiedSectionId = sectionId;
    if (this.copyResetTimer) {
      clearTimeout(this.copyResetTimer);
    }
    this.copyResetTimer = setTimeout(() => {
      if (this.copiedSectionId === sectionId) {
        this.copiedSectionId = '';
      }
    }, 1600);
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private extractDbTokens(text: string): { textWithPlaceholders: string; replacements: Array<{ placeholder: string; html: string }> } {
    this.dbTokenPattern.lastIndex = 0;
    let textWithPlaceholders = '';
    let cursor = 0;
    let tokenIndex = 0;
    const replacements: Array<{ placeholder: string; html: string }> = [];
    let match = this.dbTokenPattern.exec(text);

    while (match) {
      const matchIndex = match.index;
      textWithPlaceholders += text.slice(cursor, matchIndex);
      const placeholder = `@@DBTOKEN_${tokenIndex}@@`;
      replacements.push({
        placeholder,
        html: this.buildDbTermHtml(
        match[1]?.toLowerCase() === 'ship' ? 'ship' : 'item',
        (match[2] ?? '').trim(),
        (match[3] ?? '').trim()
        )
      });
      textWithPlaceholders += placeholder;
      cursor = this.dbTokenPattern.lastIndex;
      tokenIndex += 1;
      match = this.dbTokenPattern.exec(text);
    }

    textWithPlaceholders += text.slice(cursor);
    return { textWithPlaceholders, replacements };
  }

  private restoreDbTokens(html: string, replacements: Array<{ placeholder: string; html: string }>): string {
    let restored = html;
    for (const token of replacements) {
      restored = restored.replace(token.placeholder, token.html);
    }
    return restored;
  }

  private buildDbTermHtml(entityType: 'ship' | 'item', lookupValue: string, customLabel: string): string {
    const label = customLabel || lookupValue;
    if (!lookupValue || !label) {
      return this.escapeHtml(label || lookupValue);
    }

    const tooltipBody = entityType === 'ship'
      ? this.renderShipTooltip(lookupValue)
      : this.renderItemTooltip(lookupValue);

    return `<span class="guide-term guide-term--inline guide-term--db" tabindex="0">${this.escapeHtml(label)}<span class="guide-term__tooltip guide-term__tooltip--db">${tooltipBody}</span></span>`;
  }

  private renderShipTooltip(lookupValue: string): string {
    this.ensureShipLookupLoaded();
    if (this.shipLookupLoading && !this.shipLookupLoaded) {
      return 'Chargement du vaisseau...';
    }
    if (this.shipLookupError) {
      return 'Impossible de charger les vaisseaux.';
    }

    const ship = this.shipLookupByKey.get(this.normalizeLookupKey(lookupValue));
    if (!ship) {
      return `Vaisseau introuvable: ${this.escapeHtml(lookupValue)}`;
    }

    const brand = ship.brand?.name ?? 'Marque inconnue';
    const size = ship.size || '-';
    const crew = ship.crew || '-';
    const focus = ship.focus || '-';
    const scu = ship.scu ?? null;
    const statLines = [
      { label: 'Focus', value: focus },
      { label: 'Taille', value: size },
      { label: 'Equipage', value: crew },
      { label: 'SCU', value: scu === null ? '-' : new Intl.NumberFormat('fr-FR').format(scu) }
    ];
    const image = ship.imageUrl
      ? `<img class="guide-db-card__image" src="${this.escapeHtml(ship.imageUrl)}" alt="${this.escapeHtml(ship.name)}" />`
      : '';
    const statsBlock = `<span class="guide-db-card__stats">${statLines.map((line) => this.renderStatLine(line)).join('')}</span>`;

    return `<span class="guide-db-card"><span class="guide-db-card__eyebrow">Vaisseau</span><strong class="guide-db-card__title">${this.escapeHtml(ship.name)}</strong><span class="guide-db-card__meta">${this.escapeHtml(brand)}</span>${image}${statsBlock}</span>`;
  }

  private renderItemTooltip(lookupValue: string): string {
    this.ensureItemLookupLoaded();
    if (this.itemLookupLoading && !this.itemLookupLoaded) {
      return 'Chargement de l item...';
    }
    if (this.itemLookupError) {
      return 'Impossible de charger les items.';
    }

    const item = this.itemLookupByKey.get(this.normalizeLookupKey(lookupValue));
    if (!item) {
      return `Item introuvable: ${this.escapeHtml(lookupValue)}`;
    }

    const category = item.category?.name ?? 'Categorie inconnue';
    const manufacturer = item.manufacturer ?? 'Fabricant inconnu';
    const statLines = this.parseStatLines(item.stats);
    const image = item.imageUrl
      ? `<img class="guide-db-card__image" src="${this.escapeHtml(item.imageUrl)}" alt="${this.escapeHtml(item.name)}" />`
      : '';
    const statsBlock = statLines.length
      ? `<span class="guide-db-card__stats">${statLines.map((line) => this.renderStatLine(line)).join('')}</span>`
      : '';

    return `<span class="guide-db-card"><span class="guide-db-card__eyebrow">Equipement</span><strong class="guide-db-card__title">${this.escapeHtml(item.name)}</strong><span class="guide-db-card__meta">${this.escapeHtml(manufacturer)} · ${this.escapeHtml(category)}</span>${image}${statsBlock}</span>`;
  }

  private ensureShipLookupLoaded(): void {
    if (this.shipLookupLoaded || this.shipLookupLoading) {
      return;
    }

    this.shipLookupLoading = true;
    this.shipLookupError = false;
    this.shipLookupSubscription = this.shipService.getAllShips().subscribe({
      next: (response) => {
        this.shipLookupByKey.clear();
        for (const ship of response?.data ?? []) {
          const shipNameKey = this.normalizeLookupKey(ship.name);
          if (shipNameKey) {
            this.shipLookupByKey.set(shipNameKey, ship);
          }
          const brandName = ship.brand?.name ?? '';
          const brandedShipNameKey = this.normalizeLookupKey(`${brandName} ${ship.name}`);
          if (brandedShipNameKey) {
            this.shipLookupByKey.set(brandedShipNameKey, ship);
          }
        }
        this.shipLookupLoaded = true;
        this.shipLookupLoading = false;
      },
      error: () => {
        this.shipLookupError = true;
        this.shipLookupLoading = false;
      }
    });
  }

  private ensureItemLookupLoaded(): void {
    if (this.itemLookupLoaded || this.itemLookupLoading) {
      return;
    }

    this.itemLookupLoading = true;
    this.itemLookupError = false;
    this.itemLookupSubscription = this.itemCatalogService.listFrontItems().subscribe({
      next: (response) => {
        this.itemLookupByKey.clear();
        for (const item of response?.data ?? []) {
          const itemNameKey = this.normalizeLookupKey(item.name);
          if (itemNameKey) {
            this.itemLookupByKey.set(itemNameKey, item);
          }
          const manufacturer = item.manufacturer ?? '';
          const brandedItemNameKey = this.normalizeLookupKey(`${manufacturer} ${item.name}`);
          if (brandedItemNameKey) {
            this.itemLookupByKey.set(brandedItemNameKey, item);
          }
        }
        this.itemLookupLoaded = true;
        this.itemLookupLoading = false;
      },
      error: () => {
        this.itemLookupError = true;
        this.itemLookupLoading = false;
      }
    });
  }

  private normalizeLookupKey(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  private parseStatLines(rawStats: string | null | undefined): Array<{ label: string; value: string | null }> {
    if (!rawStats) {
      return [];
    }
    return rawStats
      .split('|')
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
      .map((part) => {
        const separatorIndex = part.indexOf(':');
        if (separatorIndex === -1) {
          return { label: part, value: null };
        }
        return {
          label: part.slice(0, separatorIndex).trim(),
          value: part.slice(separatorIndex + 1).trim() || null
        };
      });
  }

  private renderStatLine(stat: { label: string; value: string | null }): string {
    const label = this.escapeHtml(stat.label);
    const value = stat.value ? this.escapeHtml(stat.value) : null;
    if (!value) {
      return `<span class="guide-db-card__stats-line"><span class="guide-db-card__stats-label">${label}</span></span>`;
    }
    return `<span class="guide-db-card__stats-line"><span class="guide-db-card__stats-label">${label}</span><span class="guide-db-card__stats-value">${value}</span></span>`;
  }

  private formatMarkdownLinks(html: string): string {
    return html.replace(/\[([^[\]]+?)\]\(([^()\s]+)\)/g, (_match, label: string, href: string) => {
      const safeHref = this.normalizeInlineHref(href);
      if (!safeHref) {
        return label;
      }
      const isResourcesLink = safeHref.startsWith('/utilitaires/ressources-minage') || safeHref.startsWith('/guides/minage/ressources');
      const linkClass = isResourcesLink ? 'guide-inline-link guide-inline-link--resource' : 'guide-inline-link';
      const targetAttr = isResourcesLink ? ' target="_blank" rel="noopener noreferrer"' : '';
      return `<a class="${linkClass}" href="${safeHref}"${targetAttr}>${label}</a>`;
    });
  }

  private normalizeInlineHref(rawHref: string): string | null {
    const href = rawHref.trim();
    if (!href) {
      return null;
    }
    if (href.startsWith('/')) {
      return href;
    }
    if (/^https?:\/\//i.test(href)) {
      return href;
    }
    if (/^mailto:/i.test(href) || /^tel:/i.test(href)) {
      return href;
    }
    return null;
  }
}
