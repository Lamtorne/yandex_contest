import React, { useMemo } from 'react';
import { CalloutViewer } from './CalloutViewer';
import { createCalloutController } from './calloutController';
import { createSpeakerCalloutSource, productVariants } from './calloutSource';
import { defaultViewport, initialCamera, speakerShape } from './fixtures';

export const App = () => {
  const controller = useMemo(
    () => createCalloutController(createSpeakerCalloutSource({ latencyMs: 350 }), productVariants[0].id),
    [],
  );

  return (
    <main className="page">
      <header className="page-head">
        <p className="eyebrow">Каталог · умные колонки</p>
        <h1>Атмосфера 2 Pro</h1>
        <p className="lede">
          Покрутите модель, чтобы рассмотреть корпус. Аннотации показывают, что находится на
          видимой стороне выбранного варианта.
        </p>
      </header>

      <CalloutViewer
        controller={controller}
        variants={productVariants}
        shape={speakerShape}
        camera={initialCamera}
        viewport={defaultViewport}
      />
    </main>
  );
};
