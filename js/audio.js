/**
 * AudioEngine - Procedural audio for the orbital mechanics simulator.
 * Uses Web Audio API exclusively. No external audio files.
 * All sounds are generated programmatically.
 */
class AudioEngine {
    constructor() {
        this.initialized = false;
        this.audioContext = null;

        // Bus gain nodes
        this.masterGain = null;
        this.spsBus = null;
        this.rcsBus = null;
        this.alarmBus = null;
        this.ambientBus = null;

        // Active sound tracking
        this.activeSounds = {
            sps: null,      // { nodes: [], gains: [] }
            alarm: null,    // { nodes: [], gains: [], intervalId }
            ambient: null   // { nodes: [], gains: [] }
        };

        // State flags
        this.spsPlaying = false;
        this.alarmPlaying = false;
        this.ambientPlaying = false;

        // RCS throttle
        this._lastRCSTime = 0;

        // Pre-generated pink noise buffer (created on init)
        this._pinkNoiseBuffer = null;
    }

    /**
     * Create the AudioContext and all bus routing.
     * Must be called on a user interaction (keydown, click) to satisfy browser autoplay policy.
     */
    init() {
        if (this.initialized) return;

        var AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return;

        this.audioContext = new AudioCtx();

        // Master gain -> destination
        this.masterGain = this.audioContext.createGain();
        this.masterGain.gain.value = 0.3;
        this.masterGain.connect(this.audioContext.destination);

        // Bus gains -> master
        this.spsBus = this.audioContext.createGain();
        this.spsBus.gain.value = 1.0;
        this.spsBus.connect(this.masterGain);

        this.rcsBus = this.audioContext.createGain();
        this.rcsBus.gain.value = 1.0;
        this.rcsBus.connect(this.masterGain);

        this.alarmBus = this.audioContext.createGain();
        this.alarmBus.gain.value = 1.0;
        this.alarmBus.connect(this.masterGain);

        this.ambientBus = this.audioContext.createGain();
        this.ambientBus.gain.value = 1.0;
        this.ambientBus.connect(this.masterGain);

        // Pre-generate the pink noise buffer
        this._pinkNoiseBuffer = this._createPinkNoiseBuffer();

        this.initialized = true;

        // Start ambient hum
        this.startAmbient();
    }

    // -------------------------------------------------------
    // SPS Engine (Main Engine Rumble)
    // -------------------------------------------------------

    /**
     * Start the main engine sound.
     * Layer 1: 65Hz sine (fundamental tone)
     * Layer 2: 25Hz sine (sub-bass rumble)
     * Layer 3: Pink noise through 200Hz highpass filter
     */
    startSPS() {
        if (!this.initialized || !this.audioContext) return;
        if (this.spsPlaying) return;

        var now = this.audioContext.currentTime;
        var nodes = [];
        var gains = [];

        // Layer 1: 65Hz sine, gain 0.4
        var osc1 = this.audioContext.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = 65;
        var gain1 = this.audioContext.createGain();
        gain1.gain.setValueAtTime(0.001, now);
        gain1.gain.exponentialRampToValueAtTime(0.4, now + 0.3);
        osc1.connect(gain1);
        gain1.connect(this.spsBus);
        osc1.start(now);
        nodes.push(osc1);
        gains.push(gain1);

        // Layer 2: 25Hz sine, gain 0.3
        var osc2 = this.audioContext.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 25;
        var gain2 = this.audioContext.createGain();
        gain2.gain.setValueAtTime(0.001, now);
        gain2.gain.exponentialRampToValueAtTime(0.3, now + 0.3);
        osc2.connect(gain2);
        gain2.connect(this.spsBus);
        osc2.start(now);
        nodes.push(osc2);
        gains.push(gain2);

        // Layer 3: Pink noise through 200Hz highpass, gain 0.15
        var noiseSource = this.audioContext.createBufferSource();
        noiseSource.buffer = this._pinkNoiseBuffer;
        noiseSource.loop = true;
        var highpass = this.audioContext.createBiquadFilter();
        highpass.type = 'highpass';
        highpass.frequency.value = 200;
        var gain3 = this.audioContext.createGain();
        gain3.gain.setValueAtTime(0.001, now);
        gain3.gain.exponentialRampToValueAtTime(0.15, now + 0.3);
        noiseSource.connect(highpass);
        highpass.connect(gain3);
        gain3.connect(this.spsBus);
        noiseSource.start(now);
        nodes.push(noiseSource);
        nodes.push(highpass);
        gains.push(gain3);

        this.activeSounds.sps = { nodes: nodes, gains: gains };
        this.spsPlaying = true;
    }

    /**
     * Stop the main engine sound with a quick fade-out.
     */
    stopSPS() {
        if (!this.initialized || !this.audioContext) return;
        if (!this.spsPlaying || !this.activeSounds.sps) return;

        var now = this.audioContext.currentTime;
        var sps = this.activeSounds.sps;

        // Fade all gains to 0.001 over 0.1 seconds
        for (var i = 0; i < sps.gains.length; i++) {
            var g = sps.gains[i];
            g.gain.cancelScheduledValues(now);
            g.gain.setValueAtTime(g.gain.value || 0.001, now);
            g.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        }

        // Stop all nodes after fade completes
        var nodesToStop = sps.nodes.slice();
        setTimeout(function() {
            for (var j = 0; j < nodesToStop.length; j++) {
                try {
                    if (nodesToStop[j].stop) {
                        nodesToStop[j].stop();
                    }
                } catch (e) {
                    // Node may already be stopped
                }
            }
        }, 120);

        this.activeSounds.sps = null;
        this.spsPlaying = false;
    }

    // -------------------------------------------------------
    // RCS Pop (Short Noise Burst)
    // -------------------------------------------------------

    /**
     * Play a single RCS thruster pop.
     * Throttled to max 1 per 50ms.
     */
    fireRCS() {
        if (!this.initialized || !this.audioContext) return;

        var now = performance.now();
        if (now - this._lastRCSTime < 50) return;
        this._lastRCSTime = now;

        var ctx = this.audioContext;
        var currentTime = ctx.currentTime;

        // Create a short 15ms white noise buffer
        var sampleRate = ctx.sampleRate;
        var bufferLength = Math.ceil(sampleRate * 0.015);
        var buffer = ctx.createBuffer(1, bufferLength, sampleRate);
        var data = buffer.getChannelData(0);
        for (var i = 0; i < bufferLength; i++) {
            data[i] = Math.random() * 2 - 1;
        }

        // Source
        var source = ctx.createBufferSource();
        source.buffer = buffer;

        // Bandpass filter at 3000Hz, Q=2
        var bandpass = ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.value = 3000;
        bandpass.Q.value = 2;

        // Gain envelope: attack 1ms to 0.5, decay over 14ms to 0.01
        var envelope = ctx.createGain();
        envelope.gain.setValueAtTime(0.001, currentTime);
        envelope.gain.linearRampToValueAtTime(0.5, currentTime + 0.001);
        envelope.gain.exponentialRampToValueAtTime(0.01, currentTime + 0.015);

        // Connect: source -> bandpass -> envelope -> rcsBus
        source.connect(bandpass);
        bandpass.connect(envelope);
        envelope.connect(this.rcsBus);

        source.start(currentTime);
        source.stop(currentTime + 0.015);
    }

    // -------------------------------------------------------
    // Master Alarm (Two-Tone Warning)
    // -------------------------------------------------------

    /**
     * Start the master alarm: alternating 400Hz / 600Hz tones every 200ms.
     */
    startAlarm() {
        if (!this.initialized || !this.audioContext) return;
        if (this.alarmPlaying) return;

        var ctx = this.audioContext;

        // Oscillator 1: 400Hz
        var osc1 = ctx.createOscillator();
        osc1.type = 'sine';
        osc1.frequency.value = 400;
        var gain1 = ctx.createGain();
        gain1.gain.value = 0.3;
        osc1.connect(gain1);
        gain1.connect(this.alarmBus);
        osc1.start();

        // Oscillator 2: 600Hz
        var osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = 600;
        var gain2 = ctx.createGain();
        gain2.gain.value = 0.0;
        osc2.connect(gain2);
        gain2.connect(this.alarmBus);
        osc2.start();

        // Alternate which oscillator is audible every 200ms
        var toggle = true;
        var intervalId = setInterval(function() {
            if (toggle) {
                gain1.gain.value = 0.0;
                gain2.gain.value = 0.3;
            } else {
                gain1.gain.value = 0.3;
                gain2.gain.value = 0.0;
            }
            toggle = !toggle;
        }, 200);

        this.activeSounds.alarm = {
            nodes: [osc1, osc2],
            gains: [gain1, gain2],
            intervalId: intervalId
        };
        this.alarmPlaying = true;
    }

    /**
     * Stop the master alarm.
     */
    stopAlarm() {
        if (!this.initialized || !this.audioContext) return;
        if (!this.alarmPlaying || !this.activeSounds.alarm) return;

        var alarm = this.activeSounds.alarm;

        // Clear the alternation interval
        clearInterval(alarm.intervalId);

        // Stop oscillators
        for (var i = 0; i < alarm.nodes.length; i++) {
            try {
                alarm.nodes[i].stop();
            } catch (e) {
                // Node may already be stopped
            }
        }

        this.activeSounds.alarm = null;
        this.alarmPlaying = false;
    }

    // -------------------------------------------------------
    // Ambient Hum
    // -------------------------------------------------------

    /**
     * Start a quiet background hum representing electrical systems.
     * 120Hz sine, gain 0.03. Runs continuously.
     */
    startAmbient() {
        if (!this.initialized || !this.audioContext) return;
        if (this.ambientPlaying) return;

        var ctx = this.audioContext;

        var osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = 120;

        var gain = ctx.createGain();
        gain.gain.value = 0.03;

        osc.connect(gain);
        gain.connect(this.ambientBus);
        osc.start();

        this.activeSounds.ambient = {
            nodes: [osc],
            gains: [gain]
        };
        this.ambientPlaying = true;
    }

    // -------------------------------------------------------
    // Frame Update
    // -------------------------------------------------------

    /**
     * Called each frame by scene.js.
     * Manages sound states based on spacecraft state.
     * @param {Object} spacecraft - The spacecraft object with isThrusting, spsPropellant, etc.
     */
    update(spacecraft) {
        if (!this.initialized || !this.audioContext || !spacecraft) return;

        // --- SPS engine sound ---
        var thrusting = spacecraft.isThrusting;
        var hasFuel = spacecraft.spsPropellant > 0;

        if (thrusting && hasFuel && !this.spsPlaying) {
            this.startSPS();
        } else if ((!thrusting || !hasFuel) && this.spsPlaying) {
            this.stopSPS();
        }

        // --- Fuel alarm ---
        var fuelRatio = spacecraft.spsPropellant / 18602;

        if (fuelRatio < 0.10 && !this.alarmPlaying) {
            this.startAlarm();
        } else if (fuelRatio > 0.15 && this.alarmPlaying) {
            this.stopAlarm();
        }
    }

    // -------------------------------------------------------
    // Pink Noise Generator (Paul Kellet's refined method)
    // -------------------------------------------------------

    /**
     * Generate a 2-second looping pink noise AudioBuffer.
     * Uses Paul Kellet's refined method for spectral shaping.
     * @returns {AudioBuffer} A 2-second pink noise buffer
     */
    _createPinkNoiseBuffer() {
        var ctx = this.audioContext;
        var sampleRate = ctx.sampleRate;
        var bufferLength = sampleRate * 2; // 2 seconds
        var buffer = ctx.createBuffer(1, bufferLength, sampleRate);
        var data = buffer.getChannelData(0);

        var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        var white;

        // First pass: generate raw pink noise and find peak for normalization
        var peak = 0;
        var raw = new Float32Array(bufferLength);

        for (var i = 0; i < bufferLength; i++) {
            white = Math.random() * 2 - 1;

            b0 = 0.049922035 * white + 0.950066990 * b0;
            b1 = 0.362034884 * white + 0.873413385 * b1;
            b2 = 0.214041144 * white + 0.769686381 * b2;
            b3 = 0.057629008 * white + 0.609883795 * b3;
            b4 = 0.016387238 * white + 0.462108541 * b4;
            b5 = -0.005516831 * white + 0.491458978 * b5;
            b6 = -0.004783347 * white + 0.550016471 * b6;

            var sample = b0 + b1 + b2 + b3 + b4 + b5 + b6;
            raw[i] = sample;

            var absSample = Math.abs(sample);
            if (absSample > peak) {
                peak = absSample;
            }
        }

        // Normalize using the measured peak
        if (peak === 0) peak = 1;
        for (var j = 0; j < bufferLength; j++) {
            data[j] = raw[j] / peak;
        }

        return buffer;
    }
}
