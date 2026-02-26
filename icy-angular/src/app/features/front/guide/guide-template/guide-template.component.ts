import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewEncapsulation
} from '@angular/core';
import { GuideTopbarComponent } from '../guide-topbar/guide-topbar.component';
import { GuideContentBlock, GuideDocument, GuideGlossaryItem, GuideSection } from './guide-template.types';

@Component({
  selector: 'front-guide-template',
  standalone: true,
  imports: [CommonModule, GuideTopbarComponent],
  templateUrl: './guide-template.component.html',
  styleUrl: './guide-template.component.css',
  encapsulation: ViewEncapsulation.None
})
export class GuideTemplateComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) guide!: GuideDocument;
  activeSectionId = '';
  copiedSectionId = '';
  private trackedSections: HTMLElement[] = [];
  private onScrollBound?: () => void;
  private onResizeBound?: () => void;
  private frameRequestId?: number;
  private copyResetTimer?: ReturnType<typeof setTimeout>;
  private readonly glossaryPatternCache = new Map<string, RegExp>();

  constructor(private readonly hostRef: ElementRef<HTMLElement>) {}

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
    const formatted = this.formatMarkdownLinks(
      this.escapeHtml(text)
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
    );

    if (!applyGlossary) {
      return formatted;
    }

    const glossary = this.resolveGlossary();
    if (!glossary.length) {
      return formatted;
    }
    return this.applyGlossaryToHtml(formatted, glossary);
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

  private formatMarkdownLinks(html: string): string {
    return html.replace(/\[([^[\]]+?)\]\(([^()\s]+)\)/g, (_match, label: string, href: string) => {
      const safeHref = this.normalizeInlineHref(href);
      if (!safeHref) {
        return label;
      }
      const isResourcesLink = safeHref.startsWith('/guides/minage/ressources');
      const linkClass = isResourcesLink ? 'guide-inline-link guide-inline-link--resource' : 'guide-inline-link';
      const hint = isResourcesLink ? '<span class="guide-inline-link__hint">Ressource</span>' : '';
      return `<a class="${linkClass}" href="${safeHref}">${label}${hint}</a>`;
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
