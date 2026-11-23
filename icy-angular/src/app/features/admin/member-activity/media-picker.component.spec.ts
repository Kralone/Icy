import { ImageMetadata } from '../../../model/image-metadata.model';
import { isBotMedia } from './media-picker.component';

const image = (name: string, category?: string) => ({ name, category } as ImageMetadata);

describe('isBotMedia', () => {
  it('keeps only the images of the bot messages category', () => {
    expect(isBotMedia(image('rappel-inactivite.gif', 'Messages du bot'))).toBe(true);
    expect(isBotMedia(image('promotion-officier.gif', ' messages du bot '))).toBe(true);
    expect(isBotMedia(image('AA_SCWE_defence3.webp', 'SW World Event'))).toBe(false);
    expect(isBotMedia(image('promotion-associe.gif'))).toBe(false);
    expect(isBotMedia(image('notes.pdf', 'Messages du bot'))).toBe(false);
  });
});
