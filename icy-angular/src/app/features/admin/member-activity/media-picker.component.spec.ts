import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ImageLibraryService } from '../../../core/services/image/image-library.service';
import { ImageMetadata } from '../../../model/image-metadata.model';
import { MediaPickerComponent } from './media-picker.component';

function image(name: string, category?: string): ImageMetadata {
  return { name, url: `https://iceforge.fr/images/${name}`, size: 1, uploadedAt: '2026-11-23T17:52:00', category };
}

describe('MediaPickerComponent', () => {
  function create(file: string | null) {
    TestBed.configureTestingModule({
      imports: [MediaPickerComponent],
      providers: [{
        provide: ImageLibraryService,
        useValue: {
          getAll: () => of([
            image('promotion-officier.gif', 'Messages du bot'),
            image('bienvenue-junior.gif', 'messages du bot'),
            image('AA_SCWE_defence3.webp', 'SW World Event'),
            image('avatars/a.jpg', 'Avatar'),
            image('notes.txt', 'Messages du bot')
          ])
        }
      }]
    });
    const fixture = TestBed.createComponent(MediaPickerComponent);
    fixture.componentRef.setInput('file', file);
    fixture.detectChanges();
    return fixture;
  }

  function options(fixture: ReturnType<typeof create>): string[] {
    return Array.from(fixture.nativeElement.querySelectorAll('option') as NodeListOf<HTMLOptionElement>).map(option => option.textContent!.trim());
  }

  it('only offers the images of the bot messages category', () => {
    const fixture = create(null);

    expect(options(fixture)).toEqual(['Aucun GIF', 'bienvenue-junior.gif', 'promotion-officier.gif']);
  });

  it('keeps a file chosen outside the category and says so', () => {
    const fixture = create('AA_SCWE_defence3.webp');

    expect(options(fixture)).toContain('AA_SCWE_defence3.webp (hors catégorie Messages du bot)');
    expect(fixture.componentInstance.current()?.name).toBe('AA_SCWE_defence3.webp');
  });

  it('flags a file missing from the library', () => {
    const fixture = create('absent.gif');

    expect(options(fixture)).toContain('absent.gif (pas dans la bibliothèque)');
    expect(fixture.nativeElement.querySelector('.media__warning')).not.toBeNull();
  });
});
