export { App } from './App';
export { CalloutSurface, CalloutViewer } from './CalloutViewer';
export type { CalloutSurfaceProps, CalloutViewerProps } from './CalloutViewer';
export { SpeakerModel } from './SpeakerModel';
export type { SpeakerModelProps } from './SpeakerModel';
export { createCalloutController } from './calloutController';
export { createSpeakerCalloutSource, productVariants } from './calloutSource';
export type { SpeakerCalloutSourceOptions } from './calloutSource';
export { layoutCallouts } from './layout';
export { buildWeave } from './weave';
export type { WeaveLine, WeaveLineKind } from './weave';
export {
  LAYOUT,
  WEAVE,
  MAX_ELEVATION_DEG,
  SCENE_SCALE,
  clampElevation,
  isAnchorVisible,
  modelSilhouette,
  orbitDirection,
  projectPoint,
  screenBasis,
  viewDirection,
} from './projection';
export {
  defaultViewport,
  initialCamera,
  speakerCallouts,
  speakerDesign,
  speakerShape,
  surfacePoint,
} from './fixtures';
export type {
  Callout,
  CalloutController,
  CalloutPhase,
  CalloutSet,
  CalloutSide,
  CalloutSource,
  CalloutState,
  Camera,
  ModelShape,
  PlacedCallout,
  ProductVariant,
  ProjectedPoint,
  Rect,
  Size,
  Vec2,
  Vec3,
} from './types';
