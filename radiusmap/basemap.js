// version = "20260921-130000"
/** Adds the OpenFreeMap basemap to any Leaflet map. */
function addBaseMap(map, style = 'positron') {
  if (typeof L.maplibreGL !== 'function') {
    console.error('maplibre-gl-leaflet is not loaded.');
    return null;
  }
  return L.maplibreGL({
    style: `https://tiles.openfreemap.org/styles/${style}`,
    attribution:
      '<a href="https://openfreemap.org" target="_blank" rel="noopener noreferrer">OpenFreeMap</a> ' +
      '&copy; <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener noreferrer">OpenMapTiles</a> ' +
      'Data from <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
  }).addTo(map);
}