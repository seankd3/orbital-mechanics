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
        this.createLatLonGrid();

        // Load coastlines asynchronously (pops in after grid is visible)
        this.loadCoastlines();
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
            color: 0x1f7cda,
            transparent: true,
            opacity: 0.7
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
                color: 0xffffff,
                transparent: true,
                opacity: 0.6
            });

            this.coastlineSegments = new THREE.LineSegments(geometry, material);
            this.mesh.add(this.coastlineSegments);
        } catch (err) {
            console.warn('Failed to load coastline data:', err);
        }
    }

    /**
     * Create an atmosphere glow effect using a Fresnel shader
     */
    createAtmosphere() {
        const atmosphereGeometry = new THREE.IcosahedronGeometry(this.radius * 1.03, 16);

        const vertexShader = `
            varying vec3 vNormal;
            varying vec3 vPosition;

            void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                vPosition = worldPosition.xyz;
                gl_Position = projectionMatrix * viewMatrix * worldPosition;
            }
        `;

        const fragmentShader = `
            uniform vec3 viewVector;
            varying vec3 vNormal;
            varying vec3 vPosition;

            void main() {
                vec3 eyeDir = normalize(viewVector - vPosition);
                float rimFactor = pow(1.0 - abs(dot(vNormal, eyeDir)), 3.0);
                gl_FragColor = vec4(0.12, 0.49, 0.85, rimFactor);
            }
        `;

        this.atmosphereMaterial = new THREE.ShaderMaterial({
            uniforms: {
                viewVector: { value: new THREE.Vector3() }
            },
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            side: THREE.BackSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false
        });

        const atmosphereMesh = new THREE.Mesh(atmosphereGeometry, this.atmosphereMaterial);
        this.mesh.add(atmosphereMesh);
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
