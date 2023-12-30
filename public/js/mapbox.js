/* eslint-disable */

export const displayMap = locations => {
  mapboxgl.accessToken =
    'pk.eyJ1Ijoic2FpZG5hZGVyMTk4NyIsImEiOiJjbHFlOGdvY3MwYjhzMmpxeXI3eGliNDZoIn0.0gDozjH2JmR8p3LlCDTOKQ';
  var map = new mapboxgl.Map({
    container: 'map',
    style: 'mapbox://styles/saidnader1987/clqe920ic006901qh8wjxd0oq',
    scrollZoom: false
    // center: [-118.113, 34.1111745], // expects lng, lat
    // zoom: 10, // zoom level
    // interactive: false // map looks like a simple image, no scroll no pan
  });

  const bounds = new mapboxgl.LngLatBounds();

  locations.forEach(loc => {
    // Create marker
    const el = document.createElement('div');
    el.className = 'marker';

    // Add marker
    new mapboxgl.Marker({
      element: el,
      anchor: 'bottom'
    })
      .setLngLat(loc.coordinates)
      .addTo(map);

    // Add popup
    new mapboxgl.Popup({
      offset: 30
    })
      .setLngLat(loc.coordinates)
      .setHTML(`<p>Day ${loc.day}: ${loc.description}</p>`)
      .addTo(map);

    // Extend map bounds to include current location
    bounds.extend(loc.coordinates);
  });

  map.fitBounds(bounds, {
    padding: {
      top: 200,
      bottom: 150,
      left: 100,
      right: 100
    }
  });
};
