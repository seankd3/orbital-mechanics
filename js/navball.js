/**
 * Navball attitude indicator drawn as clean 2D vector lines.
 */
class Navball {
    constructor() {
        this.size = 156;
        this.margin = 18;
        this.markers = [];

        this.wrapper = document.createElement('div');
        this.wrapper.id = 'navball-container';
        document.body.appendChild(this.wrapper);

        this.canvas = document.createElement('canvas');
        this.wrapper.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.resize();
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = Math.round(this.size * dpr);
        this.canvas.height = Math.round(this.size * dpr);
        this.canvas.style.width = this.size + 'px';
        this.canvas.style.height = this.size + 'px';
        this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        this.updateCanvasPosition();
    }

    updateCanvasPosition() {
        const bar = document.getElementById('bottom-bar');
        const barHeight = bar ? bar.offsetHeight : 112;
        this.wrapper.style.cssText =
            'position:fixed;' +
            'right:' + this.margin + 'px;' +
            'bottom:' + (barHeight + 14) + 'px;' +
            'width:' + this.size + 'px;' +
            'height:' + this.size + 'px;' +
            'z-index:50;' +
            'pointer-events:none;';
    }

    update(spacecraft, planet) {
        if (!spacecraft || !planet) return;

        const radial = spacecraft.position.clone().sub(planet.mesh.position);
        const velocity = spacecraft.velocity.clone();
        if (radial.lengthSq() < 1e-10 || velocity.lengthSq() < 1e-10) return;

        const prograde = velocity.normalize();
        const normal = new THREE.Vector3().crossVectors(radial, velocity).normalize();
        if (normal.lengthSq() < 1e-10) return;

        const radialOut = new THREE.Vector3().crossVectors(prograde, normal).normalize();
        const inverseCraft = spacecraft.mesh.quaternion.clone().invert();
        this.horizonNormal = radialOut.clone().applyQuaternion(inverseCraft).normalize();

        this.markers = [
            { label: 'PRO', vector: prograde, style: 'solid' },
            { label: 'RET', vector: prograde.clone().negate(), style: 'hollow' },
            { label: 'N', vector: normal, style: 'solid' },
            { label: 'AN', vector: normal.clone().negate(), style: 'hollow' },
            { label: 'RAD', vector: radialOut, style: 'solid' },
            { label: 'IN', vector: radialOut.clone().negate(), style: 'hollow' }
        ].map((marker) => {
            marker.local = marker.vector.clone().applyQuaternion(inverseCraft).normalize();
            return marker;
        });
    }

    render() {
        const ctx = this.ctx;
        const center = this.size / 2;
        const radius = this.size * 0.43;

        ctx.clearRect(0, 0, this.size, this.size);
        ctx.lineCap = 'square';
        ctx.lineJoin = 'miter';
        ctx.font = '10px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        this.drawShell(ctx, center, radius);
        this.drawHorizon(ctx, center, radius);

        for (let i = 0; i < this.markers.length; i++) {
            this.drawMarker(ctx, center, radius, this.markers[i]);
        }

        this.drawReticle(ctx, center, radius);
    }

    drawShell(ctx, center, radius) {
        ctx.save();
        ctx.strokeStyle = '#b8f6c4';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(center, center, radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.globalAlpha = 0.45;
        ctx.beginPath();
        ctx.arc(center, center, radius * 0.58, 0, Math.PI * 2);
        ctx.stroke();

        for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * Math.PI * 2;
            const inner = radius - (i % 3 === 0 ? 8 : 4);
            ctx.beginPath();
            ctx.moveTo(center + Math.cos(angle) * inner, center + Math.sin(angle) * inner);
            ctx.lineTo(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius);
            ctx.stroke();
        }

        ctx.beginPath();
        ctx.moveTo(center - radius, center);
        ctx.lineTo(center + radius, center);
        ctx.moveTo(center, center - radius);
        ctx.lineTo(center, center + radius);
        ctx.stroke();
        ctx.restore();
    }

    drawHorizon(ctx, center, radius) {
        if (!this.horizonNormal) return;

        const normal = this.horizonNormal.clone().normalize();
        let u = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0, 0, 1));
        if (u.lengthSq() < 0.0001) {
            u = new THREE.Vector3().crossVectors(normal, new THREE.Vector3(0, 1, 0));
        }
        u.normalize();
        const v = new THREE.Vector3().crossVectors(normal, u).normalize();

        this.drawHorizonArc(ctx, center, radius, u, v, true);
        this.drawHorizonArc(ctx, center, radius, u, v, false);
    }

    drawHorizonArc(ctx, center, radius, u, v, frontSide) {
        ctx.save();
        ctx.strokeStyle = frontSide ? '#ffffff' : '#6fa979';
        ctx.globalAlpha = frontSide ? 0.85 : 0.28;
        ctx.lineWidth = 1;
        ctx.beginPath();

        let drawing = false;
        for (let i = 0; i <= 144; i++) {
            const t = (i / 144) * Math.PI * 2;
            const point = u.clone().multiplyScalar(Math.cos(t)).addScaledVector(v, Math.sin(t));
            const isFront = point.z >= 0;
            if (isFront !== frontSide) {
                drawing = false;
                continue;
            }

            const x = center + point.x * radius;
            const y = center - point.y * radius;
            if (!drawing) {
                ctx.moveTo(x, y);
                drawing = true;
            } else {
                ctx.lineTo(x, y);
            }
        }

        ctx.stroke();
        ctx.restore();
    }

    drawReticle(ctx, center, radius) {
        ctx.save();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(center - 11, center);
        ctx.lineTo(center - 4, center);
        ctx.moveTo(center + 4, center);
        ctx.lineTo(center + 11, center);
        ctx.moveTo(center, center - 11);
        ctx.lineTo(center, center - 4);
        ctx.moveTo(center, center + 4);
        ctx.lineTo(center, center + 11);
        ctx.stroke();
        ctx.restore();
    }

    drawMarker(ctx, center, radius, marker) {
        const v = marker.local;
        if (!v) return;

        const visible = v.z >= -0.05;
        const edgeClamp = visible ? 1 : 0.96;
        const x = center + Math.max(-edgeClamp, Math.min(edgeClamp, v.x)) * radius;
        const y = center - Math.max(-edgeClamp, Math.min(edgeClamp, v.y)) * radius;

        ctx.save();
        ctx.globalAlpha = visible ? 1 : 0.32;
        ctx.strokeStyle = this.markerColor(marker.label);
        ctx.fillStyle = ctx.strokeStyle;
        ctx.lineWidth = 1;

        if (marker.style === 'hollow') {
            ctx.beginPath();
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(x, y - 7);
            ctx.lineTo(x + 6, y + 5);
            ctx.lineTo(x - 6, y + 5);
            ctx.closePath();
            ctx.stroke();
        }

        const centerDistance = Math.hypot(x - center, y - center);
        let labelX = x;
        let labelY = y + 15;
        if (centerDistance < 20) {
            labelY = y - 16;
        } else if (centerDistance > radius * 0.82) {
            const dx = (x - center) / centerDistance;
            const dy = (y - center) / centerDistance;
            labelX = x - dx * 13;
            labelY = y - dy * 13;
        }

        ctx.fillText(marker.label, labelX, labelY);
        ctx.restore();
    }

    markerColor(label) {
        if (label === 'PRO') return '#ffffff';
        if (label === 'RET') return '#b8f6c4';
        return '#80c98f';
    }
}
