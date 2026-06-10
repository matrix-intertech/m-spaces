const fs = require('fs');
const https = require('https');
const path = require('path');

const INDIA_BOUNDARY_URL = 'https://raw.githubusercontent.com/datameet/maps/master/Country/india-soi.geojson';
const COUNTRY_BOUNDARIES_URL = 'https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson';
const DEST_DIR = path.join(__dirname, '../frontend/public/assets');
const INDIA_BOUNDARY_FILE = path.join(DEST_DIR, 'india-official-boundary.geojson');
const COUNTRY_BOUNDARIES_FILE = path.join(DEST_DIR, 'country-boundaries.geojson');
const CLEANED_COUNTRY_BOUNDARIES_FILE = path.join(DEST_DIR, 'country-boundaries-cleaned.geojson');
const NORTHERN_INDIA_BOUNDARY_MASK_BBOX = [70, 28, 83, 38];

if (!fs.existsSync(DEST_DIR)) {
    fs.mkdirSync(DEST_DIR, { recursive: true });
}

const downloadFile = (url, destination, label, onDone) => {
    console.log(`Downloading ${label}...`);
    https.get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
            return downloadFile(res.headers.location, destination, label, onDone);
        }

        if (res.statusCode !== 200) {
            console.error(`Failed to download ${label}: HTTP ${res.statusCode}`);
            return;
        }

        const fileStream = fs.createWriteStream(destination);
        res.pipe(fileStream);

        fileStream.on('finish', () => {
            fileStream.close();
            console.log(`Successfully downloaded ${label} to:\n${destination}`);
            if (typeof onDone === 'function') onDone();
        });
    }).on('error', (err) => {
        console.error(`Error downloading ${label}:`, err.message);
    });
};

const isIndiaFeature = (feature) => {
    const properties = feature && feature.properties ? feature.properties : {};
    const name = String(properties.name || properties.NAME || '').toLowerCase();
    const alpha2 = String(properties['ISO3166-1-Alpha-2'] || properties.iso_a2 || properties.ISO_A2 || '').toUpperCase();
    const alpha3 = String(properties['ISO3166-1-Alpha-3'] || properties.iso_a3 || properties.ISO_A3 || '').toUpperCase();
    return name === 'india' || alpha2 === 'IN' || alpha3 === 'IND';
};

const bboxIntersects = (a, b) => (
    a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
);

const getGeoJsonBbox = (geoData) => {
    const bbox = [Infinity, Infinity, -Infinity, -Infinity];
    const visit = (coordinates) => {
        if (!Array.isArray(coordinates)) return;
        if (typeof coordinates[0] === 'number' && typeof coordinates[1] === 'number') {
            bbox[0] = Math.min(bbox[0], coordinates[0]);
            bbox[1] = Math.min(bbox[1], coordinates[1]);
            bbox[2] = Math.max(bbox[2], coordinates[0]);
            bbox[3] = Math.max(bbox[3], coordinates[1]);
            return;
        }
        coordinates.forEach(visit);
    };

    const features = geoData.type === 'FeatureCollection' ? geoData.features : [geoData];
    features.forEach((feature) => {
        const geometry = feature.type === 'Feature' ? feature.geometry : feature;
        if (!geometry) return;
        if (geometry.type === 'GeometryCollection') {
            geometry.geometries.forEach((childGeometry) => {
                if (childGeometry.type !== 'GeometryCollection') visit(childGeometry.coordinates);
            });
            return;
        }
        visit(geometry.coordinates);
    });

    return Number.isFinite(bbox[0]) ? bbox : null;
};

const extractPolygons = (geoData) => {
    const features = geoData.type === 'FeatureCollection' ? geoData.features : [geoData];
    const polygons = [];

    features.forEach((feature) => {
        const geometry = feature.type === 'Feature' ? feature.geometry : feature;
        if (!geometry) return;
        if (geometry.type === 'Polygon') polygons.push(geometry.coordinates);
        if (geometry.type === 'MultiPolygon') polygons.push(...geometry.coordinates);
    });

    return polygons;
};

const pointInRing = (point, ring) => {
    const x = point[0];
    const y = point[1];
    let inside = false;

    for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const xi = ring[i][0];
        const yi = ring[i][1];
        const xj = ring[j][0];
        const yj = ring[j][1];
        const intersects = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
        if (intersects) inside = !inside;
    }

    return inside;
};

const pointInOfficialIndia = (point, indiaPolygons) => (
    indiaPolygons.some((polygon) => {
        if (!polygon.length || !pointInRing(point, polygon[0])) return false;
        return !polygon.slice(1).some((hole) => pointInRing(point, hole));
    })
);

const clipGeometryAgainstIndia = (geometry, indiaPolygons) => {
    if (!geometry) return geometry;
    if (geometry.type !== 'Polygon' && geometry.type !== 'MultiPolygon') return geometry;

    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;
    const lines = [];

    polygons.forEach((polygon) => {
        polygon.forEach((ring) => {
            let currentLine = [];

            for (let index = 0; index < ring.length - 1; index += 1) {
                const start = ring[index];
                const end = ring[index + 1];
                const midpoint = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
                const segmentBbox = [
                    Math.min(start[0], end[0], midpoint[0]),
                    Math.min(start[1], end[1], midpoint[1]),
                    Math.max(start[0], end[0], midpoint[0]),
                    Math.max(start[1], end[1], midpoint[1])
                ];
                const isInsideIndia = (
                    bboxIntersects(segmentBbox, NORTHERN_INDIA_BOUNDARY_MASK_BBOX) &&
                    (
                        pointInOfficialIndia(start, indiaPolygons) ||
                        pointInOfficialIndia(end, indiaPolygons) ||
                        pointInOfficialIndia(midpoint, indiaPolygons)
                    )
                );

                if (isInsideIndia) {
                    if (currentLine.length > 1) lines.push(currentLine);
                    currentLine = [];
                } else if (currentLine.length === 0) {
                    currentLine = [start, end];
                } else {
                    currentLine.push(end);
                }
            }

            if (currentLine.length > 1) lines.push(currentLine);
        });
    });

    return lines.length ? { type: 'MultiLineString', coordinates: lines } : null;
};

const writeCleanedCountryBoundaries = () => {
    const countries = JSON.parse(fs.readFileSync(COUNTRY_BOUNDARIES_FILE, 'utf8'));
    const india = JSON.parse(fs.readFileSync(INDIA_BOUNDARY_FILE, 'utf8'));
    const indiaPolygons = extractPolygons(india);

    const cleaned = {
        ...countries,
        features: countries.features.flatMap((feature) => {
            if (isIndiaFeature(feature)) return [];

            const featureBbox = getGeoJsonBbox(feature);
            if (!featureBbox || !bboxIntersects(featureBbox, NORTHERN_INDIA_BOUNDARY_MASK_BBOX)) return [feature];

            const clippedGeometry = clipGeometryAgainstIndia(feature.geometry, indiaPolygons);
            return clippedGeometry ? [{ ...feature, geometry: clippedGeometry }] : [];
        })
    };

    fs.writeFileSync(CLEANED_COUNTRY_BOUNDARIES_FILE, JSON.stringify(cleaned));
    console.log(`Successfully wrote cleaned country boundaries to:\n${CLEANED_COUNTRY_BOUNDARIES_FILE}`);
};

downloadFile(INDIA_BOUNDARY_URL, INDIA_BOUNDARY_FILE, 'Clean Survey of India GeoJSON (approx 11MB)', () => {
    downloadFile(COUNTRY_BOUNDARIES_URL, COUNTRY_BOUNDARIES_FILE, 'world country boundaries GeoJSON (approx 14MB)', () => {
        writeCleanedCountryBoundaries();
        console.log('Maps can now render corrected India and country boundary overlays from local assets.');
    });
});
