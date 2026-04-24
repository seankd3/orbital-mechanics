(function (root) {
    'use strict';

    const DEFAULT_MAX_SAMPLES = 600;
    const EXTREMA_FIELDS = [
        { key: 'alt', label: 'altitude' },
        { key: 'vel', label: 'velocity' },
        { key: 'fuel', label: 'fuel' }
    ];
    const CSV_COLUMNS = [
        ['i', 'sample'],
        ['t', 'mission_time_s'],
        ['phase', 'phase'],
        ['body', 'body'],
        ['vehicle', 'vehicle'],
        ['alt', 'altitude_m'],
        ['vel', 'velocity_mps'],
        ['fuel', 'fuel_percent'],
        ['sps', 'sps_fuel_percent'],
        ['rcs', 'rcs_fuel_percent'],
        ['mass', 'mass_kg'],
        ['warp', 'time_warp'],
        ['thrust', 'thrusting'],
        ['rcsOn', 'rcs_thrusting']
    ];

    class ApolloTelemetryRecorder {
        constructor(options) {
            if (typeof options === 'number') options = { maxSamples: options };
            options = options || {};
            this.maxSamples = boundedInteger(options.maxSamples, DEFAULT_MAX_SAMPLES);
            this.samples = [];
            this.buffer = this.samples;
            this.nextSampleId = 1;
            this.extrema = createEmptyExtrema();
        }

        record(scene, mission, spacecraft) {
            const sample = this.createSample(scene, mission, spacecraft);
            this.samples.push(sample);

            if (this.samples.length > this.maxSamples) {
                this.samples.splice(0, this.samples.length - this.maxSamples);
                this.recomputeExtrema();
            } else {
                this.updateExtrema(sample);
            }

            return cloneSample(sample);
        }

        sample(scene, mission, spacecraft) {
            return this.record(scene, mission, spacecraft);
        }

        createSample(scene, mission, spacecraft) {
            mission = mission || getNested(scene, 'mission') || null;
            spacecraft = spacecraft ||
                getNested(mission, 'spacecraft') ||
                getNested(scene, 'spacecraft') ||
                null;

            const body =
                getNested(mission, 'primaryBody') ||
                getNested(scene, 'primaryBody') ||
                getNested(scene, 'planet') ||
                getNested(mission, 'earth') ||
                null;

            const spsFuel = readFuelPercent(spacecraft, 'getSPSFuelPercent', 'spsPropellant', 'spsMaxPropellant');
            const rcsFuel = readFuelPercent(spacecraft, 'getRCSFuelPercent', 'rcsPropellant', 'rcsMaxPropellant');

            return {
                i: this.nextSampleId++,
                t: readNumber(mission, ['missionTime', 'elapsedTime', 'time']),
                phase: readString(mission, ['phase', 'missionPhase']) || '',
                body: readString(body, ['name', 'label']) || '',
                vehicle: readVehicle(spacecraft),
                alt: readAltitudeMeters(scene, mission, spacecraft, body),
                vel: readVelocityMetersPerSecond(scene, mission, spacecraft, body),
                fuel: readTotalFuelPercent(spacecraft, spsFuel, rcsFuel),
                sps: spsFuel,
                rcs: rcsFuel,
                mass: readMassKg(spacecraft),
                warp: readNumber(getNested(scene, 'timeWarp'), ['factor']),
                thrust: readBoolean(spacecraft, ['isThrusting']),
                rcsOn: readBoolean(spacecraft, ['isRCSThrusting'])
            };
        }

        getSamples() {
            return this.samples.map(cloneSample);
        }

        getLatestSample() {
            return cloneSample(this.samples[this.samples.length - 1] || null);
        }

        getMinMaxSnapshots() {
            return cloneExtrema(this.extrema);
        }

        getStats() {
            return this.getMinMaxSnapshots();
        }

        setMaxSamples(maxSamples) {
            this.maxSamples = boundedInteger(maxSamples, this.maxSamples);
            if (this.samples.length > this.maxSamples) {
                this.samples.splice(0, this.samples.length - this.maxSamples);
                this.recomputeExtrema();
            }
            return this.maxSamples;
        }

        clear() {
            this.samples.length = 0;
            this.buffer = this.samples;
            this.extrema = createEmptyExtrema();
            return this;
        }

        reset() {
            this.clear();
            this.nextSampleId = 1;
            return this;
        }

        exportCSV() {
            const header = CSV_COLUMNS.map((column) => column[1]).join(',');
            const rows = this.samples.map((sample) => {
                return CSV_COLUMNS.map((column) => csvCell(sample[column[0]])).join(',');
            });
            return [header].concat(rows).join('\n');
        }

        toCSV() {
            return this.exportCSV();
        }

        exportCsv() {
            return this.exportCSV();
        }

        toCsv() {
            return this.exportCSV();
        }

        getExtrema() {
            return this.getMinMaxSnapshots();
        }

        updateExtrema(sample) {
            EXTREMA_FIELDS.forEach((field) => {
                const value = sample[field.key];
                if (!isFiniteNumber(value)) return;

                const current = this.extrema[field.label];
                if (!current.min || value < current.min[field.key]) {
                    current.min = cloneSample(sample);
                }
                if (!current.max || value > current.max[field.key]) {
                    current.max = cloneSample(sample);
                }
            });
        }

        recomputeExtrema() {
            this.extrema = createEmptyExtrema();
            this.samples.forEach((sample) => this.updateExtrema(sample));
        }
    }

    function createEmptyExtrema() {
        return {
            altitude: { min: null, max: null },
            velocity: { min: null, max: null },
            fuel: { min: null, max: null }
        };
    }

    function cloneExtrema(extrema) {
        const cloned = createEmptyExtrema();
        EXTREMA_FIELDS.forEach((field) => {
            cloned[field.label].min = cloneSample(extrema[field.label].min);
            cloned[field.label].max = cloneSample(extrema[field.label].max);
        });
        return cloned;
    }

    function cloneSample(sample) {
        if (!sample) return null;
        const cloned = {};
        Object.keys(sample).forEach((key) => {
            cloned[key] = sample[key];
        });
        return cloned;
    }

    function boundedInteger(value, fallback) {
        const number = Number(value);
        if (!Number.isFinite(number) || number < 1) return fallback;
        return Math.max(1, Math.floor(number));
    }

    function readAltitudeMeters(scene, mission, spacecraft, body) {
        const direct = firstFinite(
            readNumber(spacecraft, ['altitudeMeters', 'altitudeM', 'altitude']),
            readNumber(mission, ['altitudeMeters', 'altitudeM', 'altitude']),
            readNumber(scene, ['altitudeMeters', 'altitudeM', 'altitude'])
        );
        if (direct !== null) return direct;

        if (!spacecraft || !body) return null;

        const spacecraftPosition = getNested(spacecraft, 'position') || getNested(spacecraft, 'mesh.position');
        const bodyPosition = getNested(body, 'mesh.position') || getNested(body, 'position');
        const visualDistance = vectorDistance(spacecraftPosition, bodyPosition);
        const visualRadius = readNumber(body, ['radius']);

        if (!isFiniteNumber(visualDistance) || !isFiniteNumber(visualRadius)) return null;
        return toRealWorldDistance(visualDistance) - toRealWorldDistance(visualRadius);
    }

    function readVelocityMetersPerSecond(scene, mission, spacecraft, body) {
        const direct = firstFinite(
            readNumber(spacecraft, ['velocityMetersPerSecond', 'velocityMps', 'speedMetersPerSecond', 'speedMps', 'speed']),
            readNumber(mission, ['velocityMetersPerSecond', 'velocityMps', 'speedMetersPerSecond', 'speedMps', 'speed']),
            readNumber(scene, ['velocityMetersPerSecond', 'velocityMps', 'speedMetersPerSecond', 'speedMps', 'speed'])
        );
        if (direct !== null) return direct;

        const spacecraftVelocity = getNested(spacecraft, 'velocity');
        const bodyVelocity = getNested(body, 'velocity');
        const visualSpeed = bodyVelocity ?
            vectorDifferenceLength(spacecraftVelocity, bodyVelocity) :
            vectorLength(spacecraftVelocity);

        return isFiniteNumber(visualSpeed) ? toRealWorldVelocity(visualSpeed) : null;
    }

    function readFuelPercent(spacecraft, methodName, amountName, maxName) {
        if (!spacecraft) return null;

        const fromMethod = callNumber(spacecraft, methodName);
        if (fromMethod !== null) return clampPercent(fromMethod);

        const direct = methodName === 'getSPSFuelPercent' ?
            readNumber(spacecraft, ['spsFuelPercent', 'spsPercent']) :
            readNumber(spacecraft, ['rcsFuelPercent', 'rcsPercent']);
        if (direct !== null) return clampPercent(direct);

        const amount = readNumber(spacecraft, [amountName]);
        const max = readNumber(spacecraft, [maxName]);
        if (!isFiniteNumber(amount) || !isFiniteNumber(max) || max <= 0) return null;

        return clampPercent((amount / max) * 100);
    }

    function readTotalFuelPercent(spacecraft, spsFuel, rcsFuel) {
        const direct = readNumber(spacecraft, ['fuelPercent', 'fuelPct', 'fuel']);
        if (direct !== null) return clampPercent(direct);

        const spsAmount = readNumber(spacecraft, ['spsPropellant']);
        const spsMax = readNumber(spacecraft, ['spsMaxPropellant']);
        const rcsAmount = readNumber(spacecraft, ['rcsPropellant']);
        const rcsMax = readNumber(spacecraft, ['rcsMaxPropellant']);

        const knownSps = isFiniteNumber(spsAmount) && isFiniteNumber(spsMax) && spsMax > 0;
        const knownRcs = isFiniteNumber(rcsAmount) && isFiniteNumber(rcsMax) && rcsMax > 0;

        if (knownSps || knownRcs) {
            const amount = (knownSps ? spsAmount : 0) + (knownRcs ? rcsAmount : 0);
            const max = (knownSps ? spsMax : 0) + (knownRcs ? rcsMax : 0);
            return max > 0 ? clampPercent((amount / max) * 100) : null;
        }

        if (spsFuel !== null) return spsFuel;
        return rcsFuel;
    }

    function readVehicle(spacecraft) {
        const label = callString(spacecraft, 'getVehicleLabel');
        if (label) return label;
        return readString(spacecraft, ['vehicleMode', 'mode', 'label']) || '';
    }

    function readMassKg(spacecraft) {
        const fromMethod = callNumber(spacecraft, 'getCurrentMass');
        if (fromMethod !== null) return fromMethod;
        return readNumber(spacecraft, ['mass', 'currentMass', 'massKg']);
    }

    function readNumber(source, keys) {
        if (!source) return null;
        for (let index = 0; index < keys.length; index++) {
            const value = getNested(source, keys[index]);
            if (isFiniteNumber(value)) return value;
        }
        return null;
    }

    function readString(source, keys) {
        if (!source) return '';
        for (let index = 0; index < keys.length; index++) {
            const value = getNested(source, keys[index]);
            if (typeof value === 'string') return value;
        }
        return '';
    }

    function readBoolean(source, keys) {
        if (!source) return false;
        for (let index = 0; index < keys.length; index++) {
            const value = getNested(source, keys[index]);
            if (typeof value === 'boolean') return value;
        }
        return false;
    }

    function callNumber(source, methodName) {
        if (!source || typeof source[methodName] !== 'function') return null;
        try {
            const value = source[methodName]();
            return isFiniteNumber(value) ? value : null;
        } catch (error) {
            return null;
        }
    }

    function callString(source, methodName) {
        if (!source || typeof source[methodName] !== 'function') return '';
        try {
            const value = source[methodName]();
            return typeof value === 'string' ? value : '';
        } catch (error) {
            return '';
        }
    }

    function getNested(source, path) {
        if (!source || !path) return null;
        const parts = path.split('.');
        let value = source;
        for (let index = 0; index < parts.length; index++) {
            if (!value || typeof value !== 'object') return null;
            value = value[parts[index]];
        }
        return value === undefined ? null : value;
    }

    function firstFinite() {
        for (let index = 0; index < arguments.length; index++) {
            if (isFiniteNumber(arguments[index])) return arguments[index];
        }
        return null;
    }

    function isFiniteNumber(value) {
        return typeof value === 'number' && Number.isFinite(value);
    }

    function clampPercent(value) {
        if (!isFiniteNumber(value)) return null;
        return Math.max(0, Math.min(100, value));
    }

    function vectorDistance(a, b) {
        if (!a) return null;
        if (b && typeof a.distanceTo === 'function') {
            return a.distanceTo(b);
        }

        const ax = readCoordinate(a, 'x');
        const ay = readCoordinate(a, 'y');
        const az = readCoordinate(a, 'z');
        const bx = b ? readCoordinate(b, 'x') : 0;
        const by = b ? readCoordinate(b, 'y') : 0;
        const bz = b ? readCoordinate(b, 'z') : 0;

        if (![ax, ay, az, bx, by, bz].every(isFiniteNumber)) return null;
        const dx = ax - bx;
        const dy = ay - by;
        const dz = az - bz;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    function vectorDifferenceLength(a, b) {
        if (!a) return null;
        const ax = readCoordinate(a, 'x');
        const ay = readCoordinate(a, 'y');
        const az = readCoordinate(a, 'z');
        const bx = readCoordinate(b, 'x');
        const by = readCoordinate(b, 'y');
        const bz = readCoordinate(b, 'z');

        if (![ax, ay, az, bx, by, bz].every(isFiniteNumber)) return null;
        const dx = ax - bx;
        const dy = ay - by;
        const dz = az - bz;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    }

    function vectorLength(vector) {
        if (!vector) return null;
        if (typeof vector.length === 'function') {
            const value = vector.length();
            return isFiniteNumber(value) ? value : null;
        }

        const x = readCoordinate(vector, 'x');
        const y = readCoordinate(vector, 'y');
        const z = readCoordinate(vector, 'z');
        if (![x, y, z].every(isFiniteNumber)) return null;
        return Math.sqrt(x * x + y * y + z * z);
    }

    function readCoordinate(vector, key) {
        if (!vector) return null;
        const value = vector[key];
        return isFiniteNumber(value) ? value : null;
    }

    function toRealWorldDistance(value) {
        const scaleManager = root && root.scaleManager;
        if (scaleManager && typeof scaleManager.toRealWorld === 'function') {
            const converted = scaleManager.toRealWorld(value);
            return isFiniteNumber(converted) ? converted : value;
        }
        return value;
    }

    function toRealWorldVelocity(value) {
        const scaleManager = root && root.scaleManager;
        if (scaleManager && typeof scaleManager.velocityToRealWorld === 'function') {
            const converted = scaleManager.velocityToRealWorld(value);
            return isFiniteNumber(converted) ? converted : value;
        }
        if (scaleManager && typeof scaleManager.toRealWorld === 'function') {
            const converted = scaleManager.toRealWorld(value);
            return isFiniteNumber(converted) ? converted : value;
        }
        return value;
    }

    function csvCell(value) {
        if (value === null || value === undefined) return '';
        if (typeof value === 'boolean') return value ? '1' : '0';
        if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';

        const text = String(value);
        if (/[",\n\r]/.test(text)) {
            return '"' + text.replace(/"/g, '""') + '"';
        }
        return text;
    }

    root.ApolloTelemetryRecorder = ApolloTelemetryRecorder;
})(typeof window !== 'undefined' ? window : globalThis);
