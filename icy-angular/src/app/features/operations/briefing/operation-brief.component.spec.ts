import { TestBed } from '@angular/core/testing';
import { OperationBriefComponent } from './operation-brief.component';

describe('OperationBriefComponent', () => {
  function render(briefing: string): HTMLElement {
    const fixture = TestBed.createComponent(OperationBriefComponent);
    fixture.componentRef.setInput('briefing', briefing);
    fixture.detectChanges();
    return fixture.nativeElement.querySelector('#operation-briefing-text');
  }

  it('renders the briefing as Markdown: bold, lists and line breaks', () => {
    const text = render('**Objectif** : Hathor - Carinite Pure.\n- Ouvrir le trou\n- Miner');
    expect(text.querySelector('strong')!.textContent).toBe('Objectif');
    expect(text.textContent).not.toContain('**');
    expect(Array.from(text.querySelectorAll('li')).map(item => item.textContent)).toEqual(['Ouvrir le trou', 'Miner']);
  });

  it('shows typed HTML as text instead of interpreting it', () => {
    const text = render('<img src=x onerror="alert(1)"> **ok**');
    expect(text.querySelector('img')).toBeNull();
    expect(text.textContent).toContain('<img src=x');
    expect(text.querySelector('strong')!.textContent).toBe('ok');
  });

  it('keeps only web and mail links, opened in a new tab without access to the sheet', () => {
    const text = render('[carte](https://iceforge.fr/carte?a=1&b=2) [piège](javascript:alert(1)) [écrire](mailto:orga@iceforge.fr)');
    const links = Array.from(text.querySelectorAll('a'));
    expect(links.map(link => link.getAttribute('href'))).toEqual(['https://iceforge.fr/carte?a=1&b=2', 'mailto:orga@iceforge.fr']);
    expect(links.every(link => link.getAttribute('target') === '_blank' && link.getAttribute('rel') === 'noopener noreferrer nofollow')).toBe(true);
    expect(text.textContent).toContain('piège');
  });

  it('never loads an image from the briefing, it shows its description', () => {
    const text = render('![plan du site](https://exemple.test/suivi.png)');
    expect(text.querySelector('img')).toBeNull();
    expect(text.textContent).toContain('plan du site');
  });
});
