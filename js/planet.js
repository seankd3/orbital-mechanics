/**
 * Convert latitude/longitude (degrees) to a THREE.Vector3 on a sphere surface
 */
function latLonToVector3(lat, lon, radius) {
    const latRad = lat * Math.PI / 180;
    const lonRad = lon * Math.PI / 180;
    return new THREE.Vector3(
        radius * Math.cos(latRad) * Math.cos(lonRad),
        radius * Math.sin(latRad),
        -radius * Math.cos(latRad) * Math.sin(lonRad)
    );
}

/**
 * Planet class - handles planet creation and gravitational physics
 */
class Planet {
    constructor(params = {}) {
        // Default to Earth parameters if not specified
        this.radius = params.radius || 6371000; // meters (Earth: 6371 km)
        this.mass = params.mass || 5.972e24; // kg (Earth: 5.972 x 10^24 kg)
        this.name = params.name || 'Earth';
        this.rotationPeriod = params.rotationPeriod || 86400; // seconds (Earth: 24 hours)
        this.obliquity = params.obliquity || 23.44 * Math.PI / 180; // radians (Earth: 23.44 degrees)
        this.lineColor = params.lineColor || 0x1f7cda;
        this.gridOpacity = params.gridOpacity === undefined ? 0.7 : params.gridOpacity;
        this.coastlineColor = params.coastlineColor || 0xffffff;
        this.coastlineOpacity = params.coastlineOpacity === undefined ? 0.6 : params.coastlineOpacity;
        this.showGrid = params.showGrid !== false;
        this.showCoastlines = params.showCoastlines !== false;
        this.craters = params.craters || [];
        this.craterColor = params.craterColor || 0x9a9a9a;
        this.craterOpacity = params.craterOpacity === undefined ? 0.55 : params.craterOpacity;
        this.orbit = params.orbit || null;
        this.soiRadius = params.soiRadius || null;
        this.velocity = new THREE.Vector3();

        // Create the mesh
        this.createPlanetMesh();
    }

    /**
     * Create the planet mesh with black occluder sphere and lat/lon grid lines
     */
    createPlanetMesh() {
        this.mesh = new THREE.Group();

        // Solid black sphere for occlusion (IcosahedronGeometry detail 32 = smooth sphere)
        const occluderGeometry = new THREE.IcosahedronGeometry(this.radius, 32);
        const solidMaterial = new THREE.MeshBasicMaterial({
            color: 0x000000,
            polygonOffset: true,
            polygonOffsetFactor: 1,
            polygonOffsetUnits: 1
        });
        this.planetMesh = new THREE.Mesh(occluderGeometry, solidMaterial);
        this.mesh.add(this.planetMesh);

        // Generate lat/lon grid lines
        if (this.showGrid) {
            this.createLatLonGrid();
        }

        // Load coastlines asynchronously (pops in after grid is visible)
        if (this.showCoastlines) {
            this.loadCoastlines();
        }

        if (this.craters.length > 0) {
            this.createCraterLines();
        }
    }

    /**
     * Create latitude and longitude grid lines on the planet surface
     */
    createLatLonGrid() {
        const positions = [];
        const segmentsPerLine = 72; // 5-degree arc segments for smooth curves
        const r = this.radius * 1.001; // Slightly above surface to prevent z-fighting

        // Latitude lines every 15 degrees (-75 to +75, plus equator)
        for (let lat = -75; lat <= 75; lat += 15) {
            for (let i = 0; i < segmentsPerLine; i++) {
                const lon1 = (i / segmentsPerLine) * 360 - 180;
                const lon2 = ((i + 1) / segmentsPerLine) * 360 - 180;
                const p1 = latLonToVector3(lat, lon1, r);
                const p2 = latLonToVector3(lat, lon2, r);
                positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
            }
        }

        // Longitude lines every 15 degrees
        for (let lon = -180; lon < 180; lon += 15) {
            for (let i = 0; i < segmentsPerLine; i++) {
                const lat1 = (i / segmentsPerLine) * 180 - 90;
                const lat2 = ((i + 1) / segmentsPerLine) * 180 - 90;
                const p1 = latLonToVector3(lat1, lon, r);
                const p2 = latLonToVector3(lat2, lon, r);
                positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3));

        const material = new THREE.LineBasicMaterial({
            color: this.lineColor,
            transparent: true,
            opacity: this.gridOpacity
        });

        this.gridLines = new THREE.LineSegments(geometry, material);
        this.mesh.add(this.gridLines);
    }

    /**
     * Load coastline data from GeoJSON and render as line segments on the planet surface
     */
    async loadCoastlines() {
        try {
            const response = await fetch('assets/ne_50m_coastline.json');
            const geojson = await response.json();

            // Collect all line segment pairs into a flat array of positions
            const positions = [];

            for (const feature of geojson.features) {
                const geom = feature.geometry;
                let lines;

                if (geom.type === 'MultiLineString') {
                    lines = geom.coordinates;
                } else if (geom.type === 'LineString') {
                    lines = [geom.coordinates];
                } else {
                    continue;
                }

                for (const line of lines) {
                    for (let i = 0; i < line.length - 1; i++) {
                        const [lon1, lat1] = line[i];
                        const [lon2, lat2] = line[i + 1];

                        const p1 = latLonToVector3(lat1, lon1, this.radius);
                        const p2 = latLonToVector3(lat2, lon2, this.radius);

                        positions.push(p1.x, p1.y, p1.z);
                        positions.push(p2.x, p2.y, p2.z);
                    }
                }
            }

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3));

            const material = new THREE.LineBasicMaterial({
                color: this.coastlineColor,
                transparent: true,
                opacity: this.coastlineOpacity
            });

            this.coastlineSegments = new THREE.LineSegments(geometry, material);
            this.mesh.add(this.coastlineSegments);
        } catch (err) {
            console.warn('Failed to load coastline data:', err);
        }
    }

    /**
     * Create simple crater rim linework for airless bodies.
     */
    createCraterLines() {
        const positions = [];
        const surfaceRadius = this.radius * 1.002;

        for (let i = 0; i < this.craters.length; i++) {
            const crater = this.craters[i];
            const lat = crater.lat || 0;
            const lon = crater.lon || 0;
            const angularRadius = THREE.MathUtils.degToRad(crater.radiusDeg || 2);
            const segments = crater.segments || 36;

            const center = latLonToVector3(lat, lon, 1).normalize();
            let east = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), center);
            if (east.lengthSq() < 0.0001) {
                east = new THREE.Vector3().crossVectors(new THREE.Vector3(1, 0, 0), center);
            }
            east.normalize();
            const north = new THREE.Vector3().crossVectors(center, east).normalize();

            for (let j = 0; j < segments; j++) {
                const a1 = (j / segments) * Math.PI * 2;
                const a2 = ((j + 1) / segments) * Math.PI * 2;
                const p1 = center.clone().multiplyScalar(Math.cos(angularRadius))
                    .addScaledVector(east, Math.cos(a1) * Math.sin(angularRadius))
                    .addScaledVector(north, Math.sin(a1) * Math.sin(angularRadius))
                    .normalize()
                    .multiplyScalar(surfaceRadius);
                const p2 = center.clone().multiplyScalar(Math.cos(angularRadius))
                    .addScaledVector(east, Math.cos(a2) * Math.sin(angularRadius))
                    .addScaledVector(north, Math.sin(a2) * Math.sin(angularRadius))
                    .normalize()
                    .multiplyScalar(surfaceRadius);

                positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(positions), 3));

        const material = new THREE.LineBasicMaterial({
            color: this.craterColor,
            transparent: true,
            opacity: this.craterOpacity
        });

        this.craterLines = new THREE.LineSegments(geometry, material);
        this.mesh.add(this.craterLines);
    }

    /**
     * Calculate gravitational force on an object
     * @param {THREE.Vector3} objectPosition - Position of the object in real-world units
     * @param {number} objectMass - Mass of the object
     * @returns {THREE.Vector3} - Force vector in Newtons (real-world units)
     */
    calculateGravitationalForce(objectPosition, objectMass) {
        const distanceVector = objectPosition.clone().sub(this.mesh.position);
        const distance = distanceVector.length();

        const forceMagnitude = physics.G * (this.mass * objectMass) / (distance * distance);
        const forceVector = distanceVector.normalize().multiplyScalar(-forceMagnitude);

        return forceVector;
    }

    /**
     * Calculate escape velocity at given distance (real-world units)
     * @param {number} distance - Distance from planet center in meters
     * @returns {number} - Escape velocity in m/s
     */
    calculateEscapeVelocity(distance) {
        return Math.sqrt((2 * physics.G * this.mass) / distance);
    }

    /**
     * Calculate orbital velocity for a circular orbit at given distance (real-world units)
     * @param {number} distance - Distance from planet center in meters
     * @returns {number} - Orbital velocity in m/s
     */
    calculateOrbitalVelocity(distance) {
        return Math.sqrt((physics.G * this.mass) / distance);
    }

    /**
     * Update the planet (rotation, etc.)
     * @param {number} deltaTime - Time since last update in seconds
     */
    update(deltaTime) {
        const rotationAngle = (2 * Math.PI / this.rotationPeriod) * deltaTime;
        this.mesh.rotation.y += rotationAngle;
    }
}
