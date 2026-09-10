import {TestBed} from '@angular/core/testing';
import {provideRouter} from '@angular/router';
import {AuthService} from '../../../core/services/auth/auth.service';
import {PublicTopbarComponent} from './public-topbar.component';

describe('PublicTopbarComponent', () => {
  it('opens mobile navigation and closes it with Escape, returning focus to the toggle', async () => {
    await TestBed.configureTestingModule({
      imports: [PublicTopbarComponent],
      providers: [provideRouter([]), {provide: AuthService, useValue: {hasToken: () => false}}]
    }).compileComponents();
    const fixture = TestBed.createComponent(PublicTopbarComponent);
    fixture.detectChanges();
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('.public-topbar__menu-toggle');
    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('.public-topbar__nav--open')).toBeTruthy();

    const guide: HTMLAnchorElement = fixture.nativeElement.querySelector('.public-topbar__dropdown-menu a');
    guide.focus();
    guide.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(toggle);
  });
});
