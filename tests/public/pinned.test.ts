import { describe, expect, it } from 'vitest';
import {
  createCalloutController,
  defaultViewport,
  initialCamera,
  layoutCallouts,
  speakerCallouts,
  speakerShape,
} from '@target/index';
import type { CalloutSet, CalloutSource } from '@target/index';

const readySource = (): CalloutSource => ({
  load: (variantId) =>
    Promise.resolve<CalloutSet>({ variantId, revision: 1, callouts: speakerCallouts }),
});

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('Выноски на 3D-модели', () => {
  describe('Закреплённые аннотации', () => {
    describe('Базовое закрепление', () => {
      it('закрепляет выноску и снимает закрепление повторным вызовом', async () => {
        const controller = createCalloutController(readySource(), 'graphite');
        await flush();

        controller.togglePin('tweeter');
        expect(controller.getState().pinnedIds).toContain('tweeter');

        controller.togglePin('tweeter');
        expect(controller.getState().pinnedIds).not.toContain('tweeter');
        controller.dispose();
      });

      it('держит закреплённую скрытую подпись на сцене внутри кадра', () => {
        const backCamera = { azimuth: 180, elevation: 0 };
        const placed = layoutCallouts(
          speakerCallouts,
          speakerShape,
          backCamera,
          defaultViewport,
          null,
          null,
          ['tweeter'],
        );

        const pinned = placed.find(item => item.id === 'tweeter');
        expect(pinned?.hidden).toBe(true);
        expect(pinned?.pinned).toBe(true);
        expect(pinned?.labelBox.x).toBeGreaterThanOrEqual(0);
        expect(pinned?.labelBox.x + (pinned?.labelBox.width ?? 0)).toBeLessThanOrEqual(
          defaultViewport.width,
        );

        const unpinned = layoutCallouts(
          speakerCallouts,
          speakerShape,
          backCamera,
          defaultViewport,
          null,
          null,
          [],
        ).find(item => item.id === 'tweeter');
        expect(unpinned?.pinned).toBe(false);
      });

      it('игнорирует закрепление неизвестной выноски', async () => {
        const controller = createCalloutController(readySource(), 'graphite');
        await flush();

        controller.togglePin('нет-такой');
        expect(controller.getState().pinnedIds).toHaveLength(0);
        controller.dispose();
      });
    });
  });
});
