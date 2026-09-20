import type {
  CalloutController,
  CalloutDetail,
  CalloutSet,
  CalloutSource,
  CalloutState,
  DetailState,
} from './types';

const IDLE_DETAIL: DetailState = { calloutId: null, phase: 'idle', body: null };

/** Подробности принадлежат аннотации, поэтому ключ кэша — её идентификатор. */
const detailKey = (calloutId: string): string => calloutId;

const isAbortError = (error: unknown): boolean =>
  error instanceof DOMException && error.name === 'AbortError';

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'Не удалось загрузить аннотации';

/**
 * Единый владелец состояния аннотаций для всей карточки товара.
 *
 * Показанный набор и загружаемый живут одновременно: пока идёт запрос нового
 * варианта, на сцене остаётся прежний набор.
 */
export const createCalloutController = (
  source: CalloutSource,
  initialVariantId: string,
): CalloutController => {
  let state: CalloutState = {
    selectedVariantId: initialVariantId,
    shownVariantId: null,
    phase: 'loading',
    revision: 0,
    callouts: [],
    error: null,
    pinnedIds: [],
    detail: IDLE_DETAIL,
  };

  const listeners = new Set<() => void>();
  const detailCache = new Map<string, string>();
  let controller: AbortController | null = null;
  let detailController: AbortController | null = null;
  let disposed = false;

  const emit = () => {
    for (const listener of [...listeners]) listener();
  };

  const patch = (next: Partial<CalloutState>) => {
    state = { ...state, ...next };
    emit();
  };

  const accept = (set: CalloutSet) => {
    if (disposed) return;

    patch({
      shownVariantId: set.variantId,
      phase: 'ready',
      revision: set.revision,
      callouts: set.callouts,
      error: null,
      // Закрепление живёт, пока у показанного набора есть выноска с этим id.
      pinnedIds: state.pinnedIds.filter(id =>
        set.callouts.some(callout => callout.id === id),
      ),
    });
  };

  const requestDetail = (variantId: string, calloutId: string) => {
    if (disposed) return;

    detailController?.abort();
    detailController = new AbortController();

    source
      .loadDetail(variantId, calloutId, detailController.signal)
      .then(detail => acceptDetail(detail))
      .catch(error => failDetail(error, variantId, calloutId));
  };

  const acceptDetail = (detail: CalloutDetail) => {
    if (disposed) return;
    // Успешный ответ кэшируется всегда: он валиден для своей пары.
    detailCache.set(detailKey(detail.calloutId), detail.body);

    if (detail.variantId !== state.selectedVariantId) return;
    if (detail.calloutId !== state.detail.calloutId) return;

    patch({ detail: { calloutId: detail.calloutId, phase: 'ready', body: detail.body } });
  };

  const failDetail = (error: unknown, variantId: string, calloutId: string) => {
    if (disposed || isAbortError(error)) return;
    if (variantId !== state.selectedVariantId || calloutId !== state.detail.calloutId) return;

    patch({ detail: { calloutId, phase: 'error', body: null } });
  };

  const fail = (error: unknown) => {
    if (disposed || isAbortError(error)) return;

    patch({
      phase: 'error',
      error: errorMessage(error),
      callouts: [],
      shownVariantId: null,
    });
  };

  const request = () => {
    if (disposed) return;

    controller?.abort();
    controller = new AbortController();

    patch({ phase: 'loading', error: null, callouts: [], shownVariantId: null });

    source
      .load(state.selectedVariantId, controller.signal)
      .then(accept)
      .catch(fail);
  };

  request();

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    selectVariant(variantId) {
      if (disposed || variantId === state.selectedVariantId) return;
      state = { ...state, selectedVariantId: variantId };

      // Подробности показывают выбранный вариант, поэтому обновляем их сразу.
      const openId = state.detail.calloutId;
      if (openId) {
        const cached = detailCache.get(detailKey(openId));
        if (cached !== undefined) {
          state = { ...state, detail: { calloutId: openId, phase: 'ready', body: cached } };
        } else {
          state = { ...state, detail: { calloutId: openId, phase: 'loading', body: null } };
          requestDetail(variantId, openId);
        }
      }

      request();
    },

    toggleDetail(calloutId) {
      if (disposed) return;
      if (!state.callouts.some(callout => callout.id === calloutId)) return;

      if (state.detail.calloutId === calloutId) {
        detailController?.abort();
        patch({ detail: IDLE_DETAIL });
        return;
      }

      const variantId = state.selectedVariantId;

      const cached = detailCache.get(detailKey(calloutId));
      if (cached !== undefined) {
        detailController?.abort();
        patch({ detail: { calloutId, phase: 'ready', body: cached } });
        return;
      }

      patch({ detail: { calloutId, phase: 'loading', body: null } });
      requestDetail(variantId, calloutId);
    },

    togglePin(calloutId) {
      if (disposed) return;
      if (!state.callouts.some(callout => callout.id === calloutId)) return;
      patch({
        pinnedIds: state.pinnedIds.includes(calloutId)
          ? state.pinnedIds.filter(id => id !== calloutId)
          : [...state.pinnedIds, calloutId],
      });
    },

    retry() {
      if (disposed || state.phase === 'loading') return;
      request();
    },

    dispose() {
      disposed = true;
      controller?.abort();
      detailController?.abort();
      detailCache.clear();
      listeners.clear();
    },
  };
};
