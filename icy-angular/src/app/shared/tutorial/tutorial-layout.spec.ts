import { computeBubbleLayout, spotlightBox } from './tutorial-layout';

const desktop = { width: 1440, height: 900 };
const bubble = { width: 360, height: 180 };

describe('tutorial layout', () => {
  it('pads the highlighted zone and keeps it inside the screen', () => {
    expect(spotlightBox({ top: 2, left: 100, width: 200, height: 50 }, desktop)).toEqual({ top: 0, left: 92, width: 216, height: 60 });
  });

  it('puts the bubble under the target with the arrow pointing at its centre', () => {
    const layout = computeBubbleLayout({ top: 100, left: 600, width: 200, height: 60 }, bubble, desktop);
    expect(layout.top).toBe(174);
    expect(layout.left).toBe(520);
    expect(layout.arrow).toEqual({ side: 'top', offset: 180 });
  });

  it('goes above the target when there is no room below', () => {
    const layout = computeBubbleLayout({ top: 760, left: 20, width: 120, height: 60 }, bubble, desktop);
    expect(layout.top).toBe(760 - 14 - 180);
    expect(layout.left).toBe(16);
    expect(layout.arrow).toEqual({ side: 'bottom', offset: 64 });
  });

  it('goes beside a tall target', () => {
    const layout = computeBubbleLayout({ top: 40, left: 40, width: 500, height: 820 }, bubble, desktop);
    expect(layout.left).toBe(554);
    expect(layout.arrow?.side).toBe('left');
  });

  it('centres the bubble when the step has no target', () => {
    expect(computeBubbleLayout(null, bubble, desktop)).toEqual({ top: 360, left: 540, arrow: null });
  });

  it('docks the bubble at the bottom of a phone screen, or at the top when the target is low', () => {
    const phone = { width: 390, height: 800 };
    const small = { width: 358, height: 200 };
    expect(computeBubbleLayout({ top: 120, left: 16, width: 200, height: 40 }, small, phone)).toEqual({ top: 584, left: 16, arrow: { side: 'top', offset: 100 } });
    expect(computeBubbleLayout({ top: 650, left: 16, width: 200, height: 40 }, small, phone)).toEqual({ top: 16, left: 16, arrow: { side: 'bottom', offset: 100 } });
  });
});
