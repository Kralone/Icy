import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ColorFieldComponent } from './color-field.component';
import { contrastRatio, hexToHsv, hsvToHex, normalizeHex } from './color-math';

describe('color-math', () => {
  it('normalizes short and uppercase hex values, and rejects named colors', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc');
    expect(normalizeHex('27647C')).toBe('#27647c');
    expect(normalizeHex('black')).toBeNull();
    expect(normalizeHex('rgb(0,0,0)')).toBeNull();
  });

  it('round-trips through HSV', () => {
    for (const hex of ['#27647c', '#ffffff', '#000000', '#b91c1c', '#fde68a']) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });

  it('computes WCAG contrast', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});

describe('ColorFieldComponent', () => {
  let fixture: ComponentFixture<ColorFieldComponent>;
  let component: ColorFieldComponent;

  beforeEach(() => {
    fixture = TestBed.createComponent(ColorFieldComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('label', 'Couleur d’accent');
    fixture.componentRef.setInput('presets', ['#b91c1c', '#15803d']);
    fixture.componentRef.setInput('value', '#27647c');
    fixture.detectChanges();
  });

  it('accepts a typed hex value and ignores incomplete input', () => {
    const input: HTMLInputElement = fixture.nativeElement.querySelector('.cf-hex');
    input.value = '#12';
    input.dispatchEvent(new Event('input'));
    expect(component.value()).toBe('#27647c');
    expect(component.invalid()).toBe(true);

    input.value = '#123047';
    input.dispatchEvent(new Event('input'));
    expect(component.value()).toBe('#123047');
    expect(component.invalid()).toBe(false);
  });

  it('opens the panel and picks a preset', () => {
    (fixture.nativeElement.querySelector('.cf-swatch') as HTMLButtonElement).click();
    fixture.detectChanges();
    const presets = fixture.nativeElement.querySelectorAll('.cf-preset');
    expect(presets.length).toBe(2);
    (presets[1] as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(component.value()).toBe('#15803d');
    expect((presets[1] as HTMLElement).getAttribute('aria-pressed')).toBe('true');
  });

  it('moves saturation and brightness with the keyboard', () => {
    component.choose('#808080');
    component.toggle();
    fixture.detectChanges();
    const area: HTMLElement = fixture.nativeElement.querySelector('.cf-area');
    area.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', shiftKey: true }));
    expect(hexToHsv(component.value()).v).toBeGreaterThan(hexToHsv('#808080').v);
  });
});
