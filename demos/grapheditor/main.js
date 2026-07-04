/* --- GraphEditor main.js (Integrated Version) --- */
(function () {
    'use strict';

    var csInterface = new CSInterface();

    (function setupPanelFlyoutMenu() {
        try {
            var menuXml = '<Menu><MenuItem Id="ge_reload_panel" Label="Recargar panel" Enabled="true"/></Menu>';
            csInterface.setPanelFlyoutMenu(menuXml);
            csInterface.addEventListener('com.adobe.csxs.events.flyoutMenuClicked', function (evt) {
                var id = null;
                var d = evt && evt.data;
                if (d !== undefined && d !== null) {
                    if (typeof d === 'object') {
                        id = d.menuId || d.menuID;
                    } else if (typeof d === 'string') {
                        try {
                            var o = JSON.parse(d);
                            id = o.menuId || o.menuID;
                        } catch (e1) {
                            id = d;
                        }
                    }
                }
                if (id === 'ge_reload_panel') {
                    location.reload();
                }
            });
        } catch (e2) { }
    })();

    // Referencias UI
    const mainLayout = document.getElementById('mainLayout');
    const primaryColumn = document.getElementById('primaryColumn');
    const sliderOut = document.getElementById('sliderOut');
    const sliderIn = document.getElementById('sliderIn');
    const outValDisplay = document.getElementById('outValDisplay');
    const inValDisplay = document.getElementById('inValDisplay');
    const applyBtn = document.getElementById('applyBtn');
    const btnModeVel = document.getElementById('btnModeVelocity');
    const btnModeVal = document.getElementById('btnModeValue');
    const copyBtn = document.getElementById('copyBtn');

    const reverseBtn = document.getElementById('reverseBtn');
    const guideBtn = document.getElementById('guideBtn');

    // Referencias SVG
    const baseLineL = document.getElementById('graphBaseLeft');
    const baseLineR = document.getElementById('graphBaseRight');
    const graphContainer = document.getElementById('graphContainer');
    const speedGraphSVG = document.getElementById('speedGraphSVG');
    const graphCurve = document.getElementById('graphCurve');
    const graphFill = document.getElementById('graphFill');
    const hLineL = document.getElementById('handleLineLeft');
    const hLineR = document.getElementById('handleLineRight');
    const pointL = document.getElementById('handlePointLeft');
    const pointR = document.getElementById('handlePointRight');
    const dragAreaL = document.getElementById('dragAreaLeft');
    const dragAreaR = document.getElementById('dragAreaRight');
    const dragGroupLeft = document.getElementById('dragGroupLeft');
    const dragGroupRight = document.getElementById('dragGroupRight');
    const guideLine = document.getElementById('graphGuideVertical');
    const guideDot = document.getElementById('graphGuideDot');
    const modeSelectorRow = document.getElementById('modeSelectorRow');

    // Constantes Visuales
    const SVG_WIDTH = 300;
    const SVG_HEIGHT = 300;
    const HANDLE_PADDING = 20;

    // Estado
    let isLocked = false;
    let isDraggingLeft = false;
    let isDraggingRight = false;
    let handleLeftY = 0;
    let handleRightY = 0;
    let graphMode = 'velocity';
    let currentViewScale = 1;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartValX = 0;
    let dragStartValY = 0;
    let dragStartScale = 1;
    let isGuideEnabled = false;
    let playheadGuideTimer = null;

    /** graph | elastic | bounce | step (solo AE / panel CEP) */
    let curveFamily = 'graph';
    let specialElastic = { amp: 0.55, decay: 0.48 };
    // Bounce: peak = amplitud (vertical), damp = cantidad de rebotes (horizontal)
    let specialBounce = { peak: 0.55, damp: 0.45 };
    let specialStep = { steps: 5 };
    let isDraggingCustom = false;
    let customDragRef = null;
    let dragStartSpecial = {};

    // --- MOTOR GRÁFICO ---
    function cubicBezier(t, p0, p1, p2, p3) {
        const u = 1 - t; const tt = t * t; const uu = u * u; const uuu = uu * u; const ttt = tt * t;
        return (uuu * p0) + (3 * uu * t * p1) + (3 * u * tt * p2) + (ttt * p3);
    }
    function cubicBezierDerivative(t, p0, p1, p2, p3) {
        const u = 1 - t; return (3 * u * u * (p1 - p0)) + (6 * u * t * (p2 - p1)) + (3 * t * t * (p3 - p2));
    }

    function clamp01(v) { return Math.max(0, Math.min(1, v)); }

    function smoothstep01(a) {
        const t = clamp01(a);
        return t * t * (3 - 2 * t);
    }

    /** Genera picos tipo montaña rusa distribuidos en todo el eje horizontal */
    function buildBounceKeyframes(numBounces, amp) {
        const a = clamp01(amp);
        const n = Math.max(1, Math.min(7, Math.round(numBounces)));
        const kf = [{ t: 0, y: 0 }];
        const riseEnd = 0.14;
        kf.push({ t: riseEnd, y: 0.78 + a * 0.12 });

        const bounceStart = riseEnd;
        const bounceSpan = 0.86;
        let b;
        for (b = 0; b < n; b++) {
            const phase1 = (b + 0.5) / n;
            const phase2 = (b + 1) / n;
            const decay = Math.pow(0.58, b);
            const tValley = bounceStart + bounceSpan * phase1;
            const valleyDepth = (0.42 + a * 0.22) * decay;
            kf.push({ t: tValley, y: 1 - valleyDepth });
            if (b < n - 1) {
                const tPeak = bounceStart + bounceSpan * phase2;
                const peakGap = (0.06 + 0.02 * b) * decay;
                kf.push({ t: tPeak, y: 1 - peakGap });
            }
        }
        kf.push({ t: 0.94, y: 0.985 });
        kf.push({ t: 1, y: 1 });
        kf.sort(function (x, y) { return x.t - y.t; });
        return kf;
    }

    function interpolateBounceKeyframes(kf, t) {
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        let i;
        for (i = 0; i < kf.length - 1; i++) {
            if (t >= kf[i].t && t <= kf[i + 1].t) {
                const dt = kf[i + 1].t - kf[i].t;
                const a = dt < 1e-6 ? 0 : (t - kf[i].t) / dt;
                return kf[i].y + (kf[i + 1].y - kf[i].y) * smoothstep01(a);
            }
        }
        return 1;
    }

    /** Penner ease-out elastic 0..1 (termina en 1 sin reescalado raro) */
    function easeOutElasticPenner(t) {
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        const p = 0.3;
        return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    }

    // Elastic: Penner-style con oscilaciones visibles (tipo NeuCurve)
    function easeOutElasticControlled(u, decay, amp) {
        const t = clamp01(u);
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        const period = 0.48 - clamp01(decay) * 0.32;
        const scale = 1 + clamp01(amp) * 0.72;

        function rawElastic(tt) {
            return scale * Math.pow(2, -10 * tt) * Math.sin((tt - period / 4) * (2 * Math.PI) / period) + 1;
        }

        const y0 = rawElastic(0);
        const y1 = rawElastic(1);
        return (rawElastic(t) - y0) / Math.max(1e-6, y1 - y0);
    }

    // Bounce: montaña rusa horizontal — picos y valles suaves repartidos en todo el tiempo
    function easeOutBounceControlled(u, bounces, amp) {
        const t = clamp01(u);
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        const kf = buildBounceKeyframes(bounces, amp);
        return clamp01(interpolateBounceKeyframes(kf, t));
    }

    // Damped spring that starts at 0 and ends at 1 (normalized by f(1))
    function easeOutSpring01(u, omega, zeta) {
        const t = clamp01(u);
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        const w = Math.max(0.0001, omega);
        const d = Math.max(0.0001, zeta);
        function f(tt) {
            return 1 - Math.exp(-d * tt) * (Math.cos(w * tt) + (d / w) * Math.sin(w * tt));
        }
        const f1 = Math.max(0.0001, f(1));
        return f(t) / f1;
    }

    function sampleSpecialCurvePoints() {
        const num = (curveFamily === 'elastic' || curveFamily === 'bounce') ? 160 : 96;
        const out = [];
        let i, u, y;
        for (i = 0; i <= num; i++) {
            u = i / num;
            if (curveFamily === 'elastic') {
                y = sampleSpecialYAtU(u);
                if (u >= 1) y = 1;
                if (u <= 0) y = 0;
            } else if (curveFamily === 'bounce') {
                y = sampleSpecialYAtU(u);
                if (u >= 1) y = 1;
                if (u <= 0) y = 0;
            } else if (curveFamily === 'step') {
                const steps = Math.max(2, Math.min(16, Math.round(specialStep.steps)));
                y = steps <= 2 ? u : Math.min(1, Math.floor(u * steps) / (steps - 1));
            } else {
                y = u;
            }
            out.push({ x: u, y: y });
        }
        return out;
    }

    function sampleSpecialYAtU(u) {
        const uu = clamp01(u);
        if (curveFamily === 'step') {
            const steps = Math.max(2, Math.min(16, Math.round(specialStep.steps)));
            return steps <= 2 ? uu : Math.min(1, Math.floor(uu * steps) / (steps - 1));
        }
        if (curveFamily === 'bounce') {
            const amp = clamp01(specialBounce.peak);
            const freq = clamp01(specialBounce.damp);
            // Limit a bit so it stays readable and matches reference "mountains"
            const bounces = Math.max(1, Math.min(7, Math.round(1 + freq * 6)));
            return easeOutBounceControlled(uu, bounces, amp);
        }
        if (curveFamily === 'elastic') {
            const yy = easeOutElasticControlled(uu, specialElastic.decay, specialElastic.amp);
            if (yy < -0.05) return -0.05;
            if (yy > 1.65) return 1.65;
            return yy;
        }
        return uu;
    }

    function specialMouseU(clientX, svgRect) {
        const usable = svgRect.width - (HANDLE_PADDING * 2 * (svgRect.width / SVG_WIDTH));
        const nx = (clientX - svgRect.left - HANDLE_PADDING * (svgRect.width / SVG_WIDTH)) / Math.max(1, usable);
        return clamp01(nx);
    }

    function elasticUFromDecay(decay) {
        return 0.18 + clamp01(decay) * 0.64;
    }

    function elasticDecayFromU(u) {
        return clamp01((u - 0.18) / 0.64);
    }

    function bounceUFromDamp(damp) {
        return 0.26 + clamp01(damp) * 0.60;
    }

    function bounceDampFromU(u) {
        return clamp01((u - 0.26) / 0.60);
    }

    function stepUFromSteps(steps) {
        const s = Math.max(2, Math.min(16, Math.round(steps)));
        return 0.12 + ((s - 2) / 14) * 0.76;
    }

    function stepStepsFromU(u) {
        return Math.max(2, Math.min(16, Math.round(2 + clamp01(u) * 14)));
    }

    function buildBakePointsFromSamples(raw) {
        const pts = [];
        let k;
        for (k = 0; k < raw.length; k++) {
            pts.push({ t: raw[k].x, y: raw[k].y });
        }
        return pts;
    }

    const BAKE_MAX_INTERIOR = 28;

    function normalizeBakeEndpoints(pts, family) {
        if (!pts || pts.length < 2) return pts;
        const isElastic = family === 'elastic';
        const yMax = isElastic ? 1.65 : 1;
        const yMin = isElastic ? -0.05 : 0;
        const out = pts.map(function (p) {
            const t = clamp01(parseFloat(p.t));
            let y = parseFloat(p.y);
            if (y > yMax) y = yMax;
            if (y < yMin) y = yMin;
            return { t: t, y: y };
        });
        out.sort(function (a, b) { return a.t - b.t; });
        out[0] = { t: 0, y: 0 };
        out[out.length - 1] = { t: 1, y: 1 };
        return out;
    }

    function downsampleBakePoints(pts, maxInterior, family) {
        if (!pts || pts.length <= 2) return pts;
        if (family === 'elastic' || family === 'bounce') {
            const keep = [0];
            let i;
            for (i = 1; i < pts.length - 1; i++) {
                const prev = pts[i - 1].y;
                const cur = pts[i].y;
                const next = pts[i + 1].y;
                if ((cur >= prev && cur >= next) || (cur <= prev && cur <= next)) {
                    keep.push(i);
                }
            }
            keep.push(pts.length - 1);
            let picked = keep.map(function (idx) { return pts[idx]; });
            if (picked.length - 2 > maxInterior) {
                const inner = picked.slice(1, -1);
                const step = (inner.length - 1) / (maxInterior - 1);
                const slim = [];
                for (i = 0; i < maxInterior; i++) {
                    slim.push(inner[Math.round(i * step)]);
                }
                picked = [picked[0]].concat(slim).concat([picked[picked.length - 1]]);
            }
            return picked;
        }
        const inner = pts.slice(1, -1);
        if (inner.length <= maxInterior) return pts;
        const step = (inner.length - 1) / (maxInterior - 1);
        const pick = [];
        let i;
        for (i = 0; i < maxInterior; i++) {
            pick.push(inner[Math.round(i * step)]);
        }
        return [pts[0]].concat(pick).concat([pts[pts.length - 1]]);
    }

    function updateGraphSpecialModes() {
        const usableSize = SVG_WIDTH - (HANDLE_PADDING * 2);
        const mapX = function (u) { return HANDLE_PADDING + u * usableSize; };

        baseLineL.style.display = 'none';
        baseLineR.style.display = 'none';

        const raw = sampleSpecialCurvePoints();

        let minY = 0;
        let maxY = 1;
        let i;
        for (i = 0; i < raw.length; i++) {
            const yy = raw[i].y;
            if (yy < minY) minY = yy;
            if (yy > maxY) maxY = yy;
        }
        if (minY < -0.1) minY = -0.1;
        if (maxY > 1.55) maxY = 1.55;
        let rangeY = maxY - minY;
        if (rangeY < 0.0001) rangeY = 1;

        const padTop = rangeY * 0.08;
        let viewMinY = 0;
        let viewMaxY = maxY + padTop;
        if (curveFamily === 'elastic') {
            viewMaxY = Math.max(1, maxY + padTop);
            viewMaxY = viewMaxY * 1.12;
        } else if (curveFamily === 'bounce') {
            viewMaxY = 1;
        } else {
            viewMaxY = 1;
        }
        if (viewMaxY < 1) viewMaxY = 1;
        if (viewMaxY - viewMinY < 0.6) {
            viewMaxY = Math.max(1, viewMinY + 0.6);
        }

        const viewRangeY = viewMaxY - viewMinY;
        const mapYv = function (v) {
            const norm = (v - viewMinY) / viewRangeY;
            return SVG_HEIGHT - HANDLE_PADDING - (norm * usableSize);
        };

        // Grid fijo 0..1; solo la curva usa auto-encuadre vertical
        let dGrid = '';
        const FAR_PIXEL = 3000;
        const gridStep = 0.125;
        const mapY01 = function (v01) {
            return SVG_HEIGHT - HANDLE_PADDING - (clamp01(v01) * usableSize);
        };
        let gx;
        for (gx = 0; gx <= 1.0001; gx += gridStep) {
            const xPos = mapX(gx);
            dGrid += 'M ' + xPos + ',' + (-FAR_PIXEL) + ' L ' + xPos + ',' + FAR_PIXEL + ' ';
        }
        let gy;
        for (gy = 0; gy <= 1.0001; gy += gridStep) {
            const yPos = mapY01(gy);
            dGrid += 'M ' + (-FAR_PIXEL) + ',' + yPos + ' L ' + FAR_PIXEL + ',' + yPos + ' ';
        }
        document.getElementById('gridPath').setAttribute('d', dGrid);

        let dCurve = '', dFill = '';
        const floorY = mapYv(0);
        let idx;
        for (idx = 0; idx < raw.length; idx++) {
            const p = raw[idx];
            const px = mapX(p.x);
            const py = mapYv(p.y);
            dCurve += (idx === 0 ? 'M' : 'L') + ' ' + px + ',' + py;
            if (idx === 0) dFill = 'M ' + px + ',' + floorY + ' L ' + px + ',' + py;
            else dFill += ' L ' + px + ',' + py;
        }
        const endX = mapX(1);
        dFill += ' L ' + endX + ',' + floorY + ' Z';
        graphCurve.setAttribute('d', dCurve);
        graphFill.setAttribute('d', dFill);

        hLineL.setAttribute('display', 'none');
        hLineR.setAttribute('display', 'none');

        try { pointL.setAttribute('r', '6'); } catch (eR1) { }

        dragGroupRight.style.display = 'none';

        let uH, yH, pxH, pyH;

        if (curveFamily === 'step') {
            const steps = Math.max(2, Math.min(16, Math.round(specialStep.steps)));
            uH = stepUFromSteps(steps);
            yH = sampleSpecialYAtU(uH);
        } else if (curveFamily === 'elastic') {
            uH = elasticUFromDecay(specialElastic.decay);
            yH = sampleSpecialYAtU(uH);
        } else {
            uH = bounceUFromDamp(specialBounce.damp);
            yH = sampleSpecialYAtU(uH);
        }

        pxH = mapX(uH);
        pyH = mapYv(yH);

        dragGroupLeft.style.display = '';
        pointL.setAttribute('cx', pxH);
        pointL.setAttribute('cy', pyH);
        dragAreaL.setAttribute('x', pxH - 20);
        dragAreaL.setAttribute('y', pyH - 20);
    }

    function updateGraphVisuals() {
        primaryColumn.classList.toggle('curve-family-graph', curveFamily === 'graph');
        primaryColumn.classList.toggle('curve-family-elastic', curveFamily === 'elastic');
        primaryColumn.classList.toggle('curve-family-bounce', curveFamily === 'bounce');
        primaryColumn.classList.toggle('curve-family-step', curveFamily === 'step');
        primaryColumn.classList.toggle('curve-family-custom', false);
        if (modeSelectorRow) {
            modeSelectorRow.style.display = (curveFamily === 'graph') ? '' : 'none';
            modeSelectorRow.classList.toggle('mode-locked-value', false);
        }

        if (curveFamily !== 'graph') {
            updateGraphSpecialModes();
            if (isGuideEnabled) tickGuideFromAEPlayhead();
            return;
        }

        if (dragGroupLeft) dragGroupLeft.style.display = '';
        if (dragGroupRight) dragGroupRight.style.display = '';
        hLineL.removeAttribute('display');
        hLineR.removeAttribute('display');
        try { pointL.setAttribute('r', '4.5'); pointR.setAttribute('r', '4.5'); } catch (eR0) { }

        let o = parseFloat(sliderOut.value);
        let i = parseFloat(sliderIn.value);
        outValDisplay.textContent = Math.round(o) + '%';
        inValDisplay.textContent = Math.round(i) + '%';

        let mcp1x = o / 100; let mcp2x = 1 - (i / 100);
        let mcp1y = (graphMode === 'velocity') ? 0 : handleLeftY;
        let mcp2y = (graphMode === 'velocity') ? 0 : handleRightY;

        const steps = 120; let rawPoints = []; let minVal = 0, maxVal = 1;
        if (graphMode === 'value') { minVal = Math.min(0, handleLeftY, handleRightY); maxVal = Math.max(1, handleLeftY, handleRightY); } else { maxVal = 2.0; }

        for (let s = 0; s <= steps; s++) {
            let t = s / steps;
            let bx = cubicBezier(t, 0, mcp1x, mcp2x, 1);
            let by = 0;
            if (graphMode === 'value') { by = cubicBezier(t, 0, mcp1y, mcp2y, 1); }
            else {
                let dx = cubicBezierDerivative(t, 0, mcp1x, mcp2x, 1); let dy = cubicBezierDerivative(t, 0, 0, 1, 1);
                if (dx > 0.0001) by = dy / dx; if (by > 100) by = 100;
            }
            if (by > maxVal) maxVal = by; if (by < minVal) minVal = by;

            // Solo agreamos el punto si es significativamente diferente al anterior para evitar "3 líneas"
            if (rawPoints.length > 0) {
                let prev = rawPoints[rawPoints.length - 1];
                if (Math.abs(bx - prev.x) < 0.0001 && Math.abs(by - prev.y) < 0.0001) continue;
            }
            rawPoints.push({ x: bx, y: by });
        }

        let rangeY = maxVal - minVal; if (rangeY < 0.001) rangeY = 1;
        const paddingMultiplier = 0.2;
        let visualMinY = minVal - (rangeY * paddingMultiplier);
        let visualMaxY = maxVal + (rangeY * paddingMultiplier);
        let visualRangeY = visualMaxY - visualMinY;

        if (graphMode === 'value') currentViewScale = Math.max(1.0 + (paddingMultiplier * 2), visualRangeY); else currentViewScale = 1.0;

        let centerY = (visualMinY + visualMaxY) / 2;
        let viewMinY = centerY - (currentViewScale / 2); let viewMaxY = centerY + (currentViewScale / 2);
        let centerX = 0.5; let viewMinX = centerX - (currentViewScale / 2); let viewMaxX = centerX + (currentViewScale / 2);
        const usableSize = SVG_WIDTH - (HANDLE_PADDING * 2);

        const mapY = (val) => { let normalized = (graphMode === 'value') ? (val - viewMinY) / currentViewScale : (val - visualMinY) / visualRangeY; return SVG_HEIGHT - HANDLE_PADDING - (normalized * usableSize); };
        const mapX = (val) => { let normalized = (graphMode === 'value') ? (val - viewMinX) / currentViewScale : val; return HANDLE_PADDING + (normalized * usableSize); };

        let dCurve = "", dFill = ""; const floorY = mapY(0);
        for (let idx = 0; idx < rawPoints.length; idx++) {
            let p = rawPoints[idx]; let px = mapX(p.x); let py = mapY(p.y);
            let cmd = (idx === 0) ? "M" : "L"; dCurve += `${cmd} ${px},${py}`;
            if (idx === 0) dFill += `M ${px},${floorY} L ${px},${py}`; else dFill += ` L ${px},${py}`;
        }
        let endX = mapX(1); dFill += ` L ${endX},${floorY} Z`;
        graphCurve.setAttribute('d', dCurve); graphFill.setAttribute('d', dFill);

        // Grid (solo fondo cuadriculado, igual para todos los modos)
        let dGrid = '';
        const FAR_PIXEL = 3000;
        const gridStep = 0.125;
        let gx;
        for (gx = 0; gx <= 1.0001; gx += gridStep) {
            const xPos = HANDLE_PADDING + gx * usableSize;
            dGrid += `M ${xPos},${-FAR_PIXEL} L ${xPos},${FAR_PIXEL} `;
        }
        let gy;
        for (gy = 0; gy <= 1.0001; gy += gridStep) {
            const yPos = HANDLE_PADDING + gy * usableSize;
            dGrid += `M ${-FAR_PIXEL},${yPos} L ${FAR_PIXEL},${yPos} `;
        }
        document.getElementById('gridPath').setAttribute('d', dGrid);

        // Handles
        let h1x, h2x, h1y, h2y;
        if (graphMode === 'velocity') {
            // Ajuste para que los handles no se crucen (Estilo AE nativo)
            // Cada handle ocupa mÃ¡ximo el 48% para dejar un pequeÃ±o espacio en el centro
            h1x = mapX(mcp1x * 0.48); h1y = mapY(0);
            h2x = mapX(1 - ((1 - mcp2x) * 0.48)); h2y = mapY(0);
        }
        else { h1x = mapX(mcp1x); h1y = mapY(mcp1y); h2x = mapX(mcp2x); h2y = mapY(mcp2y); }

        // Limpiamos los ejes base redundantes para que no se vean "3 líneas"
        baseLineL.style.display = 'none';
        baseLineR.style.display = 'none';

        if (graphMode === 'velocity') {
            // En Velocity los handles son siempre horizontales
            hLineL.setAttribute('x1', mapX(0)); hLineL.setAttribute('y1', floorY); hLineL.setAttribute('x2', h1x); hLineL.setAttribute('y2', floorY);
            hLineR.setAttribute('x1', mapX(1)); hLineR.setAttribute('y1', floorY); hLineR.setAttribute('x2', h2x); hLineR.setAttribute('y2', floorY);
        } else {
            // En Value los handles siguen al punto para libertad total
            hLineL.setAttribute('x1', mapX(0)); hLineL.setAttribute('y1', mapY(0)); hLineL.setAttribute('x2', h1x); hLineL.setAttribute('y2', h1y);
            hLineR.setAttribute('x1', mapX(1)); hLineR.setAttribute('y1', mapY(1)); hLineR.setAttribute('x2', h2x); hLineR.setAttribute('y2', h2y);
        }
        pointL.setAttribute('cx', h1x); pointL.setAttribute('cy', h1y); pointR.setAttribute('cx', h2x); pointR.setAttribute('cy', h2y);
        dragAreaL.setAttribute('x', h1x - 20); dragAreaL.setAttribute('y', h1y - 20); dragAreaR.setAttribute('x', h2x - 20); dragAreaR.setAttribute('y', h2y - 20);
        if (isGuideEnabled) tickGuideFromAEPlayhead();
    }

    // --- 3. INTERACCIÓN ---
    function startDragLeft(e) {
        if (curveFamily !== 'graph') {
            isDraggingLeft = true;
            isDraggingRight = false;
            document.body.style.cursor = 'move';
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            if (curveFamily === 'elastic') dragStartSpecial = { decay: specialElastic.decay };
            else if (curveFamily === 'bounce') dragStartSpecial = { damp: specialBounce.damp };
            else if (curveFamily === 'step') dragStartSpecial = { steps: specialStep.steps };
            return;
        }
        isDraggingLeft = true; isDraggingRight = false; document.body.style.cursor = 'move'; dragStartX = e.clientX; dragStartY = e.clientY; dragStartValX = parseFloat(sliderOut.value); dragStartValY = handleLeftY; dragStartScale = (graphMode === 'value') ? currentViewScale : 1;
    }
    function startDragRight(e) {
        if (curveFamily !== 'graph') return;
        isDraggingRight = true; isDraggingLeft = false; document.body.style.cursor = 'move'; dragStartX = e.clientX; dragStartY = e.clientY; dragStartValX = parseFloat(sliderIn.value); dragStartValY = handleRightY; dragStartScale = (graphMode === 'value') ? currentViewScale : 1;
    }
    function handleDrag(e) {
        if (curveFamily !== 'graph' && isDraggingLeft) {
            const rect = speedGraphSVG.getBoundingClientRect();
            const uMouse = specialMouseU(e.clientX, rect);
            if (curveFamily === 'elastic') {
                specialElastic.decay = elasticDecayFromU(uMouse);
            } else if (curveFamily === 'bounce') {
                specialBounce.damp = bounceDampFromU(uMouse);
            } else if (curveFamily === 'step') {
                specialStep.steps = stepStepsFromU(uMouse);
            }
            updateGraphVisuals();
            return;
        }
        if (!isDraggingLeft && !isDraggingRight) return;
        const rect = speedGraphSVG.getBoundingClientRect();
        const usableSize = rect.width - (HANDLE_PADDING * 2 * (rect.width / SVG_WIDTH));

        let pixelsFor100;
        if (graphMode === 'velocity') {
            pixelsFor100 = usableSize * 0.48;
        } else {
            pixelsFor100 = usableSize / dragStartScale;
        }

        const deltaX = (e.clientX - dragStartX) / pixelsFor100 * 100;
        let changeX = isDraggingRight ? -deltaX : deltaX;
        let newValX = Math.max(0.1, Math.min(100, dragStartValX + changeX));

        if (graphMode === 'value') {
            const deltaY = -(e.clientY - dragStartY) / usableSize * dragStartScale;
            if (isDraggingLeft) handleLeftY = dragStartValY + deltaY; else handleRightY = dragStartValY + deltaY;
        }

        const shouldLink = isLocked || e.shiftKey;

        if (isDraggingLeft) {
            sliderOut.value = newValX;
            sliderOut.dispatchEvent(new Event('input'));
            if (shouldLink) {
                sliderIn.value = newValX;
                sliderIn.dispatchEvent(new Event('input'));
                if (graphMode === 'value') handleRightY = handleLeftY;
            }
        } else {
            sliderIn.value = newValX;
            sliderIn.dispatchEvent(new Event('input'));
            if (shouldLink) {
                sliderOut.value = newValX;
                sliderOut.dispatchEvent(new Event('input'));
                if (graphMode === 'value') handleLeftY = handleRightY;
            }
        }
        updateGraphVisuals();
    }
    function stopDrag() {
        isDraggingLeft = false;
        isDraggingRight = false;
        isDraggingCustom = false;
        customDragRef = null;
        document.body.style.cursor = 'default';
    }

    dragGroupLeft.addEventListener('mousedown', startDragLeft);
    dragGroupRight.addEventListener('mousedown', startDragRight);
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', stopDrag);

    function syncLayoutFromWindow() {
        if (!mainLayout || !primaryColumn) return;
        mainLayout.classList.add('layout-vertical');
        mainLayout.classList.remove('layout-horizontal', 'presets-collapsed', 'has-fixed-split');
        primaryColumn.style.height = '';
        primaryColumn.style.flexBasis = '';
        primaryColumn.style.width = '';
        updateGraphVisuals();
    }

    // --- KEYFRAME TYPES ---
    function setType(type) {
        csInterface.evalScript(`_GRAPHEDITOR.setKeyframeType('${type}')`, function (result) {
            applyBtn.innerText = result || "OK";
            setTimeout(() => applyBtn.innerText = "APLICAR", 1500);
        });
    }

    /** Easy Ease y presets rápidos: siempre usan influencia temporal (graph), no el hornado elástico/rebote. */
    function applyGraphInfluenceFromSliders() {
        applyBtn.innerText = "APLICANDO...";
        const vOut = (graphMode === 'value') ? handleLeftY : 0;
        const vIn = (graphMode === 'value') ? (handleRightY - 1) : 0;
        csInterface.evalScript('_GRAPHEDITOR.applyInfluence(' + sliderOut.value + ',' + sliderIn.value + ',' + vOut + ',' + vIn + ',\'' + graphMode + '\')', function (result) {
            applyBtn.innerText = result || "APLICADO";
            setTimeout(function () { applyBtn.innerText = "APLICAR"; }, 1800);
        });
    }

    // Listener global para botones de herramientas (Linear, Ease, Hold, etc)
    document.querySelectorAll('.kf-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            if (this.dataset.type) {
                setType(this.dataset.type);
            } else if (this.classList.contains('preset-trigger')) {
                sliderOut.value = this.dataset.out;
                sliderIn.value = this.dataset.in;
                updateGraphVisuals();
                applyGraphInfluenceFromSliders();
            }
        });
    });

    function mapGuideXFromNormalizedU(u) {
        const usableSize = SVG_WIDTH - (HANDLE_PADDING * 2);
        const uc = Math.max(0, Math.min(1, u));
        return HANDLE_PADDING + uc * usableSize;
    }

    function applyGuideSvgX(x) {
        if (!guideLine || !guideDot) return;
        guideLine.setAttribute('x1', x);
        guideLine.setAttribute('x2', x);
        guideDot.setAttribute('cx', x);
    }

    function tickGuideFromAEPlayhead() {
        if (!isGuideEnabled) return;
        csInterface.evalScript('_GRAPHEDITOR.getPlayheadSegmentU()', function (res) {
            if (!isGuideEnabled) return;
            let x = SVG_WIDTH / 2;
            let ok = false;
            try {
                const raw = (res === undefined || res === null) ? '' : String(res);
                if (raw && raw.indexOf('EvalScript error') !== -1) {
                    applyGuideSvgX(x);
                    if (guideLine) guideLine.style.opacity = '0.35';
                    if (guideDot) guideDot.style.opacity = '0.35';
                    return;
                }
                const d = JSON.parse(raw);
                if (d && d.found && typeof d.u === 'number' && !isNaN(d.u)) {
                    x = mapGuideXFromNormalizedU(d.u);
                    ok = true;
                }
            } catch (e) { }
            applyGuideSvgX(x);
            if (guideLine) {
                guideLine.style.opacity = ok ? '1' : '0.35';
            }
            if (guideDot) {
                guideDot.style.opacity = ok ? '1' : '0.35';
            }
        });
    }

    function setGuideVisibility(on) {
        isGuideEnabled = !!on;
        if (playheadGuideTimer) {
            clearInterval(playheadGuideTimer);
            playheadGuideTimer = null;
        }
        if (!guideLine || !guideDot) return;
        guideLine.style.display = isGuideEnabled ? 'block' : 'none';
        guideDot.style.display = isGuideEnabled ? 'block' : 'none';
        if (guideBtn) guideBtn.classList.toggle('is-active', isGuideEnabled);

        if (isGuideEnabled) {
            tickGuideFromAEPlayhead();
            playheadGuideTimer = setInterval(tickGuideFromAEPlayhead, 60);
        } else {
            guideLine.style.opacity = '1';
            guideDot.style.opacity = '1';
        }
    }

    window.addEventListener('beforeunload', function () {
        if (playheadGuideTimer) {
            clearInterval(playheadGuideTimer);
            playheadGuideTimer = null;
        }
    });

    // --- 7. AE STUFF ---
    function applyToAE() {
        applyBtn.innerText = "APLICANDO...";
        if (curveFamily === 'graph') {
            const vOut = (graphMode === 'value') ? handleLeftY : 0;
            const vIn = (graphMode === 'value') ? (handleRightY - 1) : 0;
            csInterface.evalScript(`_GRAPHEDITOR.applyInfluence(${sliderOut.value}, ${sliderIn.value}, ${vOut}, ${vIn}, '${graphMode}')`, function (result) {
                applyBtn.innerText = result || "APLICADO";
                setTimeout(() => applyBtn.innerText = "APLICAR", 2000);
            });
        } else {
            const raw = sampleSpecialCurvePoints();
            let pts = buildBakePointsFromSamples(raw);
            pts = normalizeBakeEndpoints(pts, curveFamily);
            pts = downsampleBakePoints(pts, BAKE_MAX_INTERIOR, curveFamily);
            const payload = { type: curveFamily, points: pts };
            if (curveFamily === 'elastic') payload.params = { amp: specialElastic.amp, decay: specialElastic.decay };
            if (curveFamily === 'bounce') payload.params = { peak: specialBounce.peak, damp: specialBounce.damp };
            if (curveFamily === 'step') payload.params = { steps: specialStep.steps };
            // custom removed
            const inner = JSON.stringify(payload);
            const cmd = '_GRAPHEDITOR.applyExpressionSegment(' + JSON.stringify(inner) + ')';
            csInterface.evalScript(cmd, function (result) {
                const r = (result || '').toString();
                if (r.indexOf('OK:') === 0) {
                    const n = parseInt(r.slice(3), 10);
                    applyBtn.innerText = (isNaN(n) || n < 1) ? "NO APLICÓ" : "APLICADO";
                } else {
                    applyBtn.innerText = r || "ERROR";
                    // hint rápido para cuando el host JSX no se recargó
                    if (r.indexOf('EvalScript') !== -1 || r.indexOf('ERR:') === 0) {
                        setTimeout(() => { applyBtn.innerText = "RECARGA PANEL"; }, 1200);
                    }
                }
                setTimeout(() => { applyBtn.innerText = "APLICAR"; }, 2200);
            });
        }
    }

    copyBtn.addEventListener('click', () => {
        // Prefer: detect GraphEditor expression (elastic/bounce/step/custom).
        // Fallback: Graph influences (velocity/value) if no expr was found.

        function setFamilyUI(fam) {
            curveFamily = fam;
            document.querySelectorAll('.curve-type-btn').forEach(function (b) {
                b.classList.toggle('active', b.getAttribute('data-curve') === fam);
            });
        }

        function copyGraphInfluences() {
            setFamilyUI('graph');
            csInterface.evalScript('_GRAPHEDITOR.getSelectedInfluences()', (result) => {
                try {
                    const data = JSON.parse(result);
                    if (data.found) {
                        sliderOut.value = data.outVal; sliderIn.value = data.inVal;
                        if (graphMode === 'value') { handleLeftY = data.slopeOut * (data.outVal / 100); handleRightY = (data.slopeIn * (data.inVal / 100)) + 1; }
                        updateGraphVisuals();
                    } else {
                        applyBtn.innerText = 'NO KEYS';
                        setTimeout(() => { applyBtn.innerText = "APLICAR"; }, 1200);
                    }
                } catch (e) {
                    applyBtn.innerText = 'RECARGA';
                    setTimeout(() => { applyBtn.innerText = "APLICAR"; }, 1200);
                }
            });
        }

        csInterface.evalScript('_GRAPHEDITOR.getSelectedCurveFromExpression()', (result) => {
            let data = null;
            try { data = JSON.parse(result); } catch (e0) { data = null; }

            if (!data || !data.found) {
                // If it's not one of our special curves, treat it as Graph.
                copyGraphInfluences();
                return;
            }

            if (data && data.expressionEnabled === false) {
                applyBtn.innerText = 'EXPR OFF';
                setTimeout(() => { applyBtn.innerText = "APLICAR"; }, 1200);
            }

            const famRaw = (data.type || '').toString().toLowerCase();
            const fam = (famRaw === 'elastic' || famRaw === 'bounce' || famRaw === 'step') ? famRaw : 'graph';

            if (fam === 'graph') {
                copyGraphInfluences();
                return;
            }

            // Auto-switch tab to detected family
            setFamilyUI(fam);

            if (fam === 'elastic' && data.params) {
                specialElastic = { amp: data.params.amp, decay: data.params.decay };
            } else if (fam === 'bounce' && data.params) {
                specialBounce = { peak: data.params.peak, damp: data.params.damp };
            } else if (fam === 'step' && data.params) {
                specialStep = { steps: data.params.steps };
                }

            updateGraphVisuals();
        });
    });

    applyBtn.addEventListener('click', applyToAE);
    btnModeVel.addEventListener('click', () => {
        graphMode = 'velocity';
        btnModeVel.classList.add('active');
        btnModeVal.classList.remove('active');
        updateGraphVisuals();
    });
    btnModeVal.addEventListener('click', () => {
        graphMode = 'value';
        btnModeVal.classList.add('active');
        btnModeVel.classList.remove('active');
        handleRightY = 1;
        updateGraphVisuals();
    });

    // New buttons
    if (reverseBtn) {
        reverseBtn.addEventListener('click', () => {
            const o = parseFloat(sliderOut.value);
            const i = parseFloat(sliderIn.value);
            sliderOut.value = i;
            sliderIn.value = o;

            if (graphMode === 'value') {
                const tmpY = handleLeftY;
                handleLeftY = handleRightY - 1;
                handleRightY = tmpY + 1;
            }

            updateGraphVisuals();
            applyToAE();
        });
    }

    if (guideBtn) {
        guideBtn.addEventListener('click', () => {
            setGuideVisibility(!isGuideEnabled);
        });
    }

    document.querySelectorAll('.curve-type-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const c = btn.getAttribute('data-curve');
            if (!c) return;
            curveFamily = c;
            document.querySelectorAll('.curve-type-btn').forEach(function (b) {
                b.classList.toggle('active', b.getAttribute('data-curve') === c);
            });
            if (modeSelectorRow) {
                modeSelectorRow.classList.remove('mode-locked-value');
            }
            if (graphContainer) {
                graphContainer.title = '';
            }
            updateGraphVisuals();
        });
    });

    let resizeTimer = null;
    window.addEventListener('resize', function () {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(syncLayoutFromWindow, 80);
    });

    // Fallback: keep sliders in state even if hidden/removed (no linking)
    if (sliderOut) sliderOut.addEventListener('input', () => { updateGraphVisuals(); });
    if (sliderIn) sliderIn.addEventListener('input', () => { updateGraphVisuals(); });

    syncLayoutFromWindow();

})();