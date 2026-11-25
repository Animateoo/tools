// ── Animateo Portfolio — Motion Design Showcase + Interactive Estimator ──
(function () {
    'use strict';

    // 1. Pointer Glow & Particle Canvas (identical to home)
    var glow = document.getElementById('pointerGlow');
    if (glow) {
        window.addEventListener('mousemove', function (e) {
            glow.style.transform = 'translate(' + e.clientX + 'px, ' + e.clientY + 'px) translate(-50%, -50%)';
        });
    }

    var pCanvas = document.getElementById('particleCanvas');
    if (pCanvas) {
        var pCtx = pCanvas.getContext('2d');
        var particles = [];
        var pw, ph;

        function resizeP() {
            pw = pCanvas.width = window.innerWidth;
            ph = pCanvas.height = window.innerHeight;
        }
        window.addEventListener('resize', resizeP);
        resizeP();

        var count = Math.floor(window.innerWidth / 30);
        for (var i = 0; i < count; i++) {
            particles.push({
                x: Math.random() * pw,
                y: Math.random() * ph,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 2 + 0.5,
                alpha: Math.random() * 0.5 + 0.1
            });
        }

        function drawP() {
            pCtx.clearRect(0, 0, pw, ph);
            pCtx.fillStyle = '#d97706';
            particles.forEach(function (p) {
                p.x += p.vx;
                p.y += p.vy;
                if (p.x < 0) p.x = pw;
                if (p.x > pw) p.x = 0;
                if (p.y < 0) p.y = ph;
                if (p.y > ph) p.y = 0;
                pCtx.globalAlpha = p.alpha;
                pCtx.beginPath();
                pCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                pCtx.fill();
            });
            requestAnimationFrame(drawP);
        }
        drawP();
    }

    // 2. Hero Live Motion Design 2D Canvas Showcase
    var mCanvas = document.getElementById('motionShowcaseCanvas');
    var mFill = document.getElementById('motionScrubFill');
    var mTc = document.getElementById('motionTimecode');
    if (mCanvas) {
        var ctx = mCanvas.getContext('2d');
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var mw = 480, mh = 330;
        var mx = 0.5, my = 0.5;

        function resizeM() {
            var rect = mCanvas.parentElement.getBoundingClientRect();
            mw = Math.max(320, Math.round(rect.width));
            mh = Math.max(220, Math.round(rect.height));
            mCanvas.width = mw * dpr;
            mCanvas.height = mh * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }
        window.addEventListener('resize', resizeM);
        resizeM();

        mCanvas.addEventListener('mousemove', function (e) {
            var r = mCanvas.getBoundingClientRect();
            mx = (e.clientX - r.left) / r.width;
            my = (e.clientY - r.top) / r.height;
        });

        function easeInOutCubic(t) {
            return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
        }

        function cubicBezier(p0, p1, p2, p3, t) {
            var u = 1 - t;
            return {
                x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
                y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
            };
        }

        var startTime = performance.now();
        var loopDur = 6000; // 6 seconds loop

        function drawMotion(now) {
            var elapsed = (now - startTime) % loopDur;
            var rawT = elapsed / loopDur;
            var pingPong = rawT < 0.5 ? rawT * 2 : (1 - rawT) * 2;
            var t = easeInOutCubic(pingPong);

            ctx.clearRect(0, 0, mw, mh);

            // Background subtle grid
            ctx.strokeStyle = 'rgba(255,255,255,0.045)';
            ctx.lineWidth = 1;
            var step = 28;
            for (var gx = step; gx < mw; gx += step) {
                ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, mh); ctx.stroke();
            }
            for (var gy = step; gy < mh; gy += step) {
                ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(mw, gy); ctx.stroke();
            }

            // Parallax offset from mouse
            var ox = (mx - 0.5) * 18;
            var oy = (my - 0.5) * 14;

            // Ambient orange radial glow
            var grd = ctx.createRadialGradient(mw * 0.5 + ox, mh * 0.5 + oy, 10, mw * 0.5, mh * 0.5, mw * 0.55);
            grd.addColorStop(0, 'rgba(217, 119, 6, 0.22)');
            grd.addColorStop(1, 'rgba(9, 9, 14, 0)');
            ctx.fillStyle = grd;
            ctx.fillRect(0, 0, mw, mh);

            // Bezier motion path coordinates
            var p0 = { x: mw * 0.12, y: mh * 0.72 };
            var p1 = { x: mw * 0.34 + ox * 0.8, y: mh * 0.14 + oy * 0.8 };
            var p2 = { x: mw * 0.66 - ox * 0.8, y: mh * 0.86 - oy * 0.8 };
            var p3 = { x: mw * 0.88, y: mh * 0.28 };

            // Draw dashed motion path
            ctx.save();
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y);
            ctx.bezierCurveTo(p1.x, p1.y, p2.x, p2.y, p3.x, p3.y);
            ctx.stroke();
            ctx.restore();

            // Draw Bezier tangent handles
            ctx.strokeStyle = 'rgba(217, 119, 6, 0.65)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y);
            ctx.moveTo(p3.x, p3.y); ctx.lineTo(p2.x, p2.y);
            ctx.stroke();

            // Tangent handle dots
            [p1, p2].forEach(function (pt) {
                ctx.fillStyle = '#09090e';
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
                ctx.fill(); ctx.stroke();
            });

            // Start & End anchor keyframe diamonds
            [p0, p3].forEach(function (pt) {
                ctx.save();
                ctx.translate(pt.x, pt.y);
                ctx.rotate(Math.PI / 4);
                ctx.fillStyle = '#d97706';
                ctx.fillRect(-5, -5, 10, 10);
                ctx.restore();
            });

            // Trailing ghost echoes along curve (motion blur feel)
            for (var g = 5; g >= 1; g--) {
                var gt = Math.max(0, Math.min(1, t - g * 0.025 * (rawT < 0.5 ? 1 : -1)));
                var gp = cubicBezier(p0, p1, p2, p3, gt);
                ctx.save();
                ctx.translate(gp.x, gp.y);
                ctx.rotate(gt * Math.PI * 2);
                ctx.strokeStyle = 'rgba(245, 158, 11, ' + (0.28 - g * 0.045) + ')';
                ctx.lineWidth = 1.5;
                var gs = 18 - g * 1.5;
                ctx.strokeRect(-gs, -gs, gs * 2, gs * 2);
                ctx.restore();
            }

            // Main animated kinetic shape on curve
            var cur = cubicBezier(p0, p1, p2, p3, t);
            var pulse = 1 + Math.sin(rawT * Math.PI * 4) * 0.08;
            ctx.save();
            ctx.translate(cur.x, cur.y);
            ctx.rotate(t * Math.PI * 2);
            ctx.scale(pulse, pulse);

            // Outer selection bounding box (After Effects style)
            ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            ctx.lineWidth = 1;
            ctx.strokeRect(-26, -26, 52, 52);

            // Inner glowing orange shape
            ctx.fillStyle = '#d97706';
            ctx.shadowColor = 'rgba(245, 158, 11, 0.75)';
            ctx.shadowBlur = 18;
            ctx.beginPath();
            ctx.roundRect(-18, -18, 36, 36, 7);
            ctx.fill();

            // Center anchor crosshair
            ctx.shadowBlur = 0;
            ctx.strokeStyle = '#09090e';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(-6, 0); ctx.lineTo(6, 0);
            ctx.moveTo(0, -6); ctx.lineTo(0, 6);
            ctx.stroke();
            ctx.restore();

            // Kinetic typography HUD overlay
            ctx.save();
            ctx.font = '700 italic 13px "Space Grotesk", sans-serif';
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.fillText('ANIMATEO // MOTION 2D', 16, 26);

            ctx.font = '500 10px "JetBrains Mono", monospace';
            ctx.fillStyle = 'rgba(217,119,6,0.9)';
            ctx.fillText('EASE: CUBIC-BEZIER · POS [' + Math.round(cur.x) + ', ' + Math.round(cur.y) + ']', 16, mh - 14);
            ctx.restore();

            // Update mini timeline scrubber & timecode
            if (mFill) mFill.style.width = (rawT * 100).toFixed(1) + '%';
            if (mTc) {
                var sec = Math.floor(elapsed / 1000);
                var frames = Math.floor(((elapsed % 1000) / 1000) * 60);
                mTc.textContent = '00:00:0' + sec + ':' + (frames < 10 ? '0' : '') + frames;
            }

            requestAnimationFrame(drawMotion);
        }
        requestAnimationFrame(drawMotion);
    }

    // 3. Strike-exact Price Estimator (No WhatsApp — Correo + Discord)
    var formatBtns = document.querySelectorAll('.tr-est-format-btn');
    var planBtns = document.querySelectorAll('.tr-est-plan');
    var slider = document.getElementById('durationRange');
    var sliderLabel = document.getElementById('sliderLabel');
    var durationDisplay = document.getElementById('durationDisplay');
    var priorityCheck = document.getElementById('priorityCheck');
    var totalEl = document.getElementById('estTotal');
    var metaEl = document.getElementById('estMeta');
    var ctaBtn = document.getElementById('estCtaBtn');

    var priceBasic = document.getElementById('priceBasic');
    var priceInter = document.getElementById('priceInter');
    var priceComp = document.getElementById('priceComp');

    var config = {
        vertical: {
            unitLabel: 'Cantidad de piezas',
            min: 1,
            max: 10,
            defaultVal: 1,
            basic: { rate: 17, unit: '/ pieza', label: 'Básica' },
            intermediate: { rate: 25, unit: '/ pieza', label: 'Intermedia' },
            complex: { rate: 60, unit: '/ pieza', label: 'Compleja' }
        },
        horizontal: {
            unitLabel: 'Duración final',
            min: 1,
            max: 30,
            defaultVal: 10,
            basic: { rate: 52, unit: '/ 10 min', label: 'Básica' },
            intermediate: { rate: 75, unit: '/ 10 min', label: 'Intermedia' },
            complex: { rate: 125, unit: '/ 10 min', label: 'Compleja' }
        }
    };

    var currentFormat = 'vertical';
    var currentPlan = 'complex';

    function updateCardPrices() {
        var c = config[currentFormat];
        if (priceBasic) priceBasic.innerHTML = '$' + c.basic.rate + ' <small>' + c.basic.unit + '</small>';
        if (priceInter) priceInter.innerHTML = '$' + c.intermediate.rate + ' <small>' + c.intermediate.unit + '</small>';
        if (priceComp) priceComp.innerHTML = '$' + c.complex.rate + ' <small>' + c.complex.unit + '</small>';
    }

    function updateEstimate() {
        if (!slider || !totalEl) return;
        var c = config[currentFormat];
        var plan = c[currentPlan];
        var val = parseInt(slider.value, 10);
        var isPriority = priorityCheck && priorityCheck.checked;

        var subtotal;
        if (currentFormat === 'vertical') {
            subtotal = plan.rate * val;
            if (durationDisplay) durationDisplay.textContent = val + (val === 1 ? ' video' : ' videos');
        } else {
            subtotal = Math.round((plan.rate / 10) * val);
            if (durationDisplay) durationDisplay.textContent = val + (val === 1 ? ' minuto' : ' minutos');
        }

        var total = isPriority ? Math.round(subtotal * 1.3) : subtotal;
        totalEl.innerHTML = '$' + total + ' <small>USD</small>';

        if (metaEl) {
            metaEl.innerHTML =
                '• Una ronda de ajustes<br>' +
                '• Exportación final' +
                (isPriority ? '<br>• Entrega prioritaria (+30%)' : '');
        }

        if (ctaBtn) {
            var qtyText = currentFormat === 'vertical'
                ? (val + (val === 1 ? ' video vertical' : ' videos verticales'))
                : (val + ' min horizontal');
            var subject = 'Consulta de proyecto — ' + qtyText + ' (' + plan.label + ')';
            var body = 'Hola Mateo,\n\nEstuve en tu portfolio y coticé un proyecto:\n' +
                '- Formato: ' + (currentFormat === 'vertical' ? 'Vertical 9:16' : 'Horizontal 16:9') + '\n' +
                '- Nivel: ' + plan.label + '\n' +
                '- Cantidad / Duración: ' + qtyText + '\n' +
                (isPriority ? '- Entrega prioritaria: Sí (+30%)\n' : '') +
                '- Estimado: ~$' + total + ' USD\n\n¿Tienes disponibilidad para conversarlo?';
            ctaBtn.href = 'mailto:animateofx@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
        }
    }

    formatBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            formatBtns.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentFormat = btn.getAttribute('data-format');
            var c = config[currentFormat];
            if (sliderLabel) sliderLabel.textContent = c.unitLabel;
            if (slider) {
                slider.min = String(c.min);
                slider.max = String(c.max);
                slider.value = String(c.defaultVal);
            }
            updateCardPrices();
            updateEstimate();
        });
    });

    planBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            planBtns.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            currentPlan = btn.getAttribute('data-plan');
            updateEstimate();
        });
    });

    if (slider) slider.addEventListener('input', updateEstimate);
    if (priorityCheck) priorityCheck.addEventListener('change', updateEstimate);

    updateCardPrices();
    updateEstimate();
})();
