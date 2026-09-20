import { describe, expect, it } from 'vitest';
import {
  LAYOUT,
  defaultViewport,
  initialCamera,
  layoutCallouts,
  speakerCallouts,
  speakerShape,
} from '@target/index';
import type { PlacedCallout, Rect } from '@target/index';

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const place = (camera = initialCamera, previous: PlacedCallout[] | null = null) =>
  layoutCallouts(speakerCallouts, speakerShape, camera, defaultViewport, previous);

describe('Выноски на 3D-модели', () => {
  describe('Раскладка выносок', () => {
    describe('Базовая раскладка', () => {
      it('не допускает наложения подписей друг на друга', () => {
        const visible = place().filter(item => !item.hidden);

        expect(visible.length).toBeGreaterThan(1);

        for (let i = 0; i < visible.length; i += 1) {
          for (let j = i + 1; j < visible.length; j += 1) {
            expect(overlaps(visible[i].labelBox, visible[j].labelBox)).toBe(false);
          }
        }
      });

      it('удерживает подписи внутри вьюпорта с учётом отступа', () => {
        for (const item of place().filter(entry => !entry.hidden)) {
          expect(item.labelBox.x).toBeGreaterThanOrEqual(LAYOUT.margin);
          expect(item.labelBox.y).toBeGreaterThanOrEqual(LAYOUT.margin);
          expect(item.labelBox.x + item.labelBox.width).toBeLessThanOrEqual(
            defaultViewport.width - LAYOUT.margin,
          );
          expect(item.labelBox.y + item.labelBox.height).toBeLessThanOrEqual(
            defaultViewport.height - LAYOUT.margin,
          );
        }
      });

      it('скрывает выноску, когда её якорь ушёл на дальнюю сторону корпуса', () => {
        const front = place({ azimuth: 0, elevation: 0 });
        const back = place({ azimuth: 180, elevation: 0 });

        const tweeterFront = front.find(item => item.id === 'tweeter');
        const tweeterBack = back.find(item => item.id === 'tweeter');

        expect(tweeterFront?.hidden).toBe(false);
        expect(tweeterBack?.hidden).toBe(true);
      });
    });
  });
});
