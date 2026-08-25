import { describe, it, expect } from 'vitest';
import { basemapLayerIds } from './basemapLayers';

describe('basemapLayerIds', () => {
  it('returns the verified layer ids for the OpenFreeMap liberty style', () => {
    const ids = basemapLayerIds('https://tiles.openfreemap.org/styles/liberty');
    expect(ids.boundaryLayerIds).toContain('boundary_2');
    expect(ids.cityLabelLayerIds).toContain('label_city');
  });

  it('degrades to empty arrays for an unrecognized style', () => {
    expect(basemapLayerIds('https://api.maptiler.com/maps/dataviz-dark/style.json?key=x')).toEqual({
      boundaryLayerIds: [],
      cityLabelLayerIds: [],
    });
  });
});
