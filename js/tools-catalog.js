(function () {
    'use strict';

    var grid = document.getElementById('toolsGrid');
    if (!grid || typeof ANIMATEO_TOOLS === 'undefined') return;

    var countBadge = document.getElementById('toolsCountBadge');
    if (countBadge) countBadge.textContent = ANIMATEO_TOOLS.length + ' tools';

    grid.classList.add('suite-grid');

    ANIMATEO_TOOLS.forEach(function (tool, index) {
        var wrap = document.createElement('a');
        wrap.className = 'guides-pick suite-pick';
        wrap.href = tool.id + '/';
        wrap.innerHTML =
            '<span class="guides-pick-index">#' + String(index + 1).padStart(2, '0') + '</span>' +
            '<span class="guides-pick-name">' + tool.name + '</span>' +
            '<span class="guides-pick-tag">' + tool.tag + '</span>';
        grid.appendChild(wrap);
    });

    /* Decorative curve stage (not live GraphEditor) */
    var stage = document.getElementById('heroCurveStage');
    if (!stage) return;

    /* ── Meme GIF floater beside the curve card ── */
    var memeWrap = document.createElement('div');
    memeWrap.className = 'hero-meme-floater';
    memeWrap.innerHTML =
        '<img src="img/Typing Dog.gif" alt="Dog typing" loading="eager">' +
        '<span class="hero-meme-label">Tú editando a las 3am</span>';
    stage.appendChild(memeWrap);
})();

/* -- Background Effects (Pointer Glow & Particles) -- */
(function initEffects() {
    // Pointer Glow
    var glow = document.getElementById('pointerGlow');
    if (glow) {
        window.addEventListener('mousemove', function(e) {
            glow.style.transform = 'translate(' + e.clientX + 'px, ' + e.clientY + 'px) translate(-50%, -50%)';
        });
    }

    // Particles
    var canvas = document.getElementById('particleCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var particles = [];
    var width, height;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // Create particles
    var particleCount = Math.floor(window.innerWidth / 30);
    for (var i = 0; i < particleCount; i++) {
        particles.push({
            x: Math.random() * width,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            size: Math.random() * 2 + 0.5,
            alpha: Math.random() * 0.5 + 0.1
        });
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = '#d97706';
        
        particles.forEach(function(p) {
            p.x += p.vx;
            p.y += p.vy;
            
            // Wrap around screen
            if (p.x < 0) p.x = width;
            if (p.x > width) p.x = 0;
            if (p.y < 0) p.y = height;
            if (p.y > height) p.y = 0;
            
            ctx.globalAlpha = p.alpha;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
        
        requestAnimationFrame(draw);
    }
    draw();
})();
