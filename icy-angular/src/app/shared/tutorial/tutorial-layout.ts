import { TutorialPlacement } from './tutorial.model';

export interface Box { top: number; left: number; width: number; height: number; }
export type ArrowSide = 'top' | 'bottom' | 'left' | 'right';

export interface BubbleLayout {
  top: number;
  left: number;
  /** Côté de la bulle qui porte la flèche, et position de la flèche le long de ce côté. */
  arrow: { side: ArrowSide; offset: number } | null;
}

export const SPOTLIGHT_PADDING = 8;
const GAP = 14;
const MARGIN = 16;
const ARROW_INSET = 22;
const MOBILE_WIDTH = 640;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));

export function spotlightBox(target: Box, viewport: { width: number; height: number }): Box {
  const top = Math.max(target.top - SPOTLIGHT_PADDING, 0);
  const left = Math.max(target.left - SPOTLIGHT_PADDING, 0);
  const bottom = Math.min(target.top + target.height + SPOTLIGHT_PADDING, viewport.height);
  const right = Math.min(target.left + target.width + SPOTLIGHT_PADDING, viewport.width);
  return { top, left, width: Math.max(right - left, 0), height: Math.max(bottom - top, 0) };
}

/**
 * Place la bulle à côté de la zone mise en avant, du côté qui a la place.
 * Sur mobile, la bulle occupe le bas de l’écran (ou le haut si la cible est en bas).
 */
export function computeBubbleLayout(
  spot: Box | null,
  bubble: { width: number; height: number },
  viewport: { width: number; height: number },
  placement: TutorialPlacement = 'auto'
): BubbleLayout {
  const maxLeft = viewport.width - bubble.width - MARGIN;
  const maxTop = viewport.height - bubble.height - MARGIN;
  if (!spot) {
    return { top: clamp((viewport.height - bubble.height) / 2, MARGIN, maxTop), left: clamp((viewport.width - bubble.width) / 2, MARGIN, maxLeft), arrow: null };
  }

  if (viewport.width < MOBILE_WIDTH) {
    const below = viewport.height - (spot.top + spot.height);
    const toBottom = below >= bubble.height + GAP || spot.top + spot.height / 2 < viewport.height / 2;
    const left = clamp((viewport.width - bubble.width) / 2, MARGIN, maxLeft);
    const top = toBottom ? Math.max(maxTop, MARGIN) : MARGIN;
    const fitsBeside = toBottom ? top >= spot.top + spot.height + GAP / 2 : top + bubble.height <= spot.top - GAP / 2;
    return { top, left, arrow: fitsBeside ? arrowOn(toBottom ? 'top' : 'bottom', spot, left, bubble) : null };
  }

  const room = {
    bottom: viewport.height - (spot.top + spot.height) - GAP - MARGIN,
    top: spot.top - GAP - MARGIN,
    right: viewport.width - (spot.left + spot.width) - GAP - MARGIN,
    left: spot.left - GAP - MARGIN
  };
  const fits = (side: ArrowSide) => side === 'top' || side === 'bottom' ? room[side] >= bubble.height : room[side] >= bubble.width;
  const order: ArrowSide[] = placement === 'auto' ? ['bottom', 'top', 'right', 'left'] : [placement, 'bottom', 'top', 'right', 'left'];
  const side = order.find(fits);

  if (!side) {
    // Cible trop grande : la bulle se pose dans le coin bas de l’écran, au-dessus de la cible.
    return { top: Math.max(maxTop, MARGIN), left: clamp(viewport.width - bubble.width - MARGIN * 2, MARGIN, maxLeft), arrow: null };
  }

  if (side === 'bottom' || side === 'top') {
    const left = clamp(spot.left + spot.width / 2 - bubble.width / 2, MARGIN, maxLeft);
    const top = side === 'bottom' ? spot.top + spot.height + GAP : spot.top - GAP - bubble.height;
    return { top, left, arrow: arrowOn(side === 'bottom' ? 'top' : 'bottom', spot, left, bubble) };
  }
  const top = clamp(spot.top + spot.height / 2 - bubble.height / 2, MARGIN, maxTop);
  const left = side === 'right' ? spot.left + spot.width + GAP : spot.left - GAP - bubble.width;
  const offset = clamp(spot.top + spot.height / 2 - top, ARROW_INSET, bubble.height - ARROW_INSET);
  return { top, left, arrow: { side: side === 'right' ? 'left' : 'right', offset } };
}

function arrowOn(side: ArrowSide, spot: Box, bubbleLeft: number, bubble: { width: number }): BubbleLayout['arrow'] {
  return { side, offset: clamp(spot.left + spot.width / 2 - bubbleLeft, ARROW_INSET, bubble.width - ARROW_INSET) };
}
