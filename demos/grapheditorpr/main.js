/*
Â© Mateo Crespo (Animateo)

Puedes usar este plugin libremente.
No puedes venderlo, redistribuirlo ni publicar versiones modificadas.

Â¿Encontraste una mejora o correcciÃ³n?
Por favor, compÃ¡rtela con el autor.
*/
/* --- GraphEditorPR main.js (Premiere Pro) --- */
(function () {
    'use strict';

    var csInterface = new CSInterface();

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
    const filterRow = document.getElementById('filterRow');
    const reverseBtn = document.getElementById('reverseBtn');
    const lockBtnToolbar = document.getElementById('lockBtnToolbar');
    const cleanBtn = document.getElementById('cleanBtn');
    const randomizeBtn = document.getElementById('randomizeBtn');
    const resetBtn = document.getElementById('resetBtn');
    const curveTypeBar = document.getElementById('curveTypeBar');
    const modeSelectorRow = document.getElementById('modeSelectorRow');

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

    // Constantes Visuales
    const SVG_WIDTH = 300;
    const SVG_HEIGHT = 300;
    const HANDLE_PADDING = 20;

    // Estado
    let isLocked = false;
    let isDraggingLeft = false;
    let isDraggingRight = false;
    let handleLeftY = 0;
    // En modo VALUE el control derecho parte en 1 (para que la curva no salga “rara” al cambiar de modo)
    let handleRightY = 1;
    let graphMode = 'velocity';
    let currentViewScale = 1;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartValX = 0;
    let dragStartValY = 0;
    let dragStartScale = 1;

    // --- Estado de familia de curva (Premiere Pro NO tiene expresiones,
    //     así que todas las familias especiales se hornean como keyframes
    //     lineales aproximando la curva — igual que Motion Studio). ---
    /** graph | elastic | bounce | step */
    let curveFamily = 'graph';
    let specialElastic = { amp: 0.55, decay: 0.48 };
    // Bounce: peak = amplitud (vertical), damp = cantidad de rebotes (horizontal)
    let specialBounce = { peak: 0.55, damp: 0.45 };
    let specialStep = { steps: 5 };

    // --- 2. MOTOR GRÁFICO ---
    function cubicBezier(t, p0, p1, p2, p3) {
        const u = 1 - t; const tt = t * t; const uu = u * u; const uuu = uu * u; const ttt = tt * t;
        return (uuu * p0) + (3 * uu * t * p1) + (3 * u * tt * p2) + (ttt * p3);
    }
    function cubicBezierDerivative(t, p0, p1, p2, p3) {
        const u = 1 - t; return (3 * u * u * (p1 - p0)) + (6 * u * t * (p2 - p1)) + (3 * t * t * (p3 - p2));
    }

    function clamp01(v) { return Math.max(0, Math.min(1, v)); }

    // --- CURVAS ESPECIALES (Elastic / Bounce / Step) — portadas de la versión After Effects.
    //
    // Elastic: Penner-style con oscilaciones visibles (tipo NeuCurve).
    //   amp   controla la amplitud del overshoot inicial
    //   decay controla la velocidad con la que la oscilación se atenúa
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

    // Bounce estilo Penner/neucurve — pelota que cae y rebota en el techo.
    //   Se compone de 1 tramo de subida (parábola 0 → 1) y N tramos de rebote
    //   (parábolas invertidas con valle a la mitad, profundidad k^seg).
    //   bounces (1..7) — cuántos valles visibles (rebotes).
    //   amp     (0..1) — cuán "duros" son los rebotes (valles más profundos).
    function easeOutBounceControlled(u, bounces, amp) {
        const t = clamp01(u);
        if (t <= 0) return 0;
        if (t >= 1) return 1;

        const N = Math.max(1, Math.min(7, Math.round(bounces)));
        const segs = N + 1;
        const a = clamp01(amp);
        const k = 0.90 - a * 0.70;

        const seg = Math.min(Math.floor(t * segs), segs - 1);

        if (seg === 0) {
            const u2 = t * segs;
            const rem = 1 - u2;
            return 1 - rem * rem;
        }

        const uu = (t - seg / segs) * segs;
        const nt = 2 * uu - 1;
        return 1 - Math.pow(k, seg) * (1 - nt * nt);
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

    function sampleSpecialCurvePoints() {
        const num = (curveFamily === 'elastic' || curveFamily === 'bounce') ? 160 : 96;
        const out = [];
        let i, u, y;
        for (i = 0; i <= num; i++) {
            u = i / num;
            if (curveFamily === 'step') {
                const steps = Math.max(2, Math.min(16, Math.round(specialStep.steps)));
                y = steps <= 2 ? u : Math.min(1, Math.floor(u * steps) / (steps - 1));
            } else {
                y = sampleSpecialYAtU(u);
                if (u >= 1) y = 1;
                if (u <= 0) y = 0;
            }
            out.push({ x: u, y: y });
        }
        return out;
    }

    // Mapeos entre parámetros de familia y posición X del handle (0..1).
    function elasticUFromDecay(decay) { return 0.18 + clamp01(decay) * 0.64; }
    function elasticDecayFromU(u) { return clamp01((u - 0.18) / 0.64); }
    function bounceUFromDamp(damp) { return 0.26 + clamp01(damp) * 0.60; }
    function bounceDampFromU(u) { return clamp01((u - 0.26) / 0.60); }
    function stepUFromSteps(steps) {
        const s = Math.max(2, Math.min(16, Math.round(steps)));
        return 0.12 + ((s - 2) / 14) * 0.76;
    }
    function stepStepsFromU(u) { return Math.max(2, Math.min(16, Math.round(2 + clamp01(u) * 14))); }

    function specialMouseU(clientX, svgRect) {
        const usable = svgRect.width - (HANDLE_PADDING * 2 * (svgRect.width / SVG_WIDTH));
        const nx = (clientX - svgRect.left - HANDLE_PADDING * (svgRect.width / SVG_WIDTH)) / Math.max(1, usable);
        return clamp01(nx);
    }

    // Normalización de los puntos horneados para elastic/bounce/step:
    // fuerza t=0..1 en el segmento, clamp a rangos razonables, arranque en (0,0) y fin en (1,1).
    function normalizeBakeEndpoints(pts, family) {
        if (!pts || pts.length < 2) return pts;
        const isElastic = (family === 'elastic');
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

    // Para KEYS: dejamos como máximo BAKE_MAX_INTERIOR keyframes por segmento (evita
    // saturar la timeline). Elastic/bounce priorizan picos y valles.
    const BAKE_MAX_INTERIOR = 28;
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
        let j;
        for (j = 0; j < maxInterior; j++) {
            pick.push(inner[Math.round(j * step)]);
        }
        return [pts[0]].concat(pick).concat([pts[pts.length - 1]]);
    }

    function updateGraphSpecialModes() {
        const usableSize = SVG_WIDTH - (HANDLE_PADDING * 2);
        const mapX = function (u) { return HANDLE_PADDING + u * usableSize; };

        baseLineL.style.display = 'none';
        baseLineR.style.display = 'none';

        const raw = sampleSpecialCurvePoints();

        let minY = 0, maxY = 1;
        for (let i = 0; i < raw.length; i++) {
            if (raw[i].y < minY) minY = raw[i].y;
            if (raw[i].y > maxY) maxY = raw[i].y;
        }
        if (minY < -0.1) minY = -0.1;
        if (maxY > 1.55) maxY = 1.55;
        let rangeY = maxY - minY;
        if (rangeY < 0.0001) rangeY = 1;

        const padTop = rangeY * 0.08;
        let viewMinY = 0;
        let viewMaxY = maxY + padTop;
        if (curveFamily === 'elastic') {
            viewMaxY = Math.max(1, maxY + padTop) * 1.12;
        } else if (curveFamily === 'bounce') {
            viewMaxY = 1.18;
        } else {
            viewMaxY = 1;
        }
        if (viewMaxY < 1) viewMaxY = 1;
        if (viewMaxY - viewMinY < 0.6) viewMaxY = Math.max(1, viewMinY + 0.6);

        const viewRangeY = viewMaxY - viewMinY;
        const mapYv = function (v) {
            const norm = (v - viewMinY) / viewRangeY;
            return SVG_HEIGHT - HANDLE_PADDING - (norm * usableSize);
        };

        // Grid (verticales + horizontales, mucho más allá del viewBox para cubrir todo el ancho).
        let dGrid = '';
        const FAR_PIXEL = 6000;
        const gridStep = 0.125;
        const mapY01 = function (v01) { return SVG_HEIGHT - HANDLE_PADDING - (v01 * usableSize); };
        for (let gx = -20; gx <= 20.0001; gx += gridStep) {
            const xPos = mapX(gx);
            dGrid += 'M ' + xPos + ',' + (-FAR_PIXEL) + ' L ' + xPos + ',' + FAR_PIXEL + ' ';
        }
        for (let gy = -20; gy <= 20.0001; gy += gridStep) {
            const yPos = mapY01(gy);
            dGrid += 'M ' + (-FAR_PIXEL) + ',' + yPos + ' L ' + FAR_PIXEL + ',' + yPos + ' ';
        }
        document.getElementById('gridPath').setAttribute('d', dGrid);

        // Curva y fill
        let dCurve = '', dFill = '';
        const floorY = mapYv(0);
        for (let idx = 0; idx < raw.length; idx++) {
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

        // En modo especial usamos UN solo handle (slider horizontal).
        hLineL.setAttribute('display', 'none');
        hLineR.setAttribute('display', 'none');
        try { pointL.setAttribute('r', '6'); } catch (eR1) { }
        dragGroupRight.style.display = 'none';

        let uH, yH;
        if (curveFamily === 'step') {
            uH = stepUFromSteps(specialStep.steps);
            yH = sampleSpecialYAtU(uH);
        } else if (curveFamily === 'elastic') {
            uH = elasticUFromDecay(specialElastic.decay);
            yH = sampleSpecialYAtU(uH);
        } else {
            uH = bounceUFromDamp(specialBounce.damp);
            // Dot fijo a la mitad — funciona como slider horizontal limpio.
            yH = viewMaxY * 0.5;
        }
        const pxH = mapX(uH);
        const pyH = mapYv(yH);
        dragGroupLeft.style.display = '';
        pointL.setAttribute('cx', pxH);
        pointL.setAttribute('cy', pyH);
        dragAreaL.setAttribute('x', pxH - 20);
        dragAreaL.setAttribute('y', pyH - 20);
    }

    function updateGraphVisuals() {
        // Familia de curva → clase en el column raíz (para colores del CSS).
        primaryColumn.classList.toggle('curve-family-graph', curveFamily === 'graph');
        primaryColumn.classList.toggle('curve-family-elastic', curveFamily === 'elastic');
        primaryColumn.classList.toggle('curve-family-bounce', curveFamily === 'bounce');
        primaryColumn.classList.toggle('curve-family-step', curveFamily === 'step');
        if (modeSelectorRow) {
            // El toggle CURVE/VALUE solo tiene sentido para la familia Graph.
            modeSelectorRow.style.display = (curveFamily === 'graph') ? '' : 'none';
        }

        if (curveFamily !== 'graph') {
            updateGraphSpecialModes();
            return;
        }

        // Modo Graph (bezier de 2 handles): comportamiento original.
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

        // Grid (fondo cuadriculado — verticales y horizontales muy fuera del viewBox
        // para cubrir todo el contenedor cuando el SVG queda centrado en un panel ancho).
        let dGrid = '';
        const FAR_PIXEL = 6000;
        const gridStep = 0.125;
        for (let gx = -20; gx <= 20.0001; gx += gridStep) {
            const xPos = HANDLE_PADDING + gx * usableSize;
            dGrid += `M ${xPos},${-FAR_PIXEL} L ${xPos},${FAR_PIXEL} `;
        }
        for (let gy = -20; gy <= 20.0001; gy += gridStep) {
            const yPos = HANDLE_PADDING + gy * usableSize;
            dGrid += `M ${-FAR_PIXEL},${yPos} L ${FAR_PIXEL},${yPos} `;
        }
        document.getElementById('gridPath').setAttribute('d', dGrid);

        // Handles
        let h1x, h2x, h1y, h2y;
        if (graphMode === 'velocity') {
            // --- POSICIONAR ELEMENTOS Y EJES (Mapping original PPro) ---
            h1x = HANDLE_PADDING + ((o / 100) * 0.5 * usableSize); h1y = mapY(0);
            h2x = (HANDLE_PADDING + usableSize) - ((i / 100) * 0.5 * usableSize); h2y = mapY(0);
        } else {
            h1x = mapX(mcp1x); h1y = mapY(mcp1y); h2x = mapX(mcp2x); h2y = mapY(mcp2y);
        }

        // Ocultar líneas base para no ensuciar el diseño
        baseLineL.style.display = 'none';
        baseLineR.style.display = 'none';

        hLineL.setAttribute('x1', mapX(0)); hLineL.setAttribute('y1', mapY(0)); hLineL.setAttribute('x2', h1x); hLineL.setAttribute('y2', h1y);
        let anchorRightY = (graphMode === 'velocity') ? 0 : 1; hLineR.setAttribute('x1', mapX(1)); hLineR.setAttribute('y1', mapY(anchorRightY)); hLineR.setAttribute('x2', h2x); hLineR.setAttribute('y2', h2y);
        pointL.setAttribute('cx', h1x); pointL.setAttribute('cy', h1y); pointR.setAttribute('cx', h2x); pointR.setAttribute('cy', h2y);
        dragAreaL.setAttribute('x', h1x - 20); dragAreaL.setAttribute('y', h1y - 20); dragAreaR.setAttribute('x', h2x - 20); dragAreaR.setAttribute('y', h2y - 20);
    }

    function syncLayoutFromWindow() {
        if (!mainLayout || !primaryColumn) return;
        mainLayout.classList.add('layout-vertical');
        mainLayout.classList.remove('layout-horizontal', 'presets-collapsed', 'has-fixed-split');
        primaryColumn.style.height = '';
        primaryColumn.style.flexBasis = '';
        primaryColumn.style.width = '';
        updateGraphVisuals();
    }

    // --- 3. INTERACCIÓN ---
    function startDragLeft(e) {
        if (curveFamily !== 'graph') {
            // Modo especial: un único handle horizontal que ajusta el parámetro de la familia.
            isDraggingLeft = true; isDraggingRight = false; document.body.style.cursor = 'move';
            dragStartX = e.clientX; dragStartY = e.clientY;
            return;
        }
        isDraggingLeft = true; isDraggingRight = false; document.body.style.cursor = 'move'; dragStartX = e.clientX; dragStartY = e.clientY; dragStartValX = parseFloat(sliderOut.value); dragStartValY = handleLeftY; dragStartScale = (graphMode === 'value') ? currentViewScale : 1;
    }
    function startDragRight(e) {
        // En modos especiales no hay handle derecho.
        if (curveFamily !== 'graph') return;
        isDraggingRight = true; isDraggingLeft = false; document.body.style.cursor = 'move'; dragStartX = e.clientX; dragStartY = e.clientY; dragStartValX = parseFloat(sliderIn.value); dragStartValY = handleRightY; dragStartScale = (graphMode === 'value') ? currentViewScale : 1;
    }
    function handleDrag(e) {
        // Modos especiales: el drag horizontal ajusta el parámetro característico
        // (decay para elastic, damp para bounce, steps para step).
        if (curveFamily !== 'graph' && isDraggingLeft) {
            const rect = speedGraphSVG.getBoundingClientRect();
            const uMouse = specialMouseU(e.clientX, rect);
            if (curveFamily === 'elastic') specialElastic.decay = elasticDecayFromU(uMouse);
            else if (curveFamily === 'bounce') specialBounce.damp = bounceDampFromU(uMouse);
            else if (curveFamily === 'step') specialStep.steps = stepStepsFromU(uMouse);
            updateGraphVisuals();
            return;
        }
        if (!isDraggingLeft && !isDraggingRight) return;
        const rect = speedGraphSVG.getBoundingClientRect();
        const usableSize = rect.width - (HANDLE_PADDING * 2 * (rect.width / SVG_WIDTH));

        let pixelsFor100;
        if (graphMode === 'velocity') { pixelsFor100 = usableSize * 0.48; } else { pixelsFor100 = usableSize / dragStartScale; }

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
            if (shouldLink) { sliderIn.value = newValX; sliderIn.dispatchEvent(new Event('input')); if (graphMode === 'value') handleRightY = handleLeftY; }
        } else {
            sliderIn.value = newValX;
            sliderIn.dispatchEvent(new Event('input'));
            if (shouldLink) { sliderOut.value = newValX; sliderOut.dispatchEvent(new Event('input')); if (graphMode === 'value') handleLeftY = handleRightY; }
        }
        updateGraphVisuals();
    }
    function stopDrag() { isDraggingLeft = false; isDraggingRight = false; document.body.style.cursor = 'default'; }

    dragGroupLeft.addEventListener('mousedown', startDragLeft);
    dragGroupRight.addEventListener('mousedown', startDragRight);
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', stopDrag);

    document.querySelectorAll('.preset-trigger').forEach(btn => {
        btn.addEventListener('click', () => {
            const o = parseFloat(btn.dataset.out || '50');
            const i = parseFloat(btn.dataset.in || '50');
            sliderOut.value = o;
            sliderIn.value = i;
            updateGraphVisuals();
        });
    });

    // Reverse
    if (reverseBtn) reverseBtn.addEventListener('click', () => {
        const tmp = sliderOut.value;
        sliderOut.value = sliderIn.value;
        sliderIn.value = tmp;
        if (graphMode === 'value') {
            const tY = handleLeftY;
            handleLeftY = handleRightY;
            handleRightY = tY;
        }
        updateGraphVisuals();
    });

    // Lock (toolbar)
    function setLockState(next) {
        isLocked = !!next;
        if (lockBtnToolbar) {
            lockBtnToolbar.classList.toggle('is-active', isLocked);
            lockBtnToolbar.setAttribute('aria-pressed', isLocked ? 'true' : 'false');
            lockBtnToolbar.title = isLocked ? 'Vincular (Activo)' : 'Vincular';
        }
        if (isLocked) {
            sliderIn.value = sliderOut.value;
            if (graphMode === 'value') handleRightY = handleLeftY;
        }
        updateGraphVisuals();
    }
    if (lockBtnToolbar) lockBtnToolbar.addEventListener('click', () => setLockState(!isLocked));

    // --- 4. PREMIERE SCANNING & FILTERS ---
    function getActiveFilters() {
        const activeFilters = [];
        document.querySelectorAll('.filter-pill.active').forEach(function (p) {
            activeFilters.push(p.dataset.filter);
        });
        return activeFilters.join(',');
    }

    // Parse "clipIdx~compIdx~compName~propName" entries returned by scanActiveProperties.
    function _parseScanResult(raw) {
        if (!raw) return [];
        return raw.split(',').filter(Boolean).map(s => {
            const parts = s.split('~');
            if (parts.length >= 4) {
                return { clipIdx: parts[0], compIdx: parts[1], compName: parts[2] || '', propName: parts[3] || '' };
            }
            // Legacy: solo nombre propiedad
            return { clipIdx: '*', compIdx: '*', compName: '', propName: parts[0] || s };
        });
    }

    // Etiqueta "bonita": si el mismo propName aparece varias veces, desambiguamos con el
    // nombre del componente (y un contador si son varios del mismo).
    function _buildLabels(entries) {
        const byProp = new Map();
        for (const e of entries) {
            if (!byProp.has(e.propName)) byProp.set(e.propName, []);
            byProp.get(e.propName).push(e);
        }
        const labels = new Map(); // key -> label
        for (const [propName, arr] of byProp) {
            if (arr.length <= 1) {
                labels.set(arr[0].clipIdx + '~' + arr[0].compIdx + '~' + propName, propName);
                continue;
            }
            // Hay duplicados del mismo propName: usar compName + contador si se repite
            const compCounts = new Map();
            arr.forEach(e => compCounts.set(e.compName, (compCounts.get(e.compName) || 0) + 1));
            const seen = new Map();
            arr.forEach(e => {
                const n = (seen.get(e.compName) || 0) + 1; seen.set(e.compName, n);
                const needNum = (compCounts.get(e.compName) || 0) > 1;
                const compLabel = e.compName ? (needNum ? `${e.compName} ${n}` : e.compName) : `#${n}`;
                const label = `${propName} · ${compLabel}`;
                labels.set(e.clipIdx + '~' + e.compIdx + '~' + propName, label);
            });
        }
        return labels;
    }

    let lastResultStr = "";
    function scanProps() {
        csInterface.evalScript('_GRAPHEDITORPR.scanActiveProperties()', function (result) {
            if (result === lastResultStr) return;
            lastResultStr = result;
            const filterRow = document.getElementById('filterRow');
            const previousState = {};
            filterRow.querySelectorAll('.filter-pill').forEach(btn => { previousState[btn.dataset.filter] = btn.classList.contains('active'); });

            const entries = _parseScanResult(result);
            const labels = _buildLabels(entries);
            filterRow.innerHTML = '';
            entries.forEach(e => {
                const filterKey = e.clipIdx + '~' + e.compIdx + '~' + e.propName;
                const label = labels.get(filterKey) || e.propName;
                const btn = document.createElement('button');
                btn.className = 'filter-pill is-available';
                btn.dataset.filter = filterKey;
                btn.textContent = label;
                btn.title = label;
                if (previousState.hasOwnProperty(filterKey)) { if (previousState[filterKey]) btn.classList.add('active'); } else { btn.classList.add('active'); }
                btn.addEventListener('click', function () { this.classList.toggle('active'); });
                filterRow.appendChild(btn);
            });

            const hasAny = filterRow.querySelectorAll('.filter-pill').length > 0;
            filterRow.classList.toggle('is-empty', !hasAny);
        });
    }
    window.addEventListener('focus', scanProps);
    setInterval(scanProps, 1500);

    // --- 5. APPLICATION LOGIC (PPRO) ---
    // Normaliza el resultado de evalScript: JSX puede devolver el string literal "undefined"
    // o cadena vacía cuando la función no tiene return.
    function _cleanEvalResult(result) {
        if (result === undefined || result === null) return '';
        const s = String(result).trim();
        if (s === '' || s === 'undefined' || s === 'null') return '';
        return s;
    }

    function applyToPPro() {
        applyBtn.innerText = "APLICANDO...";
        const filterStr = getActiveFilters();

        if (curveFamily === 'graph') {
            const vOut = (graphMode === 'value') ? handleLeftY : 0;
            const vIn = (graphMode === 'value') ? (handleRightY - 1) : 0;
            csInterface.evalScript(`_GRAPHEDITORPR.applyInfluence(${sliderOut.value}, ${sliderIn.value}, ${vOut}, ${vIn}, '${graphMode}', '${filterStr}')`, function (result) {
                applyBtn.innerText = _cleanEvalResult(result) || "APLICADO";
                setTimeout(() => applyBtn.innerText = "APLICAR", 2000);
            });
            return;
        }

        // ---- Familias especiales (Elastic / Bounce / Step) ----
        // Premiere Pro no soporta expresiones en propiedades, así que las
        // curvas especiales se HORNEAN como keyframes con interpolación Linear
        // (misma estrategia que Motion Studio y el resto de la industria).
        let pts = sampleSpecialCurvePoints().map(function (p) { return { t: p.x, y: p.y }; });
        pts = normalizeBakeEndpoints(pts, curveFamily);
        pts = downsampleBakePoints(pts, BAKE_MAX_INTERIOR, curveFamily);

        const payload = { type: curveFamily, points: pts, filters: filterStr };
        if (curveFamily === 'elastic') payload.params = { amp: specialElastic.amp, decay: specialElastic.decay };
        if (curveFamily === 'bounce') payload.params = { peak: specialBounce.peak, damp: specialBounce.damp };
        if (curveFamily === 'step') payload.params = { steps: specialStep.steps };

        const inner = JSON.stringify(payload);
        const cmd = '_GRAPHEDITORPR.applyBakedSegment(' + JSON.stringify(inner) + ')';
        csInterface.evalScript(cmd, function (result) {
            const r = _cleanEvalResult(result);
            if (r.indexOf('OK:') === 0) {
                const n = parseInt(r.slice(3), 10);
                applyBtn.innerText = (isNaN(n) || n < 1) ? "NO APLICÓ" : "APLICADO";
            } else if (r === '') {
                applyBtn.innerText = "APLICADO";
            } else {
                applyBtn.innerText = r;
            }
            setTimeout(() => applyBtn.innerText = "APLICAR", 2200);
        });
    }

    function setType(type) {
        const filters = getActiveFilters();
        csInterface.evalScript(`_GRAPHEDITORPR.setKeyframeType('${type}', '${filters}')`, function (result) {
            applyBtn.innerText = result || "OK";
            setTimeout(() => applyBtn.innerText = "APLICAR", 1500);
        });
    }

    function cleanInPanel() {
        const filters = getActiveFilters();
        applyBtn.innerText = 'LIMPIANDO...';
        csInterface.evalScript('_GRAPHEDITORPR.cleanCurve(\'' + filters.replace(/'/g, '\\\'') + '\')', function (result) {
            applyBtn.innerText = result || 'LIMPIO';
            setTimeout(function () { applyBtn.innerText = 'APLICAR'; }, 1500);
        });
    }

    // Listeners final
    applyBtn.addEventListener('click', applyToPPro);
    if (cleanBtn) cleanBtn.addEventListener('click', cleanInPanel);
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
        // Si venimos de velocity y todavía no hubo edición en VALUE, setear defaults estables
        if (handleLeftY === 0 && handleRightY === 0) handleRightY = 1;
        updateGraphVisuals();
    });

    document.querySelectorAll('.kf-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            if (this.dataset.type) { setType(this.dataset.type); }
        });
    });

    // --- Curve family selector (Graph / Elastic / Bounce / Step) ---
    document.querySelectorAll('.curve-type-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
            const c = btn.getAttribute('data-curve');
            if (!c) return;
            curveFamily = c;
            document.querySelectorAll('.curve-type-btn').forEach(function (b) {
                b.classList.toggle('active', b.getAttribute('data-curve') === c);
            });
            updateGraphVisuals();
        });
    });

    // --- Aleatorio: mezcla los valores de la curva activa. ---
    function randomizeCurrentCurve() {
        const rnd = (min, max) => min + Math.random() * (max - min);
        if (curveFamily === 'graph') {
            if (sliderOut) { sliderOut.value = rnd(8, 92); }
            if (sliderIn) { sliderIn.value = rnd(8, 92); }
            if (graphMode === 'value') {
                handleLeftY = rnd(-0.35, 0.35);
                handleRightY = 1 + rnd(-0.35, 0.35);
            }
        } else if (curveFamily === 'elastic') {
            specialElastic.amp = rnd(0.15, 0.85);
            specialElastic.decay = rnd(0.15, 0.85);
        } else if (curveFamily === 'bounce') {
            specialBounce.peak = rnd(0.25, 0.85);
            specialBounce.damp = rnd(0.10, 0.90);
        } else if (curveFamily === 'step') {
            specialStep.steps = Math.max(2, Math.min(16, Math.round(rnd(2, 12))));
        }
        updateGraphVisuals();
    }

    // --- Reset: vuelve a los valores por defecto de la curva activa. ---
    function resetCurrentCurve() {
        if (curveFamily === 'graph') {
            if (sliderOut) { sliderOut.value = 33.3; }
            if (sliderIn) { sliderIn.value = 33.3; }
            handleLeftY = 0;
            handleRightY = 1;
        } else if (curveFamily === 'elastic') {
            specialElastic.amp = 0.55;
            specialElastic.decay = 0.48;
        } else if (curveFamily === 'bounce') {
            specialBounce.peak = 0.55;
            specialBounce.damp = 0.45;
        } else if (curveFamily === 'step') {
            specialStep.steps = 5;
        }
        updateGraphVisuals();
    }

    if (randomizeBtn) randomizeBtn.addEventListener('click', randomizeCurrentCurve);
    if (resetBtn) resetBtn.addEventListener('click', resetCurrentCurve);

    sliderOut.addEventListener('input', () => { if (isLocked) sliderIn.value = sliderOut.value; updateGraphVisuals(); });
    sliderIn.addEventListener('input', () => { if (isLocked) sliderOut.value = sliderIn.value; updateGraphVisuals(); });

    // Asegurar foco para atajos (CEP a veces no dispara keydown si el panel no está enfocado)
    document.addEventListener('mousedown', () => {
        try { document.body.focus(); } catch (e) { }
    }, true);

    updateGraphVisuals();
    scanProps();
    syncLayoutFromWindow();
    window.addEventListener('resize', syncLayoutFromWindow);

})();