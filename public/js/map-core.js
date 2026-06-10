/**
 * MatrixSpaces - Core Map Utility
 * Handles Compliant GeoJSON Rendering, Caching, and Marker Clustering
 */
class MatrixMap {
    constructor(containerId, options = {}) {
        this.map = L.map(containerId).setView([options.lat || 20.5937, options.lng || 78.9629], options.zoom || 5);
        this.markers = L.markerClusterGroup({
            chunkedLoading: true,
            spiderfyOnMaxZoom: true,
            showCoverageOnHover: false,
            maxClusterRadius: 40
        });
        
        this.tileLayers = window.MatrixMapTiles || {
            clean: {
                url: 'https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png',
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                maxZoom: 20,
                subdomains: 'abcd'
            },
            street: {
                url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
                maxZoom: 20,
                subdomains: 'abcd'
            }
        };
        this.cleanLayer = L.tileLayer(this.tileLayers.clean.url, this.tileLayers.clean);
        this.streetLayer = L.tileLayer(this.tileLayers.street.url, this.tileLayers.street);
        this.baseLayer = (options.defaultMapView === 'street' ? this.streetLayer : this.cleanLayer).addTo(this.map);

        this.map.addLayer(this.markers);
        this.indiaLayer = null;
        this.globalLayer = null;
        this.poiLayer = null;
        this.addMapViewControl();
        
        // 1. Add Search/Geocoder Control (Like Google Maps Search Bar)
        if (options.useGeocoder && typeof L.Control.Geocoder !== 'undefined') {
            L.Control.geocoder({
                defaultMarkGeocode: false,
                geocoder: this.createPlacesGeocoder(),
                position: 'topleft'
            }).on('markgeocode', (e) => {
                const bbox = e.geocode.bbox;
                const poly = L.polygon([
                    bbox.getSouthEast(), bbox.getNorthEast(),
                    bbox.getNorthWest(), bbox.getSouthWest()
                ]);
                this.map.fitBounds(poly.getBounds());
                
                // Optional: Add a marker for the searched place
                L.marker(e.geocode.center).addTo(this.map).bindPopup(`<b>${e.geocode.name}</b>`).openPopup();
            }).addTo(this.map);
        }

        // Init compliant boundaries if requested
        if (options.enforceBorders) {
            this.loadCompliantIndiaBoundary();
        }

        // Init global country/state boundaries if requested
        if (options.showGlobalBorders) {
            this.loadGlobalBoundaries();
        }

        // 2. Add POI (Points of Interest) Toggle Control
        if (options.showPoiControl) {
            this.addPoiControl();
        }
    }

    createPlacesGeocoder() {
        return {
            geocode: (query, callback) => {
                if (!query || query.trim().length < 2) return callback([]);
                fetch(`/api/places/search?q=${encodeURIComponent(query.trim())}`)
                    .then(response => response.json())
                    .then(data => {
                        const results = (data.places || []).map(place => {
                            const lat = Number(place.lat);
                            const lon = Number(place.lon);
                            if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
                            const center = L.latLng(lat, lon);
                            return {
                                name: place.display_name,
                                center,
                                bbox: L.latLngBounds(center, center)
                            };
                        }).filter(Boolean);
                        callback(results);
                    })
                    .catch(() => callback([]));
            },
            reverse: (_location, _scale, callback) => callback([])
        };
    }

    /**
     * Fetches and renders official India boundary to obscure disputed OSM tiles
     * You must host 'india-official-boundary.geojson' in your /public/assets folder
     */
    async loadCompliantIndiaBoundary() {
        try {
            const geoData = await this.getOfficialIndiaBoundaryData();

            // Draw a standard map boundary line
            this.indiaLayer = L.geoJSON(geoData, {
                style: {
                    color: '#2563eb',
                    weight: 1.6,
                    opacity: 1,
                    fillColor: '#2563eb',
                    fillOpacity: 0.04,
                    dashArray: '5 5',
                    className: 'leaflet-custom-india-border'
                },
                onEachFeature: (feature, layer) => {
                    layer.on({
                        click: (e) => {
                            this.map.fitBounds(e.target.getBounds());
                        }
                    });
                }
            }).addTo(this.map);
            this.indiaLayer.bringToFront();

        } catch (error) {
            console.warn("India GeoJSON boundary overlay skipped:", error.message);
        }
    }

    /**
     * Fetches and renders local global country boundaries.
     */
    async loadGlobalBoundaries() {
        try {
            const url = '/assets/country-boundaries-cleaned.geojson';
            let geoData = window.matrixGlobalBoundaryGeoDataCache;

            if (!geoData && 'caches' in window) {
                const cache = await caches.open('matrix-geojson-v2');
                let response = await cache.match(url);

                if (!response) {
                    response = await fetch(url);
                    if (!response.ok) throw new Error('Global GeoJSON not found');
                    cache.put(url, response.clone());
                }
                geoData = await response.json();
            } else if (!geoData) {
                const response = await fetch(url);
                if (!response.ok) throw new Error('Global GeoJSON not found');
                geoData = await response.json();
            } else {
                geoData = window.matrixGlobalBoundaryGeoDataCache;
            }

            window.matrixGlobalBoundaryGeoDataCache = geoData;
            const countryBoundaryData = this.excludeIndiaFromGlobalBoundaries(geoData);
            this.globalLayer = L.geoJSON(countryBoundaryData, {
                style: {
                    color: '#2563eb',
                    weight: 1.6,
                    opacity: 0.9,
                    fillColor: 'transparent',
                    fillOpacity: 0,
                    dashArray: '5 5'
                }
            }).addTo(this.map);

            this.globalLayer.bringToFront();
            if (this.indiaLayer) this.indiaLayer.bringToFront();
        } catch (error) {
            console.warn("Global GeoJSON boundary overlay skipped:", error.message);
        }
    }

    async getOfficialIndiaBoundaryData() {
        let geoData = window.matrixMapGeoDataCache;

        if (!geoData) {
            const response = await fetch('/assets/india-official-boundary.geojson');
            if (!response.ok) throw new Error('India GeoJSON not found');
            geoData = await response.json();
            window.matrixMapGeoDataCache = geoData;
        }

        return geoData;
    }

    excludeIndiaFromGlobalBoundaries(geoData) {
        if (!geoData || !Array.isArray(geoData.features)) return geoData;

        return {
            ...geoData,
            features: geoData.features.filter((feature) => {
                const properties = feature && feature.properties ? feature.properties : {};
                const name = String(properties.name || properties.NAME || '').toLowerCase();
                const alpha2 = String(properties['ISO3166-1-Alpha-2'] || properties.iso_a2 || properties.ISO_A2 || '').toUpperCase();
                const alpha3 = String(properties['ISO3166-1-Alpha-3'] || properties.iso_a3 || properties.ISO_A3 || '').toUpperCase();
                return (
                    name !== 'india' &&
                    alpha2 !== 'IN' &&
                    alpha3 !== 'IND'
                );
            })
        };
    }

    addMapViewControl() {
        if (!L || !L.control || typeof L.control.layers !== 'function') return;

        L.control.layers({
            'Clean map': this.cleanLayer,
            'Street map': this.streetLayer
        }, null, {
            position: 'topright',
            collapsed: false
        }).addTo(this.map);
    }

    /**
     * Bulk load properties into Marker Cluster
     * @param {Array} properties 
     */
    loadProperties(properties) {
        this.markers.clearLayers(); // Debounce/reset

        properties.forEach(prop => {
            const coords = this.getPropertyCoordinates(prop);
            if (!coords) return;
            const { lat, lng } = coords;

            const propertyIcon = L.icon({ iconUrl: '/assets/property.png', iconSize: [32, 32], iconAnchor: [16, 32], popupAnchor: [0, -32] });
            const marker = L.marker([lat, lng], { icon: propertyIcon });
            
            const escapeHtml = (unsafe) => (unsafe || '').toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
            const s3BaseUrl = (window.MatrixSpaces && window.MatrixSpaces.s3BaseUrl) ? window.MatrixSpaces.s3BaseUrl : 'https://matrixspaces-uploads-590184011565-ap-south-1-an.s3.ap-south-1.amazonaws.com/';
            const photoStr = prop.photos && prop.photos.length > 0 ? prop.photos[0] : '';
            const imageUrl = photoStr ? (photoStr.startsWith('http') ? photoStr : ((photoStr.includes('/') || photoStr.length > 30) ? s3BaseUrl + photoStr : '/uploads/' + photoStr)) : 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=800&q=80';
            const verifiedBadge = prop.is_matrix_verified ? '<span style="position:absolute;top:6px;right:6px;background:rgba(255,255,255,0.8);backdrop-filter:blur(4px);color:#dc2626;font-size:10px;font-weight:700;padding:2px 6px;border-radius:9999px;border:1px solid rgba(255,255,255,0.5);">VERIFIED</span>' : '';

            const popupContent = `
            <div style="width:220px;font-family:sans-serif;padding:0;background:transparent;">
                <div style="height:110px;position:relative;">
                    <img src="${imageUrl}" style="width:100%;height:100%;object-fit:cover;" alt="${escapeHtml(prop.title)}" loading="lazy">
                    ${verifiedBadge}
                </div>
                <div style="padding:10px;">
                    <h4 style="margin:0 0 4px;font-size:13px;font-weight:700;color:#1e293b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(prop.title)}</h4>
                    <p style="margin:0 0 8px;font-size:11px;color:#475569;">${escapeHtml(prop.locality)}</p>
                    <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(255,255,255,0.4);padding-top:7px;">
                        <span style="font-weight:800;color:#0f172a;font-size:13px;">₹${Number(prop.final_price).toLocaleString()}</span>
                        <div style="display:flex;gap:4px;">
                            <a href="/property/${prop.id}#chat" style="background:rgba(212,175,55,0.9);color:#0F0F0F;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none;">Chat</a>
                            <a href="https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}" target="_blank" style="background:#DC143C;color:white;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:600;text-decoration:none;">Route</a>
                        </div>
                    </div>
                </div>
            </div>`;
            
            const popup = L.popup({ offset: [0, -30], closeButton: false, className: 'hover-popup', maxWidth: 240, minWidth: 220 }).setContent(popupContent);
            marker.bindPopup(popup);
            
            // Setup Map marker behaviors
            marker.on('mouseover', function () { this.openPopup(); });
            marker.on('mouseout', function () { this.closePopup(); });
            marker.on('click', () => { window.location.href = `/property/${prop.id}`; });

            this.markers.addLayer(marker);
        });
    }

    getPropertyCoordinates(prop) {
        const parsedLat = parseFloat(prop.latitude);
        const parsedLng = parseFloat(prop.longitude);

        if (this.isIndiaCoordinate(parsedLat, parsedLng)) {
            return { lat: parsedLat, lng: parsedLng };
        }

        if (this.isIndiaCoordinate(parsedLng, parsedLat)) {
            return { lat: parsedLng, lng: parsedLat };
        }

        const fallback = this.getFallbackCoordinates(`${prop.title || ''} ${prop.locality || ''} ${prop.city || ''} ${prop.address || ''}`.toLowerCase());
        return fallback ? { lat: fallback[0], lng: fallback[1] } : null;
    }

    isIndiaCoordinate(lat, lng) {
        return Number.isFinite(lat) && Number.isFinite(lng) && lat >= 6 && lat <= 38 && lng >= 68 && lng <= 98;
    }

    getFallbackCoordinates(text) {
        const places = [
            { match: ['greater noida'], coords: [28.4744, 77.5040] },
            { match: ['sector 51 noida', 'noida sector 51'], coords: [28.5850, 77.3700] },
            { match: ['noida'], coords: [28.5355, 77.3910] },
            { match: ['gurugram', 'gurgaon'], coords: [28.4595, 77.0266] },
            { match: ['ghaziabad'], coords: [28.6692, 77.4538] },
            { match: ['faridabad'], coords: [28.4089, 77.3178] },
            { match: ['new delhi', 'delhi'], coords: [28.6139, 77.2090] }
        ];
        const place = places.find((entry) => entry.match.some((token) => text.includes(token)));
        return place ? place.coords : null;
    }

    /**
     * Fetches and displays nearby places (like Google Maps POIs) using Overpass API
     */
    async loadNearbyPlaces(lat, lng, radius = 2000) {
        if (this.poiLayer) {
            this.map.removeLayer(this.poiLayer);
        }
        this.poiLayer = L.layerGroup().addTo(this.map);

        const safeRadius = Math.min(Math.max(Number(radius) || 2000, 250), 5000);

        // Query OpenStreetMap for amenities around the current map center.
        const query = `
            [out:json][timeout:12];
            (
              nwr(around:${safeRadius},${lat},${lng})["amenity"~"school|hospital|restaurant|cafe|bank|pharmacy|cinema"];
              nwr(around:${safeRadius},${lat},${lng})["shop"~"supermarket|convenience|mall"];
              nwr(around:${safeRadius},${lat},${lng})["public_transport"];
              nwr(around:${safeRadius},${lat},${lng})["railway"="station"];
            );
            out center 40;
        `;

        try {
            const response = await fetch('https://overpass-api.de/api/interpreter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
                body: new URLSearchParams({ data: query })
            });
            const data = await response.json();

            // Custom Map Pins for different places
            const icons = {
                'school': '🎓', 'hospital': '🏥', 'restaurant': '🍽️', 'cafe': '☕', 
                'bank': '🏦', 'pharmacy': '💊', 'supermarket': '🛒', 'convenience': '🏪',
                'mall': '🛍️', 'cinema': '🍿'
            };

            data.elements.forEach(node => {
                const nodeLat = node.lat || (node.center && node.center.lat);
                const nodeLon = node.lon || (node.center && node.center.lon);
                if (nodeLat && nodeLon && node.tags && node.tags.name) {
                    const type = node.tags.amenity || node.tags.shop || 'marker';
                    const emoji = icons[type] || '📍';
                    
                    const icon = L.divIcon({
                        html: `<div style="font-size: 14px; background: white; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.3); border: 1px solid #D4AF37;">${emoji}</div>`,
                        className: 'custom-poi-icon',
                        iconSize: [28, 28],
                        iconAnchor: [14, 14]
                    });

                    L.marker([nodeLat, nodeLon], { icon })
                        .bindPopup(`<div class="font-sans min-w-[150px]"><b class="text-[#111827] block mb-1">${node.tags.name}</b><span class="text-xs text-[#6B7280] uppercase tracking-wider font-bold">${type}</span></div>`)
                        .addTo(this.poiLayer);
                }
            });
        } catch (err) {
            console.error("Failed to load nearby places:", err);
        }
    }

    addPoiControl() {
        const PoiControl = L.Control.extend({
            options: { position: 'bottomleft' },
            onAdd: (map) => {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                container.innerHTML = `<button title="Find Nearby Amenities" style="width: 34px; height: 34px; background: white; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 16px; border-radius: 4px; color: #111827; box-shadow: 0 1px 5px rgba(0,0,0,0.4);" onmouseover="this.style.backgroundColor='#f4f4f4'" onmouseout="this.style.backgroundColor='white'">🏪</button>`;
                container.onclick = (e) => {
                    e.stopPropagation(); e.preventDefault();
                    const center = map.getCenter();
                    const btn = container.querySelector('button');
                    btn.innerHTML = '⏳';
                    this.loadNearbyPlaces(center.lat, center.lng, 3000).then(() => btn.innerHTML = '🏪');
                };
                return container;
            }
        });
        this.map.addControl(new PoiControl());
    }

    // Helper to safely destroy map contexts on DOM updates (SPA transitions)
    destroy() { this.map.remove(); }
}

// Expose explicitly to the global window object to prevent scope ReferenceErrors
window.MatrixMap = MatrixMap;
