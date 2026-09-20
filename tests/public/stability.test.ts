import { describe, expect, it } from 'vitest';
import {
  defaultViewport,
  initialCamera,
  layoutCallouts,
  speakerCallouts,
  speakerShape,
} from '@target/index';
import type { Camera, PlacedCallout } from '@target/index';

const place = (camera: Camera, previous: PlacedCallout[] | null = null) =>
  layoutCallouts(speakerCallouts, speakerShape, camera, defaultViewport, previous);

const sidesById = (placed: PlacedCallout[]) =>
  Object.fromEntries(placed.map(item => [item.id, item.side]));

describe('Выноски на 3D-модели', () => {
  describe('Раскладка выносок', () => {
    describe('Стабильность при вращении', () => {
      it('сохраняет стороны подписей при повторной раскладке того же ракурса', () => {
        const first = place(initialCamera);
        const second = place(initialCamera, first);

        expect(sidesById(second)).toEqual(sidesById(first));
      });

      it('переносит подпись на другую сторону при развороте модели', () => {
        const front = place({ azimuth: 0, elevation: 10 });
        const turned = place({ azimuth: 90, elevation: 10 }, front);
        const back = place({ azimuth: 180, elevation: 10 }, turned);

        const frontSides = sidesById(front);
        const backSides = sidesById(back);

        const changed = Object.keys(frontSides).filter(
          id => frontSides[id] !== backSides[id],
        );

        expect(changed.length).toBeGreaterThan(0);
      });
    });
  });
});
