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
});
