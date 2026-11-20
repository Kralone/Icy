import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RankOrbitComponent } from './rank-orbit.component';

describe('RankOrbitComponent', () => {
  let fixture: ComponentFixture<RankOrbitComponent>;

  const render = (rank: string | null) => {
    fixture = TestBed.createComponent(RankOrbitComponent);
    fixture.componentRef.setInput('rank', rank);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('affiche un anneau par niveau de grade, sur les deux calques', () => {
    expect(render('JUNIOR').querySelectorAll('ellipse[data-ring]').length).toBe(2);
    expect(render('OFFICIER').querySelectorAll('ellipse[data-ring]').length).toBe(10);
    expect(render('ADMIN').querySelectorAll('ellipse[data-ring]').length).toBe(12);
  });

  it('ramène les anciens rôles et les valeurs inconnues sur Junior', () => {
    expect(render('MEMBRE').getAttribute('data-rank')).toBe('JUNIOR');
    expect(render(null).getAttribute('data-rank')).toBe('JUNIOR');
    expect(render('INCONNU').getAttribute('data-rank')).toBe('JUNIOR');
  });

  it('affiche le cœur et les ondes en mode emblème seulement', () => {
    expect(render('ASSOCIE').querySelectorAll('ellipse:not([data-ring])').length).toBe(2);
    fixture = TestBed.createComponent(RankOrbitComponent);
    fixture.componentRef.setInput('mode', 'avatar');
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelectorAll('ellipse:not([data-ring])').length).toBe(0);
    expect(element.querySelector('.orbit-center')).not.toBeNull();
  });
});
