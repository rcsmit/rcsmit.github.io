// Your coordinates (replace with your actual data)
const coordinates = [
    { lat: 40.712776, lng: -74.005974 },
    { lat: 51.505, lng: -0.09 },
    { lat: 37.7749, lng: -122.4194 },
  ];
  
  // Create the map
  const map = L.map('map').setView([51.505, -0.09], 13); // Initial location and zoom
  
  // Add base tiles (map background)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  
  // Add markers for each coordinate
  coordinates.forEach((coordinate) => {
    const marker = L.marker([coordinate.lat, coordinate.lng]).addTo(map);
    marker.bindPopup(`Latitude: ${coordinate.lat}, Longitude: ${coordinate.lng}`);
  });
  