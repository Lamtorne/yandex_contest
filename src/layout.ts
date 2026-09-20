import { LAYOUT, isAnchorVisible, projectPoint } from './projection';
import type {
  Callout,
  CalloutSide,
  Camera,
  LabelWidths,
  ModelShape,
  PlacedCallout,
  Rect,
  Size,
  Vec2,
} from './types';

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const intersects = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

const withGap = (box: Rect): Rect => ({
  x: box.x - LAYOUT.gap,
  y: box.y - LAYOUT.gap,
  width: box.width + LAYOUT.gap * 2,
  height: box.height + LAYOUT.gap * 2,
});

/** Сторона подписи относительно вертикальной оси кадра. */
const resolveSide = (anchorScreen: Vec2, viewport: Size): CalloutSide =>
  anchorScreen.x < viewport.width / 2 ? 'left' : 'right';

/** Ширина плашки: измеренный текст с внутренними отступами, с кэпом и запасным значением. */
const boxWidth = (calloutId: string, labelWidths: LabelWidths): number => {
  const measured = labelWidths?.get(calloutId);
  if (measured === undefined) return LAYOUT.labelWidth;
  return Math.min(measured + LAYOUT.labelPaddingX * 2, LAYOUT.maxLabelWidth);
};

const labelX = (
  anchorScreen: Vec2,
  side: CalloutSide,
  viewport: Size,
  width: number,
): number => {
  const raw =
    side === 'left'
      ? anchorScreen.x - LAYOUT.leaderLength - width
      : anchorScreen.x + LAYOUT.leaderLength;

  return clamp(raw, LAYOUT.margin, viewport.width - LAYOUT.margin - width);
};

const findFreeBox = (desired: Rect, viewport: Size, taken: readonly Rect[]): Rect => {
  const step = LAYOUT.labelHeight + LAYOUT.gap;
  const minY = LAYOUT.margin;
  const maxY = viewport.height - LAYOUT.margin - LAYOUT.labelHeight;
  const attempts = Math.ceil(viewport.height / step) + 2;

  for (let ring = 0; ring <= attempts; ring += 1) {
    const offsets = ring === 0 ? [0] : [ring * step, -ring * step];

    for (const offset of offsets) {
      const box: Rect = { ...desired, y: clamp(desired.y + offset, minY, maxY) };
      if (!taken.some(other => intersects(withGap(other), box))) {
        return box;
      }
    }
  }

  return { ...desired, y: clamp(desired.y, minY, maxY) };
};

/**
 * Раскладка выносок для текущего положения камеры.
 *
 * `previous` — результат предыдущего вызова; он нужен, чтобы подпись не меняла сторону
 * от микродвижений камеры. При первом вызове передаётся `null`.
 */
export const layoutCallouts = (
  callouts: readonly Callout[],
  shape: ModelShape,
  camera: Camera,
  viewport: Size,
  previous: readonly PlacedCallout[] | null,
  labelWidths: LabelWidths = null,
  pinnedIds: readonly string[] = [],
): PlacedCallout[] => {
  void pinnedIds; // закрепление выносок ещё не поддержано
  const previousSides = new Map<string, CalloutSide>(
    (previous ?? []).map(item => [item.id, item.side]),
  );

  const projected = callouts.map(callout => {
    const { screen, depth } = projectPoint(callout.anchor, camera, viewport);
    const hidden = !isAnchorVisible(callout.anchor, shape, camera);

    return {
      callout,
      anchorScreen: screen,
      depth,
      hidden,
      // Скрытая выноска сохраняет сторону, с которой она ушла за корпус.
      side: hidden
        ? previousSides.get(callout.id) ?? resolveSide(screen, viewport)
        : resolveSide(screen, viewport),
    };
  });

  const order = [...projected].sort((a, b) => {
    if (a.callout.priority !== b.callout.priority) {
      return b.callout.priority - a.callout.priority;
    }
    return a.callout.id.localeCompare(b.callout.id);
  });

  const taken: Rect[] = [];
  const boxes = new Map<string, Rect>();

  for (const item of order) {
    const width = boxWidth(item.callout.id, labelWidths);
    const x = labelX(item.anchorScreen, item.side, viewport, width);
    const desired: Rect = {
      x,
      y: item.anchorScreen.y - LAYOUT.labelHeight / 2,
      width,
      height: LAYOUT.labelHeight,
    };

    if (item.hidden) {
      boxes.set(item.callout.id, {
        ...desired,
        y: clamp(
          desired.y,
          LAYOUT.margin,
          viewport.height - LAYOUT.margin - LAYOUT.labelHeight,
        ),
      });
      continue;
    }

    const box = findFreeBox(desired, viewport, taken);
    taken.push(box);
    boxes.set(item.callout.id, box);
  }

  return projected.map(item => ({
    id: item.callout.id,
    side: item.side,
    hidden: item.hidden,
    pinned: false,
    anchorScreen: item.anchorScreen,
    depth: item.depth,
    labelBox: boxes.get(item.callout.id) as Rect,
  }));
};
