import type { Callout, CalloutIndexEntry, SurfaceLayouts } from './types';

/** Идентификатор главной сцены карточки. */
const PRIMARY_SURFACE = 'main';

/**
 * Указатель аннотаций в порядке, в котором их отдал сервер:
 * каталог уже присылает элементы в порядке обхода корпуса сверху вниз.
 */
export const buildCalloutIndex = (
  callouts: readonly Callout[],
  layouts: SurfaceLayouts,
  pinnedIds: readonly string[] = [],
): readonly CalloutIndexEntry[] => {
  void pinnedIds; // закрепление выносок ещё не поддержано
  const surfaceIds = Object.keys(layouts).sort();

  return callouts.map((callout, position) => ({
    id: callout.id,
    number: position + 1,
    text: callout.text,
    visibleOn: surfaceIds.filter(surfaceId =>
      (layouts[surfaceId] ?? []).some(item => item.id === callout.id && !item.hidden),
    ),
    pinned: false,
  }));
};

/** В легенду и спецификацию идёт то, что покупатель видит на главной сцене. */
export const listedEntries = (
  index: readonly CalloutIndexEntry[],
): readonly CalloutIndexEntry[] =>
  index.filter(entry => entry.visibleOn.includes(PRIMARY_SURFACE));

/** Спецификация нумеруется подряд, чтобы в скопированном тексте не было пропусков. */
export const formatSpecification = (index: readonly CalloutIndexEntry[]): string =>
  listedEntries(index)
    .map((entry, position) => `${position + 1}. ${entry.text}`)
    .join('\n');
