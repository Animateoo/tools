/*
Â© Mateo Crespo (Animateo)

Puedes usar este plugin libremente.
No puedes venderlo, redistribuirlo ni publicar versiones modificadas.

Â¿Encontraste una mejora o correcciÃ³n?
¿Encontraste una mejora o corrección?
Por favor, compártela con el autor.
*/
/* --- GraphEditor main.js (Integrated Version) --- */
(function () {
    'use strict';

    var csInterface = new CSInterface();

    var isPPro = false;
    try { isPPro = csInterface.getApplicationID() === 'PPRO'; } catch(e) {}
    try {
        if (isPPro) {
            var hostPath = csInterface.getSystemPath(SystemPath.EXTENSION) + '/hostscriptPR.jsx';
            // Carga el JSX y cuando termina llama scanProps — así sabemos que el JSX ya está disponible
            csInterface.evalScript('$.evalFile("' + hostPath + '")', function(r) {
                setTimeout(function() {
                    if (typeof scanProps === 'function') scanProps();
                }, 300);
            });
            var _copyBtn = document.getElementById('copyBtn');
            var _cleanBtn = document.getElementById('cleanBtn');
            if (_copyBtn) _copyBtn.style.display = 'none';
            if (_cleanBtn) _cleanBtn.style.display = '';
            var _applyMethodRow = document.getElementById('applyMethodRow');
            if (_applyMethodRow) _applyMethodRow.style.display = 'none';
            // Reordenar DOM para PPro: Graph → filterRow → APLICAR → Tools (iconos)
            // En AE el orden original es: Graph → Tools → APLICAR — no se toca
            var _primaryCol = document.getElementById('primaryColumn');
            var _controlsSec = _primaryCol && _primaryCol.querySelector('.controls-section');
            if (_primaryCol && _controlsSec) {
                _primaryCol.appendChild(_controlsSec); // Mueve tools al final
            }
            // Fallback: segundo intento a los 2s por si el primer scan fue antes de seleccionar clip
            setTimeout(function() { if (typeof scanProps === 'function') scanProps(); }, 2000);
            // Refrescar propiedades cuando cambia la selección en PPro
            try {
                csInterface.addEventListener('com.adobe.csxs.events.SelectionChanged', function() {
                    if (typeof scanProps === 'function') scanProps();
                });
            } catch(eEv) {}
        } else {
            var _copyBtn = document.getElementById('copyBtn');
            var _cleanBtn = document.getElementById('cleanBtn');
            if (_copyBtn) _copyBtn.style.display = '';
            if (_cleanBtn) _cleanBtn.style.display = 'none';
        }
    } catch(e) { console.error('isPPro init error:', e); }

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
    const randomizeBtn = document.getElementById('randomizeBtn');
    const resetBtn = document.getElementById('resetBtn');
    const applyMethodRow = document.getElementById('applyMethodRow');
    const btnApplyExpr = document.getElementById('btnApplyExpr');
    const btnApplyKeys = document.getElementById('btnApplyKeys');

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

    /** graph | elastic | bounce | step | wave (solo AE / panel CEP) */
    let curveFamily = 'graph';
    /** 'expr' | 'keys' — sólo relevante cuando curveFamily !== 'graph' */
    let applyMethod = 'expr';
    try {
        var stored = localStorage.getItem('ge_applyMethod');
        if (stored === 'expr' || stored === 'keys') applyMethod = stored;
    } catch (eLS0) { }
    let specialElastic = { amp: 1, freq: 3.0, decay: 4.0 };
    // Bounce: peak = amplitud (vertical), damp = cantidad de rebotes (horizontal)
    let specialBounce = { peak: 0.55, damp: 0.45 };
    let specialStep = { steps: 5 };
    // Wave: freq = ciclos, decay = amortiguamiento, sharp = forma (-1 Square, 0 Sine, +1 Triangle)
    let specialWave = { freq: 2.5, decay: 0.0, sharp: 0.0 };
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

    /** Penner ease-out elastic 0..1 (termina en 1 sin reescalado raro) */
    function easeOutElasticPenner(t) {
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        const p = 0.3;
        return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
    }

    // Elastic (NeucurvePro formula): damped cosine with boundary correction
    function easeOutElasticControlled(u, amp, freq, decay) {
        const t = clamp01(u);
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        var raw = 1 - amp * Math.exp(-decay * t) * Math.cos(freq * Math.PI * 2 * t);
        var w = Math.exp(-decay);
        var err0 = 1 - amp;
        var err1 = -amp * w * Math.cos(freq * Math.PI * 2);
        var ease = raw - (err0 * Math.exp(-2.5 * decay * t) * (1 - t) + err1 * t);
        return ease;
    }

    // Bounce (fórmula exacta NeucurvePro): segmentos de ancho igual, k = stiffness directo
    function easeOutBounceControlled(u, bounces, stiffness, freqVal) {
        const t = clamp01(u);
        if (t <= 0) return 0;
        if (t >= 1) return 1;
        
        const amp = stiffness; 
        const decay = (8 - bounces) * 1.5; 
        const freq = freqVal !== undefined ? freqVal : 2;
        
        const overshoot = amp * Math.sin(freq * t * 2 * Math.PI) / Math.exp(decay * t);
        return t + overshoot;
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

    // Wave: oscilación periódica con forma configurable (Sine/Triangle/Square) y decay.
    // Portado de NeucurvePro — produce valores centrados en 0.5 que oscilan entre 0 y 1.
    function easeWave(u, freq, decay, sharp) {
        const t = clamp01(u);
        var phase = t * freq;
        var sig = Math.sin(phase * Math.PI * 2 - Math.PI / 2);
        var s = 0.5 + 0.5 * sig;
        var osc;
        if (sharp > 0) {
            // Morphea de Sine → Triangle
            var tr = Math.abs(((phase + 0.5) % 1) * 2 - 1);
            osc = s + (tr - s) * sharp;
        } else if (sharp < 0) {
            // Morphea de Sine → Square (power shaping)
            var exponent = 1.0 / (1.0 + Math.abs(sharp));
            var shaped = (sig < 0 ? -1 : 1) * Math.pow(Math.abs(sig), exponent);
            osc = 0.5 + 0.5 * shaped;
        } else {
            osc = s;
        }
        var envelope = Math.exp(-decay * t);
        return 0.5 + (osc - 0.5) * envelope;
    }

    function sampleSpecialCurvePoints() {
        // Step: generate exact staircase edges (double points at each step boundary)
        if (curveFamily === 'step') {
            const steps = Math.max(2, Math.min(16, Math.round(specialStep.steps)));
            const out = [];
            out.push({ x: 0, y: 0 });
            for (let s = 0; s < steps; s++) {
                const yVal = Math.min(1, s / (steps - 1));
                const tStart = s / steps;
                const tEnd = (s + 1) / steps;
                // Left edge of this step (just after the transition)
                if (s > 0) {
                    out.push({ x: tStart + 0.0001, y: yVal });
                }
                // Right edge of this step (just before the next transition)
                if (s < steps - 1) {
                    out.push({ x: tEnd - 0.0001, y: yVal });
                } else {
                    out.push({ x: 1, y: 1 });
                }
            }
            return out;
        }

        const num = (curveFamily === 'elastic' || curveFamily === 'bounce' || curveFamily === 'wave') ? 160 : 96;
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
            } else if (curveFamily === 'wave') {
                y = sampleSpecialYAtU(u);
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
            // 1..7 rebotes distribuidos por el rango del slider — la primera franja
            // (freq muy chico) da 1 sólo rebote (curva más simple), la última da 7.
            // Así "2 rebotes" queda a mano en el 2º tramo del arrastre.
            const bounces = Math.max(1, Math.min(7, Math.round(1 + freq * 6)));
            return easeOutBounceControlled(uu, bounces, amp);
        }
        if (curveFamily === 'elastic') {
            const yy = easeOutElasticControlled(uu, specialElastic.amp, specialElastic.freq, specialElastic.decay);
            if (yy < -0.05) return -0.05;
            if (yy > 1.65) return 1.65;
            return yy;
        }
        if (curveFamily === 'wave') {
            return easeWave(uu, specialWave.freq, specialWave.decay, specialWave.sharp);
        }
        return uu;
    }

    function specialMouseU(clientX, svgRect) {
        const usable = svgRect.width - (HANDLE_PADDING * 2 * (svgRect.width / SVG_WIDTH));
        const nx = (clientX - svgRect.left - HANDLE_PADDING * (svgRect.width / SVG_WIDTH)) / Math.max(1, usable);
        return clamp01(nx);
    }

    // Elastic/Wave: posiciones de handles según NeucurvePro
    // Elastic freq handle: x = 0.5 / freq (inverso)
    // Wave freq handle: x = min(1/freq, 1) (inverso)
    // Bounce count handle: x = bounces / 10
    // Las funciones UFrom*/FromU ya no se necesitan para elastic/wave
    // porque usamos posicionamiento directo como NeucurvePro.
    // Solo mantenemos las de bounce y step para el slider horizontal.

    function bounceUFromDamp(damp) {
        // damp 0..1 → bounces 1..7 → x = bounces/10
        var bounces = Math.max(1, Math.min(7, Math.round(1 + clamp01(damp) * 6)));
        return bounces / 10;
    }

    function bounceDampFromU(u) {
        // x → bounces → damp
        var bounces = Math.max(1, Math.min(7, Math.round(u * 10)));
        return (bounces - 1) / 6;
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
        const isWave = family === 'wave';
        const isStep = family === 'step';
        // Step points are already precise — don't clamp or re-sort them
        if (isStep) return pts;
        const yMax = isElastic ? 1.65 : 1.5;
        const yMin = (isElastic || isWave) ? -0.5 : 0;
        const out = pts.map(function (p) {
            const t = clamp01(parseFloat(p.t));
            let y = parseFloat(p.y);
            if (y > yMax) y = yMax;
            if (y < yMin) y = yMin;
            return { t: t, y: y };
        });
        out.sort(function (a, b) { return a.t - b.t; });
        // Wave starts at 0.5 (neutral) and ends wherever the math puts it.
        // Elastic/Bounce start at 0 and end at 1 (value goes from A to B).
        // Do NOT force wave endpoints — use actual sampled values.
        if (!isWave) {
            out[0] = { t: 0, y: 0 };
            out[out.length - 1] = { t: 1, y: 1 };
        }
        return out;
    }

    function downsampleBakePoints(pts, maxInterior, family) {
        if (!pts || pts.length <= 2) return pts;
        if (family === 'step') return pts;
        
        var effectiveMax = isPPro ? 60 : ((family === 'wave') ? Math.max(60, maxInterior) : maxInterior);

        if (!isPPro && (family === 'elastic' || family === 'bounce' || family === 'wave')) {
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
            if (picked.length - 2 > effectiveMax) {
                const inner = picked.slice(1, -1);
                const step = (inner.length - 1) / (effectiveMax - 1);
                const slim = [];
                for (i = 0; i < effectiveMax; i++) {
                    slim.push(inner[Math.round(i * step)]);
                }
                picked = [picked[0]].concat(slim).concat([picked[picked.length - 1]]);
            }
            return picked;
        }
        
        const inner = pts.slice(1, -1);
        if (inner.length <= effectiveMax) return pts;
        const step = (inner.length - 1) / (effectiveMax - 1);
        const pick = [];
        let j;
        for (j = 0; j < effectiveMax; j++) {
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
            // Los peaks del bounce llegan a y=1 (target del keyframe). Le damos
            // margen visual arriba para que la curva no toque el borde superior
            // del gráfico — el rebote real sigue matemáticamente en 0..1.
            viewMaxY = 1.18;
        } else if (curveFamily === 'wave') {
            // Wave oscila entre ~0 y ~1 pero puede superar ligeramente esos límites.
            // Le damos margen simétrico para que se vea centrada.
            viewMinY = Math.min(-0.08, minY - padTop);
            viewMaxY = Math.max(1.08, maxY + padTop);
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

        // Grid fijo 0..1
        let dGrid = '';
        const FAR_PIXEL = 6000;
        const gridStep = 0.25;
        const mapY01 = function (v01) {
            return SVG_HEIGHT - HANDLE_PADDING - (v01 * usableSize);
        };
        let gx;
        for (gx = -20; gx <= 20.0001; gx += gridStep) {
            const xPos = mapX(gx);
            dGrid += 'M ' + xPos + ',' + (-FAR_PIXEL) + ' L ' + xPos + ',' + FAR_PIXEL + ' ';
        }
        let gy;
        for (gy = -20; gy <= 20.0001; gy += gridStep) {
            const yPos = mapY01(gy);
            dGrid += 'M ' + (-FAR_PIXEL) + ',' + yPos + ' L ' + FAR_PIXEL + ',' + yPos + ' ';
        }
        document.getElementById('gridPath').setAttribute('d', dGrid);
        // Líneas mayores blancas (bordes: 0, 1, 2 ...)
        var dMajor = '';
        var mj;
        for (mj = -20; mj <= 20.0001; mj += 1.0) {
            var mjx = mapX(mj);
            dMajor += 'M ' + mjx + ',' + (-FAR_PIXEL) + ' L ' + mjx + ',' + FAR_PIXEL + ' ';
            var mjy = mapY01(mj);
            dMajor += 'M ' + (-FAR_PIXEL) + ',' + mjy + ' L ' + FAR_PIXEL + ',' + mjy + ' ';
        }
        document.getElementById('gridPathMajor').setAttribute('d', dMajor);

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
        // Hacer todos los handles huecos (estilo NeucurvePro)
        pointL.classList.add('graph-handle-hollow');
        pointR.classList.add('graph-handle-hollow');

        // Ocultar handles extra por defecto.
        dragGroupRight.style.display = 'none';
        if (_waveSharpGroup) _waveSharpGroup.style.display = 'none';
        if (_elasticAmpGroup) _elasticAmpGroup.style.display = 'none';
        if (_envelopePath) { _envelopePath.style.display = 'none'; _envelopePath.setAttribute('d', ''); }

        let uH, yH, pxH, pyH;

        if (curveFamily === 'wave') {
            // --- WAVE (NeucurvePro): 3 handles + envolvente curva ---

            // Envolvente: dos líneas curvas punteadas (decaimiento exponencial)
            // Superior: y = 0.5 + 0.5 * exp(-decay * u)
            // Inferior: y = 0.5 - 0.5 * exp(-decay * u)
            if (_envelopePath) {
                var dEnv = '';
                var envSteps = 60;
                var ei;
                // Curva superior
                for (ei = 0; ei <= envSteps; ei++) {
                    var eu = ei / envSteps;
                    var envUp = 0.5 + 0.5 * Math.exp(-specialWave.decay * eu);
                    dEnv += (ei === 0 ? 'M' : 'L') + ' ' + mapX(eu) + ',' + mapYv(envUp);
                }
                // Curva inferior
                for (ei = 0; ei <= envSteps; ei++) {
                    var eu = ei / envSteps;
                    var envDown = 0.5 - 0.5 * Math.exp(-specialWave.decay * eu);
                    dEnv += (ei === 0 ? ' M' : ' L') + ' ' + mapX(eu) + ',' + mapYv(envDown);
                }
                _envelopePath.setAttribute('d', dEnv);
                _envelopePath.style.display = '';
            }

            // Handle 1 (Left/Freq): x = min(1/max(0.1, freq), 1), y = 0.5 — arrastre horizontal
            var wfx = Math.min(1.0 / Math.max(0.1, specialWave.freq), 1.0);
            pxH = mapX(wfx);
            pyH = mapYv(0.5);
            dragGroupLeft.style.display = '';
            pointL.setAttribute('cx', pxH);
            pointL.setAttribute('cy', pyH);
            dragAreaL.setAttribute('x', pxH - 20);
            dragAreaL.setAttribute('y', pyH - 20);

            // Handle 2 (Right/Decay): x = 0.5, y = 0.5 + 0.5*exp(-decay*0.5) — arrastre vertical
            var wdx = 0.5;
            var wdy = 0.5 + 0.5 * Math.exp(-specialWave.decay * 0.5);
            var pxD = mapX(wdx);
            var pyD = mapYv(wdy);
            dragGroupRight.style.display = '';
            try { pointR.setAttribute('r', '6'); } catch (eR2) { }
            pointR.setAttribute('cx', pxD);
            pointR.setAttribute('cy', pyD);
            dragAreaR.setAttribute('x', pxD - 20);
            dragAreaR.setAttribute('y', pyD - 20);

            // Handle 3 (Custom/Sharp): x = 0.25, y = 0.5 + 0.5*sharp — arrastre vertical
            if (_waveSharpGroup) {
                var wsx = 0.25;
                var wsy = 0.5 + 0.5 * specialWave.sharp;
                var pxS = mapX(wsx);
                var pyS = mapYv(wsy);
                _waveSharpGroup.style.display = '';
                _waveSharpPoint.setAttribute('cx', pxS);
                _waveSharpPoint.setAttribute('cy', pyS);
                _waveSharpArea.setAttribute('x', pxS - 20);
                _waveSharpArea.setAttribute('y', pyS - 20);
            }
        } else if (curveFamily === 'elastic') {
            // --- ELASTIC (NeucurvePro): 3 handles ---

            // Guía: línea horizontal punteada a la altura del pico de amplitud
            if (_envelopePath) {
                var peakX = 0.5 / Math.max(0.1, specialElastic.freq);
                var peakY = sampleSpecialYAtU(Math.min(peakX, 1.0));
                var py_guide = mapYv(peakY);
                _envelopePath.setAttribute('d', 'M ' + mapX(0) + ',' + py_guide + ' L ' + mapX(1) + ',' + py_guide);
                _envelopePath.style.display = '';
            }

            // Handle 1 (Left/Freq): x = 0.5/freq, y = 0.5 — arrastre horizontal
            var efx = Math.min(0.5 / Math.max(0.1, specialElastic.freq), 1.0);
            pxH = mapX(efx);
            pyH = mapYv(0.5);
            dragGroupLeft.style.display = '';
            pointL.setAttribute('cx', pxH);
            pointL.setAttribute('cy', pyH);
            dragAreaL.setAttribute('x', pxH - 20);
            dragAreaL.setAttribute('y', pyH - 20);

            // Handle 2 (Right/Decay): x = 1.0, y = 1 - amp*exp(-decay*0.5) — arrastre vertical
            var edy = 1 - specialElastic.amp * Math.exp(-specialElastic.decay * 0.5);
            var pxD = mapX(1.0);
            var pyD = mapYv(edy);
            dragGroupRight.style.display = '';
            try { pointR.setAttribute('r', '6'); } catch (eR2) { }
            pointR.setAttribute('cx', pxD);
            pointR.setAttribute('cy', pyD);
            dragAreaR.setAttribute('x', pxD - 20);
            dragAreaR.setAttribute('y', pyD - 20);

            // Handle 3 (Custom/Amp): x = 0.5/freq (primer pico), y = valor de la curva ahí — arrastre vertical
            if (_elasticAmpGroup) {
                var eax = Math.min(0.5 / Math.max(0.1, specialElastic.freq), 1.0);
                var eay = sampleSpecialYAtU(eax);
                var pxA = mapX(eax);
                var pyA = mapYv(eay);
                _elasticAmpGroup.style.display = '';
                _elasticAmpPoint.setAttribute('cx', pxA);
                _elasticAmpPoint.setAttribute('cy', pyA);
                _elasticAmpArea.setAttribute('x', pxA - 20);
                _elasticAmpArea.setAttribute('y', pyA - 20);
            }
        } else if (curveFamily === 'bounce') {
            // --- BOUNCE (NeucurvePro): 2 handles ---

            // Handle 1 (Left/Stiffness): x = 0.0, y = 1 - stiffness — arrastre vertical
            pxH = mapX(0.0);
            pyH = mapYv(1 - specialBounce.peak);
            dragGroupLeft.style.display = '';
            pointL.setAttribute('cx', pxH);
            pointL.setAttribute('cy', pyH);
            dragAreaL.setAttribute('x', pxH - 20);
            dragAreaL.setAttribute('y', pyH - 20);

            // Handle 2 (Right/Count): x = bounces/10, y = 0.5 — arrastre horizontal
            var bCount = Math.max(1, Math.min(7, Math.round(1 + clamp01(specialBounce.damp) * 6)));
            var pxB = mapX(bCount / 10);
            var pyB = mapYv(0.5);
            dragGroupRight.style.display = '';
            try { pointR.setAttribute('r', '6'); } catch (eR2) { }
            pointR.setAttribute('cx', pxB);
            pointR.setAttribute('cy', pyB);
            dragAreaR.setAttribute('x', pxB - 20);
            dragAreaR.setAttribute('y', pyB - 20);
        } else if (curveFamily === 'step') {
            const steps = Math.max(2, Math.min(16, Math.round(specialStep.steps)));
            uH = stepUFromSteps(steps);
            yH = sampleSpecialYAtU(uH);
            pxH = mapX(uH);
            pyH = mapYv(yH);
            dragGroupLeft.style.display = '';
            pointL.setAttribute('cx', pxH);
            pointL.setAttribute('cy', pyH);
            dragAreaL.setAttribute('x', pxH - 20);
            dragAreaL.setAttribute('y', pyH - 20);
        }
    }

    function updateGraphVisuals() {
        primaryColumn.classList.toggle('curve-family-graph', curveFamily === 'graph');
        primaryColumn.classList.toggle('curve-family-elastic', curveFamily === 'elastic');
        primaryColumn.classList.toggle('curve-family-bounce', curveFamily === 'bounce');
        primaryColumn.classList.toggle('curve-family-step', curveFamily === 'step');
        primaryColumn.classList.toggle('curve-family-wave', curveFamily === 'wave');
        primaryColumn.classList.toggle('curve-family-custom', false);
        if (modeSelectorRow) {
            modeSelectorRow.style.display = (curveFamily === 'graph') ? '' : 'none';
            modeSelectorRow.classList.toggle('mode-locked-value', false);
        }
        if (applyMethodRow) {
            // En Premiere: siempre oculto (solo aplica KEYS, sin EXPR)
            // En AE: visible cuando curveFamily !== 'graph'
            applyMethodRow.style.display = (isPPro || curveFamily === 'graph') ? 'none' : '';
            if (btnApplyExpr) btnApplyExpr.classList.toggle('active', applyMethod === 'expr');
            if (btnApplyKeys) btnApplyKeys.classList.toggle('active', applyMethod === 'keys');
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
        // Restaurar handles sólidos en modo graph
        pointL.classList.remove('graph-handle-hollow');
        pointR.classList.remove('graph-handle-hollow');

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

        // Grid (fondo cuadriculado)
        let dGrid = '';
        const FAR_PIXEL = 6000;
        const gridStep = 0.25;
        let gx;
        for (gx = -20; gx <= 20.0001; gx += gridStep) {
            const xPos = HANDLE_PADDING + gx * usableSize;
            dGrid += `M ${xPos},${-FAR_PIXEL} L ${xPos},${FAR_PIXEL} `;
        }
        let gy;
        for (gy = -20; gy <= 20.0001; gy += gridStep) {
            const yPos = HANDLE_PADDING + gy * usableSize;
            dGrid += `M ${-FAR_PIXEL},${yPos} L ${FAR_PIXEL},${yPos} `;
        }
        document.getElementById('gridPath').setAttribute('d', dGrid);
        // Líneas mayores blancas (bordes: 0, 1, 2 ...)
        let dMajor = '';
        for (let mj = -20; mj <= 20.0001; mj += 1.0) {
            const mjx = HANDLE_PADDING + mj * usableSize;
            dMajor += `M ${mjx},${-FAR_PIXEL} L ${mjx},${FAR_PIXEL} `;
            const mjy = HANDLE_PADDING + mj * usableSize;
            dMajor += `M ${-FAR_PIXEL},${mjy} L ${FAR_PIXEL},${mjy} `;
        }
        document.getElementById('gridPathMajor').setAttribute('d', dMajor);

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
            isDraggingCustom = false;
            document.body.style.cursor = 'move';
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            // Elastic: left = freq (horizontal), Bounce: left = stiffness (vertical!)
            // Wave: left = freq (horizontal), Step: left = steps (horizontal)
            if (curveFamily === 'elastic') dragStartSpecial = { freq: specialElastic.freq };
            else if (curveFamily === 'bounce') dragStartSpecial = { peak: specialBounce.peak };
            else if (curveFamily === 'step') dragStartSpecial = { steps: specialStep.steps };
            else if (curveFamily === 'wave') dragStartSpecial = { freq: specialWave.freq };
            return;
        }
        isDraggingLeft = true; isDraggingRight = false; document.body.style.cursor = 'move'; dragStartX = e.clientX; dragStartY = e.clientY; dragStartValX = parseFloat(sliderOut.value); dragStartValY = handleLeftY; dragStartScale = (graphMode === 'value') ? currentViewScale : 1;
    }
    function startDragRight(e) {
        // Elastic: right = decay (vertical)
        if (curveFamily === 'elastic') {
            isDraggingRight = true;
            isDraggingLeft = false;
            isDraggingCustom = false;
            document.body.style.cursor = 'ns-resize';
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            dragStartSpecial = { decay: specialElastic.decay };
            return;
        }
        // Wave: right = decay (vertical)
        if (curveFamily === 'wave') {
            isDraggingRight = true;
            isDraggingLeft = false;
            isDraggingCustom = false;
            document.body.style.cursor = 'ns-resize';
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            dragStartSpecial = { decay: specialWave.decay };
            return;
        }
        // Bounce: right = count (horizontal)
        if (curveFamily === 'bounce') {
            isDraggingRight = true;
            isDraggingLeft = false;
            isDraggingCustom = false;
            document.body.style.cursor = 'ew-resize';
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            dragStartSpecial = { damp: specialBounce.damp };
            return;
        }
        if (curveFamily !== 'graph') return;
        isDraggingRight = true; isDraggingLeft = false; document.body.style.cursor = 'move'; dragStartX = e.clientX; dragStartY = e.clientY; dragStartValX = parseFloat(sliderIn.value); dragStartValY = handleRightY; dragStartScale = (graphMode === 'value') ? currentViewScale : 1;
    }
    // Wave: handle custom de Sharpness (arrastre vertical)
    function startDragWaveSharp(e) {
        if (curveFamily !== 'wave') return;
        isDraggingCustom = true;
        isDraggingLeft = false;
        isDraggingRight = false;
        customDragRef = 'sharp';
        document.body.style.cursor = 'ns-resize';
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        dragStartSpecial = { sharp: specialWave.sharp };
    }
    function showDragTooltip(px, py, text) {
        if (!_dragTooltip) return;
        _dragTooltip.setAttribute('x', px + 12);
        _dragTooltip.setAttribute('y', py - 8);
        _dragTooltip.textContent = text;
        _dragTooltip.style.display = '';
    }
    function hideDragTooltip() {
        if (!_dragTooltip) return;
        _dragTooltip.style.display = 'none';
    }

    function handleDrag(e) {
        // --- Curvas especiales: left handle ---
        if (curveFamily !== 'graph' && isDraggingLeft) {
            const rect = speedGraphSVG.getBoundingClientRect();
            if (curveFamily === 'elastic') {
                // Elastic Left = Freq (horizontal): x → 0.5/x = freq
                const uMouse = specialMouseU(e.clientX, rect);
                specialElastic.freq = Math.max(0.5, Math.min(10, 0.5 / Math.max(0.02, uMouse)));
                showDragTooltip(e.clientX - rect.left, e.clientY - rect.top, specialElastic.freq.toFixed(1));
            } else if (curveFamily === 'bounce') {
                // Bounce Left = Stiffness (VERTICAL): y → 1-y = stiffness
                const usable = rect.height - (HANDLE_PADDING * 2 * (rect.height / SVG_HEIGHT));
                const deltaY = (e.clientY - dragStartY) / Math.max(1, usable);
                specialBounce.peak = Math.max(0.01, Math.min(0.99, dragStartSpecial.peak + deltaY * 1.5));
                showDragTooltip(e.clientX - rect.left, e.clientY - rect.top, specialBounce.peak.toFixed(2));
            } else if (curveFamily === 'step') {
                const uMouse = specialMouseU(e.clientX, rect);
                specialStep.steps = stepStepsFromU(uMouse);
                showDragTooltip(e.clientX - rect.left, e.clientY - rect.top, Math.round(specialStep.steps).toString());
            } else if (curveFamily === 'wave') {
                // Wave Left = Freq (horizontal): x → 1/x = freq
                const uMouse = specialMouseU(e.clientX, rect);
                specialWave.freq = Math.max(0.5, Math.min(10, 1.0 / Math.max(0.05, uMouse)));
                showDragTooltip(e.clientX - rect.left, e.clientY - rect.top, specialWave.freq.toFixed(1));
            }
            updateGraphVisuals();
            return;
        }
        
        // --- Curvas especiales: right handle ---
        if (isDraggingRight && (curveFamily === 'wave' || curveFamily === 'elastic' || curveFamily === 'bounce')) {
            const rect = speedGraphSVG.getBoundingClientRect();
            
            if (curveFamily === 'wave') {
                // Wave Right = Decay (vertical): y → log mapping
                const usable = rect.height - (HANDLE_PADDING * 2 * (rect.height / SVG_HEIGHT));
                const deltaY = (e.clientY - dragStartY) / Math.max(1, usable);
                specialWave.decay = Math.max(0, Math.min(10, dragStartSpecial.decay + deltaY * 12));
                showDragTooltip(e.clientX - rect.left, e.clientY - rect.top, specialWave.decay.toFixed(1));
            } else if (curveFamily === 'elastic') {
                // Elastic Right = Decay (vertical)
                const usable = rect.height - (HANDLE_PADDING * 2 * (rect.height / SVG_HEIGHT));
                const deltaY = (e.clientY - dragStartY) / Math.max(1, usable);
                specialElastic.decay = Math.max(0.1, Math.min(20, dragStartSpecial.decay + deltaY * 12));
                showDragTooltip(e.clientX - rect.left, e.clientY - rect.top, specialElastic.decay.toFixed(1));
            } else if (curveFamily === 'bounce') {
                // Bounce Right = Count (horizontal)
                const uMouse = specialMouseU(e.clientX, rect);
                var newBounces = Math.max(1, Math.min(7, Math.round(uMouse * 10)));
                specialBounce.damp = (newBounces - 1) / 6;
                showDragTooltip(e.clientX - rect.left, e.clientY - rect.top, newBounces.toString());
            }
            updateGraphVisuals();
            return;
        }
        
        // --- Curvas especiales: custom handle ---
        if (isDraggingCustom) {
            const rect = speedGraphSVG.getBoundingClientRect();
            const usable = rect.height - (HANDLE_PADDING * 2 * (rect.height / SVG_HEIGHT));
            const deltaY = -(e.clientY - dragStartY) / Math.max(1, usable);
            
            if (curveFamily === 'wave' && customDragRef === 'sharp') {
                specialWave.sharp = Math.max(-1, Math.min(1, dragStartSpecial.sharp + deltaY * 2.5));
                showDragTooltip(e.clientX - rect.left, e.clientY - rect.top, specialWave.sharp.toFixed(2));
            } else if (curveFamily === 'elastic' && customDragRef === 'amp') {
                specialElastic.amp = Math.max(0.05, Math.min(1.5, dragStartSpecial.amp + deltaY * 2));
                showDragTooltip(e.clientX - rect.left, e.clientY - rect.top, specialElastic.amp.toFixed(2));
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
        hideDragTooltip();
        document.body.style.cursor = 'default';
    }

    dragGroupLeft.addEventListener('mousedown', startDragLeft);
    dragGroupRight.addEventListener('mousedown', startDragRight);
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', stopDrag);

    // --- Wave: crear 3er handle (Sharpness) en customHandleLayer ---
    var _waveSharpGroup = null;
    var _waveSharpPoint = null;
    var _waveSharpArea = null;
    (function createWaveSharpHandle() {
        var svgNS = 'http://www.w3.org/2000/svg';
        var layer = document.getElementById('customHandleLayer');
        if (!layer) return;
        _waveSharpGroup = document.createElementNS(svgNS, 'g');
        _waveSharpGroup.setAttribute('id', 'waveSharpGroup');
        _waveSharpGroup.style.cursor = 'ns-resize';
        _waveSharpGroup.style.display = 'none';
        _waveSharpArea = document.createElementNS(svgNS, 'rect');
        _waveSharpArea.setAttribute('width', '40');
        _waveSharpArea.setAttribute('height', '40');
        _waveSharpArea.setAttribute('fill', 'transparent');
        _waveSharpPoint = document.createElementNS(svgNS, 'circle');
        _waveSharpPoint.setAttribute('class', 'graph-handle-point graph-handle-hollow');
        _waveSharpPoint.setAttribute('r', '6');
        _waveSharpGroup.appendChild(_waveSharpArea);
        _waveSharpGroup.appendChild(_waveSharpPoint);
        layer.appendChild(_waveSharpGroup);
        _waveSharpGroup.addEventListener('mousedown', startDragWaveSharp);
    })();

    // --- Crear handles extra, guías y tooltip ---
    var _elasticAmpGroup = null;
    var _elasticAmpPoint = null;
    var _elasticAmpArea = null;
    var _envelopePath = null;
    var _dragTooltip = null;

    (function createSpecialCurveExtras() {
        var svgNS = 'http://www.w3.org/2000/svg';
        var svg = document.getElementById('speedGraphSVG');
        var layer = document.getElementById('customHandleLayer');
        if (!layer || !svg) return;

        // Elastic Amp handle (hollow circle)
        _elasticAmpGroup = document.createElementNS(svgNS, 'g');
        _elasticAmpGroup.setAttribute('id', 'elasticAmpGroup');
        _elasticAmpGroup.style.cursor = 'ns-resize';
        _elasticAmpGroup.style.display = 'none';
        _elasticAmpArea = document.createElementNS(svgNS, 'rect');
        _elasticAmpArea.setAttribute('width', '40');
        _elasticAmpArea.setAttribute('height', '40');
        _elasticAmpArea.setAttribute('fill', 'transparent');
        _elasticAmpPoint = document.createElementNS(svgNS, 'circle');
        _elasticAmpPoint.setAttribute('class', 'graph-handle-point graph-handle-hollow');
        _elasticAmpPoint.setAttribute('r', '6');
        _elasticAmpGroup.appendChild(_elasticAmpArea);
        _elasticAmpGroup.appendChild(_elasticAmpPoint);
        layer.appendChild(_elasticAmpGroup);
        _elasticAmpGroup.addEventListener('mousedown', function(e) {
            if (curveFamily !== 'elastic') return;
            isDraggingCustom = true;
            isDraggingLeft = false;
            isDraggingRight = false;
            customDragRef = 'amp';
            document.body.style.cursor = 'ns-resize';
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            dragStartSpecial = { amp: specialElastic.amp };
        });

        // Envelope guide path (dashed line)
        _envelopePath = document.createElementNS(svgNS, 'path');
        _envelopePath.setAttribute('class', 'graph-envelope-line');
        _envelopePath.setAttribute('d', '');
        _envelopePath.style.display = 'none';
        // Insert before curve so it's behind
        var graphCurveEl = document.getElementById('graphCurve');
        if (graphCurveEl && graphCurveEl.parentNode) {
            graphCurveEl.parentNode.insertBefore(_envelopePath, graphCurveEl);
        } else {
            svg.appendChild(_envelopePath);
        }

        // Drag tooltip text
        _dragTooltip = document.createElementNS(svgNS, 'text');
        _dragTooltip.setAttribute('class', 'graph-drag-tooltip');
        _dragTooltip.setAttribute('text-anchor', 'start');
        _dragTooltip.setAttribute('x', '0');
        _dragTooltip.setAttribute('y', '0');
        _dragTooltip.textContent = '';
        svg.appendChild(_dragTooltip);
    })();

    function syncLayoutFromWindow() {
        if (!mainLayout || !primaryColumn) return;
        mainLayout.classList.add('layout-vertical');
        mainLayout.classList.remove('layout-horizontal', 'presets-collapsed', 'has-fixed-split');
        primaryColumn.style.height = '';
        primaryColumn.style.flexBasis = '';
        primaryColumn.style.width = '';
        updateGraphVisuals();
        // Re-sync presets layout (horizontal/vertical) after graph redraws
        setTimeout(function () {
            if (typeof syncPresetsPanel === 'function') syncPresetsPanel();
        }, 20);
    }

    /** Normaliza el resultado de evalScript: JSX puede devolver el string literal "undefined"
     *  o cadena vacía cuando la función no tiene return; en ambos casos queremos fallback. */
    function _cleanEvalResult(result) {
        if (result === undefined || result === null) return '';
        const s = String(result).trim();
        if (s === '' || s === 'undefined' || s === 'null') return '';
        return s;
    }

    // --- KEYFRAME TYPES ---
    function setType(type) {
        var ns = isPPro ? '_GRAPHEDITORPR' : '_GRAPHEDITOR';
        var filters = isPPro ? ("'" + getActiveFilters() + "'") : '';
        var cmd = ns + ".setKeyframeType('" + type + "'" + (isPPro ? (',' + filters) : '') + ')';
        csInterface.evalScript(cmd, function (result) {
            applyBtn.innerText = _cleanEvalResult(result) || "OK";
            setTimeout(() => applyBtn.innerText = "APLICAR", 1500);
        });
    }

    /** Easy Ease y presets rápidos: siempre usan influencia temporal (graph), no el hornado elástico/rebote. */
    function applyGraphInfluenceFromSliders() {
        applyBtn.innerText = "APLICANDO...";
        const vOut = (graphMode === 'value') ? handleLeftY : 0;
        const vIn = (graphMode === 'value') ? (handleRightY - 1) : 0;
        var ns = isPPro ? '_GRAPHEDITORPR' : '_GRAPHEDITOR';
        var filtersArg = isPPro ? (",'" + getActiveFilters() + "'") : '';
        csInterface.evalScript(ns + '.applyInfluence(' + (sliderOut.value||50) + ',' + (sliderIn.value||50) + ',' + vOut + ',' + vIn + ",'" + graphMode + "'" + filtersArg + ')', function (result) {
            applyBtn.innerText = _cleanEvalResult(result) || "APLICADO";
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
            var _ns = isPPro ? '_GRAPHEDITORPR' : '_GRAPHEDITOR';

            var _fa = isPPro ? (',\'' + getActiveFilters() + '\'') : '';

            csInterface.evalScript(_ns + '.applyInfluence(' + (sliderOut.value||50) + ',' + (sliderIn.value||50) + ',' + vOut + ',' + vIn + ",'" + graphMode + "'" + _fa + ')', function (result) {

                applyBtn.innerText = _cleanEvalResult(result) || "APLICADO";
                setTimeout(() => applyBtn.innerText = "APLICAR", 2000);
            });
        } else {
            const raw = sampleSpecialCurvePoints();
            let pts = buildBakePointsFromSamples(raw);
            pts = normalizeBakeEndpoints(pts, curveFamily);

            if (isPPro) {
                // === PREMIERE PRO: siempre hornea keyframes (no hay expresiones en PPro) ===
                const filterStr = getActiveFilters();
                pts = downsampleBakePoints(pts, BAKE_MAX_INTERIOR, curveFamily);
                const payload = { type: curveFamily, points: pts, filters: filterStr };
                if (curveFamily === 'elastic') payload.params = { amp: specialElastic.amp, freq: specialElastic.freq, decay: specialElastic.decay };
                if (curveFamily === 'bounce') payload.params = { peak: specialBounce.peak, damp: specialBounce.damp };
                if (curveFamily === 'step') payload.params = { steps: specialStep.steps };
                if (curveFamily === 'wave') payload.params = { freq: specialWave.freq, decay: specialWave.decay, sharp: specialWave.sharp };
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
                    setTimeout(() => { applyBtn.innerText = "APLICAR"; }, 2200);
                });
            } else {
                // === AFTER EFFECTS: KEYS o EXPR según applyMethod ===
                if (applyMethod === 'keys') {
                    pts = downsampleBakePoints(pts, BAKE_MAX_INTERIOR, curveFamily);
                }
                const payload = { type: curveFamily, points: pts };
                if (curveFamily === 'elastic') payload.params = { amp: specialElastic.amp, freq: specialElastic.freq, decay: specialElastic.decay };
                if (curveFamily === 'bounce') payload.params = { peak: specialBounce.peak, damp: specialBounce.damp };
                if (curveFamily === 'step') payload.params = { steps: specialStep.steps };
                if (curveFamily === 'wave') payload.params = { freq: specialWave.freq, decay: specialWave.decay, sharp: specialWave.sharp };
                const inner = JSON.stringify(payload);
                const fn = (applyMethod === 'keys') ? '_GRAPHEDITOR.applyBakedSegment' : '_GRAPHEDITOR.applyExpressionSegment';
                const cmd = fn + '(' + JSON.stringify(inner) + ')';
                csInterface.evalScript(cmd, function (result) {
                    const r = _cleanEvalResult(result);
                    if (r.indexOf('OK:') === 0) {
                        const n = parseInt(r.slice(3), 10);
                        applyBtn.innerText = (isNaN(n) || n < 1) ? "NO APLICÓ" : "APLICADO";
                    } else if (r === '') {
                        applyBtn.innerText = "APLICADO";
                    } else {
                        applyBtn.innerText = r;
                        if (r.indexOf('EvalScript') !== -1 || r.indexOf('ERR:') === 0) {
                            setTimeout(() => { applyBtn.innerText = "RECARGA PANEL"; }, 1200);
                        }
                    }
                    setTimeout(() => { applyBtn.innerText = "APLICAR"; }, 2200);
                });
            }
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
            const fam = (famRaw === 'elastic' || famRaw === 'bounce' || famRaw === 'step' || famRaw === 'wave') ? famRaw : 'graph';

            if (fam === 'graph') {
                copyGraphInfluences();
                return;
            }

            // Auto-switch tab to detected family
            setFamilyUI(fam);

            // Se detectó una expresión GraphEditor → sincronizamos el toggle a "fx EXPR"
            setApplyMethod('expr');

            if (fam === 'elastic' && data.params) {
                specialElastic = { amp: data.params.amp || 0.5, freq: data.params.freq || 3.0, decay: data.params.decay || 4.0 };
            } else if (fam === 'bounce' && data.params) {
                specialBounce = { peak: data.params.peak, damp: data.params.damp };
            } else if (fam === 'step' && data.params) {
                specialStep = { steps: data.params.steps };
            } else if (fam === 'wave' && data.params) {
                specialWave = { freq: data.params.freq || 2.0, decay: data.params.decay || 0.0, sharp: data.params.sharp || 0.0 };
            }

            updateGraphVisuals();
        });
    });

    applyBtn.addEventListener('click', function() {
        applyToAE();
        // En PPro: refrescar propiedades disponibles despues de aplicar
        if (isPPro) {
            setTimeout(function() { if (typeof scanProps === 'function') scanProps(); }, 400);
        }
    });
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

    function setApplyMethod(m) {
        if (m !== 'expr' && m !== 'keys') return;
        applyMethod = m;
        if (btnApplyExpr) btnApplyExpr.classList.toggle('active', m === 'expr');
        if (btnApplyKeys) btnApplyKeys.classList.toggle('active', m === 'keys');
        try { localStorage.setItem('ge_applyMethod', m); } catch (eLS1) { }
    }
    if (btnApplyExpr) btnApplyExpr.addEventListener('click', () => setApplyMethod('expr'));
    if (btnApplyKeys) btnApplyKeys.addEventListener('click', () => setApplyMethod('keys'));

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

    // Aleatorio: mezcla los valores de la curva activa. Útil para descubrir
    // combinaciones interesantes sin arrastrar sliders manualmente.
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
            specialElastic.amp = rnd(0.1, 0.9);
            specialElastic.freq = rnd(1, 8);
            specialElastic.decay = rnd(0.5, 6);
        } else if (curveFamily === 'bounce') {
            specialBounce.peak = rnd(0.25, 0.85);
            specialBounce.damp = rnd(0.10, 0.90);
        } else if (curveFamily === 'step') {
            specialStep.steps = Math.max(2, Math.min(16, Math.round(rnd(2, 12))));
        } else if (curveFamily === 'wave') {
            specialWave.freq = rnd(0.5, 6);
            specialWave.decay = rnd(0, 4);
            specialWave.sharp = rnd(-0.8, 0.8);
        }
        updateGraphVisuals();
    }

    // Reset: vuelve a los valores por defecto de la curva activa.
    function resetCurrentCurve() {
        if (curveFamily === 'graph') {
            if (sliderOut) { sliderOut.value = 33.3; }
            if (sliderIn) { sliderIn.value = 33.3; }
            handleLeftY = 0;
            handleRightY = 1;
        } else if (curveFamily === 'elastic') {
            specialElastic.amp = 0.5;
            specialElastic.freq = 3.0;
            specialElastic.decay = 4.0;
        } else if (curveFamily === 'bounce') {
            specialBounce.peak = 0.55;
            specialBounce.damp = 0.45;
        } else if (curveFamily === 'step') {
            specialStep.steps = 5;
        } else if (curveFamily === 'wave') {
            specialWave.freq = 2.0;
            specialWave.decay = 0.0;
            specialWave.sharp = 0.0;
        }
        updateGraphVisuals();
    }

    if (randomizeBtn) {
        randomizeBtn.addEventListener('click', () => {
            randomizeCurrentCurve();
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', () => {
            resetCurrentCurve();
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

    // =========================================================
    // =================== PRESETS SYSTEM ======================
    // =========================================================

    const DEFAULT_PRESETS = [
        // --- Graph (Bezier) ---
        { id: 'ease_in',     family: 'graph',   name: 'Ease In',     o: 0,   i: 70,  isDefault: true },
        { id: 'ease_out',    family: 'graph',   name: 'Ease Out',    o: 70,  i: 0,   isDefault: true },
        { id: 'ease_in_out', family: 'graph',   name: 'Ease In Out', o: 70,  i: 70,  isDefault: true },
        { id: 'linear',      family: 'graph',   name: 'Linear',      o: 0.1, i: 0.1, isDefault: true },
        { id: 'steep_in',    family: 'graph',   name: 'Steep In',    o: 0,   i: 100, isDefault: true },
        { id: 'steep_out',   family: 'graph',   name: 'Steep Out',   o: 100, i: 0,   isDefault: true },
        { id: 'expo_in',     family: 'graph',   name: 'Expo In',     o: 0,   i: 90,  isDefault: true },
        { id: 'expo_out',    family: 'graph',   name: 'Expo Out',    o: 90,  i: 0,   isDefault: true },
        { id: 'sharp_in',    family: 'graph',   name: 'Sharp In',    o: 50,  i: 100, isDefault: true },
        { id: 'sharp_out',   family: 'graph',   name: 'Sharp Out',   o: 100, i: 50,  isDefault: true },
        // --- Elastic ---
        { id: 'el_spring',   family: 'elastic', name: 'Spring',   amp: 1,   freq: 3,   decay: 4,  isDefault: true },
        { id: 'el_soft',     family: 'elastic', name: 'Soft',     amp: 0.5, freq: 2,   decay: 6,  isDefault: true },
        { id: 'el_bouncy',   family: 'elastic', name: 'Bouncy',   amp: 1,   freq: 5,   decay: 3,  isDefault: true },
        { id: 'el_tight',    family: 'elastic', name: 'Tight',    amp: 0.7, freq: 4,   decay: 8,  isDefault: true },
        { id: 'el_wobbly',   family: 'elastic', name: 'Wobbly',   amp: 1.2, freq: 2,   decay: 2,  isDefault: true },
        // --- Bounce ---
        { id: 'bo_standard', family: 'bounce',  name: 'Standard', peak: 0.55, damp: 0.45, isDefault: true },
        { id: 'bo_light',    family: 'bounce',  name: 'Light',    peak: 0.3,  damp: 0.3,  isDefault: true },
        { id: 'bo_heavy',    family: 'bounce',  name: 'Heavy',    peak: 0.7,  damp: 0.6,  isDefault: true },
        { id: 'bo_rubber',   family: 'bounce',  name: 'Rubber',   peak: 0.8,  damp: 0.2,  isDefault: true },
        { id: 'bo_quick',    family: 'bounce',  name: 'Quick',    peak: 0.4,  damp: 0.7,  isDefault: true },
        // --- Wave ---
        { id: 'wa_sine',     family: 'wave',    name: 'Sine',     freq: 2.5, decay: 0, sharp: 0,  isDefault: true },
        { id: 'wa_triangle', family: 'wave',    name: 'Triangle', freq: 2.5, decay: 0, sharp: 1,  isDefault: true },
        { id: 'wa_square',   family: 'wave',    name: 'Square',   freq: 2.5, decay: 0, sharp: -1, isDefault: true },
        { id: 'wa_damped',   family: 'wave',    name: 'Damped',   freq: 2.5, decay: 3, sharp: 0,  isDefault: true },
        { id: 'wa_fast',     family: 'wave',    name: 'Fast',     freq: 5,   decay: 0, sharp: 0,  isDefault: true },
        // --- Step ---
        { id: 'st_2',        family: 'step',    name: '2 Steps',  steps: 2,  isDefault: true },
        { id: 'st_4',        family: 'step',    name: '4 Steps',  steps: 4,  isDefault: true },
        { id: 'st_5',        family: 'step',    name: '5 Steps',  steps: 5,  isDefault: true },
        { id: 'st_8',        family: 'step',    name: '8 Steps',  steps: 8,  isDefault: true },
        { id: 'st_12',       family: 'step',    name: '12 Steps', steps: 12, isDefault: true },
    ];

    // State
    let customPresets = [];
    let favoritesSet = new Set();
    let selectedPresetId = null;
    let showingFavoritesOnly = false;
    let presetsVisible = false;

    // Load from localStorage
    try {
        const cs = localStorage.getItem('ge_customPresets');
        if (cs) customPresets = JSON.parse(cs);
    } catch (e) {}
    try {
        const fs = localStorage.getItem('ge_favorites');
        if (fs) favoritesSet = new Set(JSON.parse(fs));
    } catch (e) {}
    try {
        const pv = localStorage.getItem('ge_presetsVisible');
        if (pv === 'true') presetsVisible = true;
    } catch (e) {}

    function saveCustomPresets() {
        try { localStorage.setItem('ge_customPresets', JSON.stringify(customPresets)); } catch (e) {}
    }
    function saveFavorites() {
        try { localStorage.setItem('ge_favorites', JSON.stringify([...favoritesSet])); } catch (e) {}
    }
    function savePresetsVisible() {
        try { localStorage.setItem('ge_presetsVisible', presetsVisible ? 'true' : 'false'); } catch (e) {}
    }

    function getAllPresets() {
        return DEFAULT_PRESETS.concat(customPresets);
    }

    // Generate SVG mini preview for a preset
    function presetSVGPreview(preset) {
        const W = 40, H = 28, N = 40, PAD = 2;
        let rawY = [];
        for (let i = 0; i <= N; i++) {
            const u = i / N;
            let y = 0;
            if (preset.family === 'graph') {
                // Real velocity curve: compute speed = dy/dx from bezier control points
                const cp1x = (preset.o || 0) / 100;
                const cp2x = 1 - (preset.i || 0) / 100;
                const dx = cubicBezierDerivative(u, 0, cp1x, cp2x, 1);
                const dy = cubicBezierDerivative(u, 0, 0, 1, 1);
                y = (dx > 0.0001) ? dy / dx : 0;
            } else if (preset.family === 'elastic') {
                y = easeOutElasticControlled(u, preset.amp, preset.freq, preset.decay);
            } else if (preset.family === 'bounce') {
                const bounces = Math.max(1, Math.min(7, Math.round(1 + (preset.damp || 0.45) * 6)));
                y = easeOutBounceControlled(u, bounces, preset.peak || 0.55);
            } else if (preset.family === 'wave') {
                y = easeWave(u, preset.freq || 2.5, preset.decay || 0, preset.sharp || 0);
            } else if (preset.family === 'step') {
                const s = preset.steps || 5;
                y = s <= 2 ? u : Math.min(1, Math.floor(u * s) / (s - 1));
            }
            rawY.push(y);
        }
        // Auto-scale to fit the preview
        let yMin = rawY[0], yMax = rawY[0];
        for (let i = 1; i < rawY.length; i++) {
            if (rawY[i] < yMin) yMin = rawY[i];
            if (rawY[i] > yMax) yMax = rawY[i];
        }
        const yRange = Math.max(0.01, yMax - yMin);
        let points = [];
        for (let i = 0; i <= N; i++) {
            const px = PAD + ((W - PAD * 2) * i / N);
            const py = (H - PAD) - ((rawY[i] - yMin) / yRange) * (H - PAD * 2);
            points.push(px.toFixed(1) + ',' + py.toFixed(1));
        }
        return '<svg class="preset-icon" viewBox="0 0 ' + W + ' ' + H + '"><path d="M' + points.join(' L') + '" /></svg>';
    }

    function renderPresets() {
        const grid = document.getElementById('presetsGrid');
        if (!grid) return;
        grid.innerHTML = '';
        const all = getAllPresets().filter(function (p) { return p.family === curveFamily; });
        const list = showingFavoritesOnly ? all.filter(function (p) { return favoritesSet.has(p.id); }) : all;
        list.forEach(function (p) {
            const card = document.createElement('div');
            card.className = 'preset-card';
            if (p.id === selectedPresetId) card.classList.add('is-selected');
            if (favoritesSet.has(p.id)) card.classList.add('is-favorite');
            if (!p.isDefault) card.classList.add('is-custom');
            card.innerHTML = presetSVGPreview(p) + '<div class="preset-name">' + p.name + '</div>';
            card.addEventListener('click', function () {
                selectedPresetId = p.id;
                applyPreset(p);
                renderPresets();
                updateFavBtn();
            });
            grid.appendChild(card);
        });
    }

    function applyPreset(p) {
        if (p.family === 'graph') {
            if (sliderOut) sliderOut.value = p.o;
            if (sliderIn) sliderIn.value = p.i;
            updateGraphVisuals();
        } else if (p.family === 'elastic') {
            specialElastic.amp = p.amp;
            specialElastic.freq = p.freq;
            specialElastic.decay = p.decay;
            updateGraphVisuals();
        } else if (p.family === 'bounce') {
            specialBounce.peak = p.peak;
            specialBounce.damp = p.damp;
            updateGraphVisuals();
        } else if (p.family === 'wave') {
            specialWave.freq = p.freq;
            specialWave.decay = p.decay;
            specialWave.sharp = p.sharp;
            updateGraphVisuals();
        } else if (p.family === 'step') {
            specialStep.steps = p.steps;
            updateGraphVisuals();
        }
    }

    function updateFavBtn() {
        const btn = document.getElementById('presetFavToggleBtn');
        if (!btn) return;
        if (selectedPresetId && favoritesSet.has(selectedPresetId)) {
            btn.classList.add('is-on');
        } else {
            btn.classList.remove('is-on');
        }
    }

    function togglePresetsPanel() {
        presetsVisible = !presetsVisible;
        savePresetsVisible();
        syncPresetsPanel();
    }

    function syncPresetsPanel() {
        const panel = document.getElementById('presetsPanel');
        const configBtn = document.getElementById('presetsConfigBtn');
        if (panel) {
            if (presetsVisible) {
                panel.classList.remove('is-collapsed');
            } else {
                panel.classList.add('is-collapsed');
            }
        }
        if (configBtn) {
            configBtn.classList.toggle('is-active', presetsVisible);
        }
        if (presetsVisible) renderPresets();
    }

    // Init presets UI
    (function initPresets() {
        const configBtn = document.getElementById('presetsConfigBtn');
        const presetsToggle = document.getElementById('presetsToggle');
        const favBtn = document.getElementById('presetFavToggleBtn');
        const addBtn = document.getElementById('addPresetBtn');
        const removeBtn = document.getElementById('removePresetBtn');
        const filterAll = document.getElementById('presetFilterAll');
        const filterFav = document.getElementById('presetFilterFav');
        const modal = document.getElementById('presetNameModal');
        const modalInput = document.getElementById('presetNameInput');
        const modalOk = document.getElementById('presetNameOk');
        const modalCancel = document.getElementById('presetNameCancel');

        if (configBtn) {
            configBtn.addEventListener('click', togglePresetsPanel);
        }
        if (presetsToggle) {
            presetsToggle.addEventListener('click', togglePresetsPanel);
        }

        if (favBtn) {
            favBtn.addEventListener('click', function () {
                if (!selectedPresetId) return;
                if (favoritesSet.has(selectedPresetId)) {
                    favoritesSet.delete(selectedPresetId);
                } else {
                    favoritesSet.add(selectedPresetId);
                }
                saveFavorites();
                renderPresets();
                updateFavBtn();
            });
        }

        if (addBtn && modal) {
            addBtn.addEventListener('click', function () {
                if (modalInput) modalInput.value = '';
                modal.style.display = 'flex';
                setTimeout(function () { if (modalInput) modalInput.focus(); }, 50);
            });
        }

        if (modalOk && modal && modalInput) {
            modalOk.addEventListener('click', function () {
                const name = (modalInput.value || '').trim();
                if (!name) return;
                const newPreset = { id: 'cust_' + Date.now(), family: curveFamily, name: name, isDefault: false };
                if (curveFamily === 'graph') {
                    newPreset.o = sliderOut ? parseFloat(sliderOut.value) : 50;
                    newPreset.i = sliderIn ? parseFloat(sliderIn.value) : 50;
                } else if (curveFamily === 'elastic') {
                    newPreset.amp = specialElastic.amp;
                    newPreset.freq = specialElastic.freq;
                    newPreset.decay = specialElastic.decay;
                } else if (curveFamily === 'bounce') {
                    newPreset.peak = specialBounce.peak;
                    newPreset.damp = specialBounce.damp;
                } else if (curveFamily === 'wave') {
                    newPreset.freq = specialWave.freq;
                    newPreset.decay = specialWave.decay;
                    newPreset.sharp = specialWave.sharp;
                } else if (curveFamily === 'step') {
                    newPreset.steps = specialStep.steps;
                }
                customPresets.push(newPreset);
                saveCustomPresets();
                selectedPresetId = newPreset.id;
                modal.style.display = 'none';
                renderPresets();
                updateFavBtn();
            });
        }

        if (modalCancel && modal) {
            modalCancel.addEventListener('click', function () {
                modal.style.display = 'none';
            });
        }

        if (removeBtn) {
            removeBtn.addEventListener('click', function () {
                if (!selectedPresetId) {
                    // Flash the button to show nothing is selected
                    removeBtn.style.color = '#f44';
                    setTimeout(function () { removeBtn.style.color = ''; }, 400);
                    return;
                }
                // Check if it's a default preset
                var isDefault = DEFAULT_PRESETS.some(function (p) { return p.id === selectedPresetId; });
                if (isDefault) {
                    // Flash red — can't delete defaults
                    removeBtn.style.color = '#f44';
                    setTimeout(function () { removeBtn.style.color = ''; }, 400);
                    return;
                }
                var idx = customPresets.findIndex(function (p) { return p.id === selectedPresetId; });
                if (idx === -1) return;
                customPresets.splice(idx, 1);
                saveCustomPresets();
                favoritesSet.delete(selectedPresetId);
                saveFavorites();
                selectedPresetId = null;
                renderPresets();
                updateFavBtn();
            });
        }

        if (filterAll) {
            filterAll.addEventListener('click', function () {
                showingFavoritesOnly = false;
                filterAll.classList.add('active');
                if (filterFav) filterFav.classList.remove('active');
                renderPresets();
            });
        }

        if (filterFav) {
            filterFav.addEventListener('click', function () {
                showingFavoritesOnly = true;
                filterFav.classList.add('active');
                if (filterAll) filterAll.classList.remove('active');
                renderPresets();
            });
        }

        // Sync on init
        syncPresetsPanel();
    })();

    // Re-render presets when curve family changes
    const _origCurveBtns = document.querySelectorAll('.curve-type-btn');
    _origCurveBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            selectedPresetId = null;
            setTimeout(function () {
                if (presetsVisible) renderPresets();
                updateFavBtn();
            }, 50);
        });
    });

    // =========================================================
    // ========= RESIZE GUTTER & RESPONSIVE LAYOUT =============
    // =========================================================

    function updatePresetsLayout() {
        const ml = document.getElementById('mainLayout');
        if (!ml) return;
        const w = ml.offsetWidth;
        const h = ml.offsetHeight;
        // Wide panel → horizontal (presets to the side), narrow → vertical (presets below)
        if (presetsVisible && w > 350 && w > h * 1.2) {
            ml.classList.add('layout-horizontal');
            ml.classList.remove('layout-vertical');
        } else {
            ml.classList.remove('layout-horizontal');
            ml.classList.add('layout-vertical');
        }
    }


    // Enhanced syncPresetsPanel to show/hide gutter + manage collapsed class
    syncPresetsPanel = function () {
        const panel = document.getElementById('presetsPanel');
        const configBtn = document.getElementById('presetsConfigBtn');
        const gutter = document.getElementById('resizeGutter');
        const ml = document.getElementById('mainLayout');
        if (panel) {
            if (presetsVisible) {
                panel.classList.remove('is-collapsed');
                if (ml) ml.classList.remove('presets-collapsed');
            } else {
                panel.classList.add('is-collapsed');
                if (ml) ml.classList.add('presets-collapsed');
            }
        }
        if (gutter) {
            gutter.style.display = presetsVisible ? 'flex' : 'none';
        }
        if (configBtn) {
            configBtn.classList.toggle('is-active', presetsVisible);
        }
        if (presetsVisible) {
            updatePresetsLayout();
            renderPresets();
        }
        setTimeout(updateGraphVisuals, 30);
    };

    // Drag-resize
    (function initResizeGutter() {
        const gutter = document.getElementById('resizeGutter');
        const ml = document.getElementById('mainLayout');
        const pc = document.getElementById('primaryColumn');
        if (!gutter || !ml || !pc) return;

        let isDragging = false;
        let startPos = 0;
        let startSize = 0;

        gutter.addEventListener('mousedown', function (e) {
            e.preventDefault();
            isDragging = true;
            gutter.classList.add('is-dragging');
            const isHorizontal = ml.classList.contains('layout-horizontal');
            startPos = isHorizontal ? e.clientX : e.clientY;
            startSize = isHorizontal ? pc.offsetWidth : pc.offsetHeight;
            document.body.style.cursor = isHorizontal ? 'col-resize' : 'row-resize';
            document.body.style.userSelect = 'none';
        });

        document.addEventListener('mousemove', function (e) {
            if (!isDragging) return;
            const isHorizontal = ml.classList.contains('layout-horizontal');
            const delta = isHorizontal
                ? e.clientX - startPos
                : e.clientY - startPos;
            const totalSize = isHorizontal ? ml.offsetWidth : ml.offsetHeight;
            const newSize = Math.max(100, Math.min(totalSize - 80, startSize + delta));
            ml.classList.add('has-fixed-split');
            if (isHorizontal) {
                pc.style.width = newSize + 'px';
                pc.style.height = '';
            } else {
                pc.style.height = newSize + 'px';
                pc.style.width = '';
            }
        });

        document.addEventListener('mouseup', function () {
            if (!isDragging) return;
            isDragging = false;
            gutter.classList.remove('is-dragging');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            setTimeout(updateGraphVisuals, 30);
        });
    })();

    // Listen for window resize to update layout
    window.addEventListener('resize', function () {
        if (presetsVisible) updatePresetsLayout();
    });

    // Re-sync now that resize logic is ready
    syncPresetsPanel();


    function getActiveFilters() {
        if (!isPPro) return "";
        const activeFilters = [];
        document.querySelectorAll('.filter-pill.active').forEach(function (p) {
            activeFilters.push(p.dataset.filter);
        });
        return activeFilters.join(',');
    }

    var lastScanResultStr = "";
    function _parseScanResult(raw) {
        if (!raw) return [];
        return raw.split(',').filter(Boolean).map(function(s) {
            var parts = s.split('~');
            if (parts.length >= 4) {
                return { clipIdx: parts[0], compIdx: parts[1], compName: parts[2] || '', propName: parts[3] || '' };
            }
            return { clipIdx: '*', compIdx: '*', compName: '', propName: parts[0] || s };
        });
    }

    function _buildLabels(entries) {
        var byProp = {};
        entries.forEach(function(e) { if (!byProp[e.propName]) byProp[e.propName] = []; byProp[e.propName].push(e); });
        var labels = {};
        Object.keys(byProp).forEach(function(propName) {
            var arr = byProp[propName];
            if (arr.length <= 1) { labels[arr[0].clipIdx + '~' + arr[0].compIdx + '~' + propName] = propName; return; }
            var compCounts = {}; arr.forEach(function(e) { compCounts[e.compName] = (compCounts[e.compName] || 0) + 1; });
            var seen = {};
            arr.forEach(function(e) {
                var n = (seen[e.compName] || 0) + 1; seen[e.compName] = n;
                var needNum = (compCounts[e.compName] || 0) > 1;
                var compLabel = e.compName ? (needNum ? e.compName + ' ' + n : e.compName) : '#' + n;
                labels[e.clipIdx + '~' + e.compIdx + '~' + propName] = propName + ' \u00b7 ' + compLabel;
            });
        });
        return labels;
    }

    function scanProps() {
        if (!isPPro) return;
        csInterface.evalScript('_GRAPHEDITORPR.scanActiveProperties()', function (result) {
            if (result === lastScanResultStr) return;
            lastScanResultStr = result;
            var filterRow = document.getElementById('filterRow');
            if (!filterRow) return;
            var previousState = {};
            filterRow.querySelectorAll('.filter-pill').forEach(function(btn) { previousState[btn.dataset.filter] = btn.classList.contains('active'); });
            var entries = _parseScanResult(result);
            var labels = _buildLabels(entries);
            filterRow.innerHTML = '';
            entries.forEach(function(e) {
                var filterKey = e.clipIdx + '~' + e.compIdx + '~' + e.propName;
                var label = labels[filterKey] || e.propName;
                var btn = document.createElement('button');
                btn.className = 'filter-pill is-available';
                btn.dataset.filter = filterKey;
                btn.textContent = label;
                btn.title = label;
                if (previousState.hasOwnProperty(filterKey)) { if (previousState[filterKey]) btn.classList.add('active'); } else { btn.classList.add('active'); }
                btn.addEventListener('click', function() { this.classList.toggle('active'); });
                filterRow.appendChild(btn);
            });
            var hasAny = filterRow.querySelectorAll('.filter-pill').length > 0;
            filterRow.classList.toggle('is-empty', !hasAny);
        });
    }

    // scanProps interval para PPro — igual que referencia original
    if (isPPro) {
        window.addEventListener('focus', scanProps);
        setInterval(scanProps, 1500);
    }

    // cleanBtn: solo PPro — limpia curva (keyframes intermedios) del segmento activo
    var _cb = document.getElementById('cleanBtn');
    if (_cb && isPPro) {
        _cb.addEventListener('click', function() {
            var filters = getActiveFilters();
            applyBtn.innerText = 'LIMPIANDO...';
            csInterface.evalScript('_GRAPHEDITORPR.cleanCurve(\'' + filters.replace(/\'/g, '\\\'') + '\')', function(result) {
                applyBtn.innerText = result || 'LIMPIO';
                setTimeout(function() { applyBtn.innerText = 'APLICAR'; }, 1500);
                setTimeout(function() { if (typeof scanProps === 'function') scanProps(); }, 400);
            });
        });
    }

})();