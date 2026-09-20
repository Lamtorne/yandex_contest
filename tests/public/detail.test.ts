import { describe, expect, it } from 'vitest';
import { createCalloutController, speakerCallouts } from '@target/index';
import type { CalloutDetail, CalloutSet, CalloutSource } from '@target/index';

const source: CalloutSource = {
  load: variantId =>
    Promise.resolve<CalloutSet>({ variantId, revision: 1, callouts: speakerCallouts }),
  loadDetail: (variantId, calloutId) =>
    Promise.resolve<CalloutDetail>({ variantId, calloutId, body: `${calloutId} @ ${variantId}` }),
};

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('Выноски на 3D-модели', () => {
  describe('Подробности аннотации', () => {
    describe('Раскрытие и сворачивание', () => {
      it('раскрывает подробности и показывает пришедший текст', async () => {
        const controller = createCalloutController(source, 'graphite');
        await flush();

        controller.toggleDetail('mic-array');
        expect(controller.getState().detail.calloutId).toBe('mic-array');
        expect(controller.getState().detail.phase).toBe('loading');

        await flush();
        const state = controller.getState();
        expect(state.detail.phase).toBe('ready');
        expect(state.detail.body).toBe('mic-array @ graphite');
        controller.dispose();
      });

      it('сворачивает подробности повторным вызовом', async () => {
        const controller = createCalloutController(source, 'graphite');
        await flush();

        controller.toggleDetail('mic-array');
        await flush();
        controller.toggleDetail('mic-array');

        const state = controller.getState();
        expect(state.detail.calloutId).toBeNull();
        expect(state.detail.phase).toBe('idle');
        expect(state.detail.body).toBeNull();
        controller.dispose();
      });

      it('раскрывает не более одной аннотации за раз', async () => {
        const controller = createCalloutController(source, 'graphite');
        await flush();

        controller.toggleDetail('mic-array');
        await flush();
        controller.toggleDetail('fabric');
        await flush();

        const state = controller.getState();
        expect(state.detail.calloutId).toBe('fabric');
        expect(state.detail.body).toBe('fabric @ graphite');
        controller.dispose();
      });

      it('игнорирует раскрытие неизвестной аннотации', async () => {
        const controller = createCalloutController(source, 'graphite');
        await flush();

        controller.toggleDetail('нет-такой');
        expect(controller.getState().detail.calloutId).toBeNull();
        controller.dispose();
      });
    });
  });
});
