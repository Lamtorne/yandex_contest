import { describe, expect, it } from 'vitest';
import {
  LAYOUT,
  defaultViewport,
  initialCamera,
  layoutCallouts,
  speakerCallouts,
  speakerShape,
} from '@target/index';

const widthOf = (id: string, widths: ReadonlyMap<string, number> | null) => {
  const placed = layoutCallouts(
    speakerCallouts,
    speakerShape,
    initialCamera,
    defaultViewport,
    null,
    widths,
  );
  return placed.find(item => item.id === id)?.labelBox.width;
};

describe('Выноски на 3D-модели', () => {
  describe('Раскладка выносок', () => {
    describe('Ширина подписи', () => {
      it('строит плашку по ширине текста с внутренними отступами', () => {
        expect(widthOf('tweeter', new Map([['tweeter', 120]]))).toBe(
          120 + LAYOUT.labelPaddingX * 2,
        );
      });

      it('использует запасную ширину, когда измерения недоступны', () => {
        expect(widthOf('tweeter', null)).toBe(LAYOUT.labelWidth);
        expect(widthOf('tweeter', new Map([['fabric', 90]]))).toBe(LAYOUT.labelWidth);
      });

      it('не выпускает плашку шире максимума', () => {
        expect(widthOf('tweeter', new Map([['tweeter', 900]]))).toBe(LAYOUT.maxLabelWidth);
      });
    });
  });
});
