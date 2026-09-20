import { describe, expect, it } from 'vitest';
import { createCalloutController, speakerCallouts } from '@target/index';
import type { CalloutSet, CalloutSource } from '@target/index';

interface Deferred {
  variantId: string;
  resolve: (set: CalloutSet) => void;
  reject: (error: unknown) => void;
  signal: AbortSignal;
}

/** Источник с ручным управлением: тест сам решает, когда придёт ответ. */
const createManualSource = () => {
  const pending: Deferred[] = [];
  let revision = 0;

  const source: CalloutSource = {
    load(variantId, signal) {
      return new Promise<CalloutSet>((resolve, reject) => {
        pending.push({ variantId, resolve, reject, signal });
      });
    },
  };

  return {
    source,
    pending,
    settle(index: number, callouts = speakerCallouts) {
      revision += 1;
      const item = pending[index];
      item.resolve({ variantId: item.variantId, revision, callouts });
    },
    fail(index: number, message = 'Сеть недоступна') {
      pending[index].reject(new Error(message));
    },
  };
};

const flush = () => new Promise(resolve => setTimeout(resolve, 0));

describe('Выноски на 3D-модели', () => {
  describe('Аннотации варианта', () => {
    describe('Загрузка набора', () => {
      it('запрашивает начальный вариант и показывает полученный набор', async () => {
        const manual = createManualSource();
        const controller = createCalloutController(manual.source, 'graphite');

        expect(controller.getState().phase).toBe('loading');
        expect(manual.pending).toHaveLength(1);
        expect(manual.pending[0].variantId).toBe('graphite');

        manual.settle(0);
        await flush();

        const state = controller.getState();
        expect(state.phase).toBe('ready');
        expect(state.shownVariantId).toBe('graphite');
        expect(state.callouts).toHaveLength(speakerCallouts.length);
        controller.dispose();
      });

      it('уведомляет подписчиков и снимает подписку по возвращённой функции', async () => {
        const manual = createManualSource();
        const controller = createCalloutController(manual.source, 'graphite');

        let calls = 0;
        const unsubscribe = controller.subscribe(() => {
          calls += 1;
        });

        manual.settle(0);
        await flush();
        expect(calls).toBeGreaterThan(0);

        const afterFirst = calls;
        unsubscribe();
        controller.selectVariant('ivory');
        await flush();

        expect(calls).toBe(afterFirst);
        controller.dispose();
      });

      it('повторяет запрос выбранного варианта по retry', async () => {
        const manual = createManualSource();
        const controller = createCalloutController(manual.source, 'graphite');

        manual.fail(0);
        await flush();
        expect(controller.getState().phase).toBe('error');

        controller.retry();
        expect(manual.pending).toHaveLength(2);
        expect(manual.pending[1].variantId).toBe('graphite');

        manual.settle(1);
        await flush();
        expect(controller.getState().phase).toBe('ready');
        controller.dispose();
      });
    });
  });
});
