import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SpeakerModel } from './SpeakerModel';
import { buildCalloutIndex, formatSpecification, listedEntries } from './calloutIndex';
import { layoutCallouts } from './layout';
import { LAYOUT, clampElevation } from './projection';
import type {
  Callout,
  CalloutController,
  CalloutIndexEntry,
  CalloutState,
  Camera,
  LabelWidths,
  ModelShape,
  PlacedCallout,
  ProductVariant,
  Size,
  SurfaceLayouts,
} from './types';

const ORBIT_SPEED = 0.4;

const normalizeAzimuth = (azimuth: number): number => ((azimuth % 360) + 360) % 360;

export interface CalloutSurfaceProps {
  surfaceId: string;
  title: string;
  placed: readonly PlacedCallout[];
  index: readonly CalloutIndexEntry[];
  shape: ModelShape;
  camera: Camera;
  viewport: Size;
  /** Вариант материала корпуса, показываемый в этой сцене. */
  variant?: string;
  interactive?: boolean;
  onOrbit?: (deltaX: number, deltaY: number) => void;
  onTogglePin?: (calloutId: string) => void;
  onToggleDetail?: (calloutId: string) => void;
}

/** Одна сцена карточки. Раскладку и нумерацию получает готовыми. */
export const CalloutSurface = ({
  surfaceId,
  title,
  placed,
  index,
  shape,
  camera,
  viewport,
  variant,
  interactive = true,
  onOrbit,
  onTogglePin,
  onToggleDetail,
}: CalloutSurfaceProps) => {
  const [dragging, setDragging] = useState(false);
  const visible = placed.filter(item => !item.hidden || item.pinned);
  // Выноски нумеруются сверху вниз, как на сборочном чертеже.
  const numbers = useMemo(() => {
    const byHeight = [...visible].sort((a, b) => a.labelBox.y - b.labelBox.y);
    return new Map(byHeight.map((item, position) => [item.id, position + 1]));
  }, [visible]);

  return (
    <figure className="surface" data-surface-id={surfaceId}>
      <figcaption className="surface-title">{title}</figcaption>
      <svg
        className="scene"
        width={viewport.width}
        height={viewport.height}
        viewBox={`0 0 ${viewport.width} ${viewport.height}`}
        role="img"
        aria-label={`${title}: 3D-модель умной колонки с аннотациями`}
        data-testid={`scene-${surfaceId}`}
        onPointerDown={event => {
          if (!interactive) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(true);
        }}
        onPointerMove={event => {
          if (!interactive || !dragging) return;
          onOrbit?.(event.movementX, event.movementY);
        }}
        onPointerUp={event => {
          if (!interactive) return;
          event.currentTarget.releasePointerCapture(event.pointerId);
          setDragging(false);
        }}
        onPointerCancel={() => setDragging(false)}
      >
        <SpeakerModel shape={shape} camera={camera} viewport={viewport} variant={variant} />

        {visible.map(item => {
          const labelCenterY = item.labelBox.y + item.labelBox.height / 2;
          const leaderX =
            item.side === 'left' ? item.labelBox.x + item.labelBox.width : item.labelBox.x;
          const number = numbers.get(item.id);

          return (
            <g
              key={item.id}
              className={item.hidden && item.pinned ? 'callout pinned-occluded' : 'callout'}
              data-callout-id={item.id}
              data-side={item.side}
              data-callout-number={number}
              data-pinned={item.pinned || undefined}
            >
              <line
                className="leader"
                x1={item.anchorScreen.x}
                y1={item.anchorScreen.y}
                x2={leaderX}
                y2={labelCenterY}
              />
              <circle
                className="marker"
                cx={item.anchorScreen.x}
                cy={item.anchorScreen.y}
                r={item.pinned ? 5 : 4}
                onPointerDown={event => event.stopPropagation()}
                onClick={event => {
                  event.stopPropagation();
                  onTogglePin?.(item.id);
                }}
              />
              <rect
                className="label-box"
                x={item.labelBox.x}
                y={item.labelBox.y}
                width={item.labelBox.width}
                height={item.labelBox.height}
                rx={6}
                onPointerDown={event => event.stopPropagation()}
                onClick={event => {
                  event.stopPropagation();
                  onToggleDetail?.(item.id);
                }}
              />
              <text
                className="label-text"
                x={item.labelBox.x + LAYOUT.labelPaddingX}
                y={labelCenterY + 4}
                {...(item.labelBox.width >= LAYOUT.maxLabelWidth
                  ? {
                      textLength: item.labelBox.width - LAYOUT.labelPaddingX * 2,
                      lengthAdjust: 'spacingAndGlyphs' as const,
                    }
                  : {})}
              >
                {number}. {index.find(entry => entry.id === item.id)?.text}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
};

export interface CalloutViewerProps {
  controller: CalloutController;
  variants: readonly ProductVariant[];
  shape: ModelShape;
  camera: Camera;
  viewport: Size;
}

const useControllerState = (controller: CalloutController): CalloutState => {
  const [state, setState] = useState(() => controller.getState());

  useEffect(() => {
    controller.subscribe(() => setState(controller.getState()));
  }, [controller]);

  return state;
};

/** Средняя ширина глифа основного шрифта карточки, px. */
const AVERAGE_GLYPH_WIDTH = 7.2;

/**
 * Ширины текста подписей. Оценка по числу символов избавляет от лишнего прохода
 * раскладки: ширины известны сразу, до первого рендера.
 */
const useLabelWidths = (
  root: React.RefObject<HTMLElement | null>,
  callouts: readonly Callout[],
): LabelWidths =>
  useMemo(() => {
    const widths = new Map<string, number>();
    for (const [position, callout] of callouts.entries()) {
      const label = String(position + 1) + '. ' + callout.text;
      widths.set(callout.id, Math.round(label.length * AVERAGE_GLYPH_WIDTH));
    }
    return widths.size > 0 ? widths : null;
  }, [callouts]);

const useSurfaceLayouts = (
  callouts: readonly Callout[],
  shape: ModelShape,
  cameras: Record<string, Camera>,
  viewports: Record<string, Size>,
  labelWidths: LabelWidths,
  pinnedIds: readonly string[],
): SurfaceLayouts => {
  const previousRef = useRef<Record<string, PlacedCallout[]>>({});

  const layouts = useMemo(() => {
    const next: Record<string, PlacedCallout[]> = {};
    for (const surfaceId of Object.keys(viewports)) {
      next[surfaceId] = layoutCallouts(
        callouts,
        shape,
        cameras[surfaceId],
        viewports[surfaceId],
        previousRef.current[surfaceId] ?? null,
        labelWidths,
        pinnedIds,
      );
    }
    return next;
  }, [callouts, shape, cameras, viewports, labelWidths, pinnedIds]);

  useEffect(() => {
    previousRef.current = layouts;
  }, [layouts]);

  return layouts;
};

export const CalloutViewer = ({
  controller,
  variants,
  shape,
  camera,
  viewport,
}: CalloutViewerProps) => {
  const state = useControllerState(controller);
  const [mainCamera, setMainCamera] = useState<Camera>(camera);
  const [copied, setCopied] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const labelWidths = useLabelWidths(rootRef, state.callouts);

  const viewports = useMemo(
    () => ({
      main: viewport,
      top: {
        width: Math.round(viewport.width * 0.62),
        height: Math.round(viewport.height * 0.62),
      },
    }),
    [viewport],
  );

  const cameras = useMemo(
    () => ({ main: mainCamera, top: { azimuth: mainCamera.azimuth, elevation: 78 } }),
    [mainCamera],
  );

  const layouts = useSurfaceLayouts(
    state.callouts,
    shape,
    cameras,
    viewports,
    labelWidths,
    state.pinnedIds,
  );
  const index = useMemo(
    () => buildCalloutIndex(state.callouts, layouts, state.pinnedIds),
    [state.callouts, layouts, state.pinnedIds],
  );
  const listed = useMemo(() => listedEntries(index), [index]);

  const orbit = useCallback((deltaX: number, deltaY: number) => {
    setMainCamera(previous => ({
      azimuth: normalizeAzimuth(previous.azimuth + deltaX * ORBIT_SPEED),
      elevation: clampElevation(previous.elevation - deltaY * ORBIT_SPEED),
    }));
  }, []);

  const shownTitle =
    variants.find(variant => variant.id === state.shownVariantId)?.title ?? '—';

  return (
    <div className="viewer" ref={rootRef}>
      <div className="variants" role="group" aria-label="Вариант товара">
        {variants.map(variant => (
          <button
            key={variant.id}
            type="button"
            className="variant"
            aria-pressed={variant.id === state.selectedVariantId}
            data-variant-id={variant.id}
            onClick={() => controller.selectVariant(variant.id)}
          >
            <span className="variant-swatch" aria-hidden="true" />
            {variant.title}
          </button>
        ))}
      </div>

      <div className="surfaces">
        <CalloutSurface
          surfaceId="main"
          title="Общий вид"
          placed={layouts.main ?? []}
          index={index}
          shape={shape}
          camera={cameras.main}
          viewport={viewports.main}
          variant={state.shownVariantId ?? undefined}
          onOrbit={orbit}
          onTogglePin={id => controller.togglePin(id)}
          onToggleDetail={id => controller.toggleDetail(id)}
        />
        <CalloutSurface
          surfaceId="top"
          title="Вид сверху"
          placed={layouts.top ?? []}
          index={index}
          shape={shape}
          camera={cameras.top}
          viewport={viewports.top}
          variant={state.shownVariantId ?? undefined}
          interactive={false}
          onTogglePin={id => controller.togglePin(id)}
          onToggleDetail={id => controller.toggleDetail(id)}
        />
      </div>

      <ol className="legend-list" data-testid="legend">
        {[...listed]
          .sort((a, b) => a.text.localeCompare(b.text, 'ru'))
          .map((entry, position) => ({ ...entry, number: position + 1 }))
          .map(entry => (
            <li
              key={entry.id}
              data-legend-id={entry.id}
              data-legend-number={entry.number}
              data-pinned={entry.pinned || undefined}
              onClick={() => controller.togglePin(entry.id)}
            >
              <span className="legend-number">{entry.number}.</span> {entry.text}
              {entry.pinned && <span className="legend-pin"> · закреплено</span>}
              <span className="legend-surfaces"> — {entry.visibleOn.join(', ')}</span>
            </li>
          ))}
      </ol>

      <div className="detail-panel" data-testid="detail-panel">
        {state.detail.calloutId === null && (
          <p className="detail-hint">Нажмите на подпись, чтобы увидеть подробности.</p>
        )}
        {state.detail.phase === 'loading' && (
          <p className="detail-loading" data-testid="detail-loading">
            Загружаем подробности…
          </p>
        )}
        {state.detail.phase === 'ready' && (
          <p className="detail-body" data-testid="detail-body" data-detail-id={state.detail.calloutId}>
            {state.detail.body}
          </p>
        )}
        {state.detail.phase === 'error' && (
          <p className="detail-error" data-testid="detail-error">
            Не удалось загрузить подробности
          </p>
        )}
      </div>

      <div className="spec">
        <button
          type="button"
          className="copy-spec"
          onClick={() => setCopied(true)}
          data-testid="copy-spec"
        >
          {copied ? 'Скопировано' : 'Скопировать спецификацию'}
        </button>
        <pre className="spec-text" data-testid="specification">
          {formatSpecification(index)}
        </pre>
      </div>

      <p className="status" role="status" data-testid="callouts-status">
        {state.phase === 'loading' && 'Загружаем аннотации варианта…'}
        {state.phase === 'ready' && `Аннотаций: ${listed.length} · вариант «${shownTitle}»`}
        {state.phase === 'error' && state.error}
      </p>

      {state.phase === 'error' && (
        <button type="button" className="retry" onClick={() => controller.retry()}>
          Повторить
        </button>
      )}
    </div>
  );
};
