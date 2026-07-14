(function () {
    'use strict';

    var TOOLS = [
        { id: 'grapheditor', name: 'GraphEditor', tag: 'Extensión · AE', desc: 'Curvas CURVE / VALUE con easing y botón APLICAR al timeline.', repo: 'https://github.com/Animateoo/GraphEditorAE', src: 'demos/grapheditor/index.html', w: 300, h: 440, bg: '#161616', layout: 'timeline' },
        { id: 'textpresets', name: 'TextPresets', tag: 'Extensión · AE', desc: 'Presets .ffx, favoritos y aplicación masiva con un clic.', repo: 'https://github.com/Animateoo/TextsPresetsAE', src: 'demos/textpresets/preview.html', w: 300, h: 460, bg: '#191919', layout: 'workspace' },
        { id: 'compvault', name: 'CompVault', tag: 'Extensión · AE', desc: 'Biblioteca de comps y capas con vista lista o cuadrícula.', repo: 'https://github.com/Animateoo', src: 'demos/compvault/preview.html', w: 540, h: 320, bg: '#1c1c1c', layout: 'workspace' },
        { id: 'mediavault', name: 'MediaVault', tag: 'Extensión · AE + Pr', desc: 'Audios y footage con waveforms y árbol de carpetas.', repo: 'https://github.com/Animateoo/MediaVault', src: 'demos/mediavault/preview.html', w: 540, h: 420, bg: '#1c1c1c', layout: 'workspace' },
        { id: 'assetpack', name: 'AssetPack', tag: 'Extensión · AE', desc: 'Organiza footage, collect nativo y recupera archivos perdidos.', repo: 'https://github.com/Animateoo', src: 'demos/assetpack/preview.html', w: 480, h: 32, bg: '#232323', layout: 'scriptui' },
        { id: 'maskunlinker', name: 'Mask Unlinker', tag: 'ScriptUI · AE', desc: 'Unlink, relink, mask ↔ shape y separar máscaras.', repo: 'https://github.com/Animateoo/Mask-Unliker', src: 'demos/maskunlinker/index.html', w: 300, h: 84, bg: '#1f1f1f', layout: 'scriptui' },
        { id: 'aurapro', name: 'Aura Pro', tag: 'ScriptUI · AE', desc: 'Paletas con sync, import/export JSON y picker nativo.', repo: 'https://github.com/Animateoo/Aura-Pro', src: 'demos/aurapro/index.html', w: 300, h: 190, bg: '#262626', layout: 'scriptui' },
        { id: 'audify', name: 'Audify', tag: 'ScriptUI · AE', desc: 'Fade, volumen dB, reverse, EQ y ducking automático.', repo: 'https://github.com/Animateoo/Audify-After-Effect', src: 'demos/audify/index.html', w: 300, h: 290, bg: '#141414', layout: 'scriptui' },
        { id: 'cachepro', name: 'Cache Pro', tag: 'ScriptUI · AE', desc: 'Snap, purge, caché, borrar footage y guardar versión.', repo: 'https://github.com/Animateoo/Cache-Pro', src: 'demos/cachepro/index.html', w: 300, h: 80, bg: '#1f1f21', layout: 'scriptui' },
        { id: 'shuttle', name: 'Shuttle', tag: 'Extensión · Ai + Ps', desc: 'Push & Pull entre Illustrator y Photoshop.', repo: 'https://github.com/Animateoo', src: 'demos/shuttle/preview.html', w: 300, h: 78, bg: '#323232', layout: 'creative' }
    ];

    var LAYOUTS = {
        timeline: { el: 'fakeTimeline', slot: 'slotTimeline' },
        workspace: { el: 'fakeWorkspace', slot: 'slotWorkspace' },
        scriptui: { el: 'fakeScriptui', slot: 'slotScriptui' },
        creative: { el: 'fakeCreative', slot: 'slotCreative' }
    };

    var DOCK_PANEL_NAMES = [
        'Efectos y predefinidos', 'Alinear', 'Personaje', 'Párrafo',
        'Bibliotecas', 'Información', 'Audio', 'Vista previa', 'Rastreador'
    ];

    var TRACK_WIDTHS = [68, 45, 82, 58, 90, 38, 74, 52, 96, 60, 40, 78];

    var ICONS = {
        face: function (color) {
            return '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">' +
                '<circle cx="40" cy="40" r="38" fill="' + color + '" stroke="#111" stroke-width="3"/>' +
                '<ellipse cx="28" cy="34" rx="9" ry="11" fill="#fff"/><ellipse cx="52" cy="34" rx="9" ry="11" fill="#fff"/>' +
                '<circle cx="28" cy="36" r="4" fill="#111"/><circle cx="52" cy="36" r="4" fill="#111"/>' +
                '<path d="M28 54 Q40 64 52 54" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round"/></svg>';
        },
        bbox: '<svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="14" y="18" width="52" height="44" fill="none" stroke="#5eb8ff" stroke-width="2.5"/>' +
            '<rect x="10" y="14" width="7" height="7" fill="#5eb8ff"/><rect x="63" y="14" width="7" height="7" fill="#5eb8ff"/>' +
            '<rect x="10" y="59" width="7" height="7" fill="#5eb8ff"/><rect x="63" y="59" width="7" height="7" fill="#5eb8ff"/>' +
            '<rect x="36" y="10" width="7" height="7" fill="#5eb8ff"/><rect x="36" y="63" width="7" height="7" fill="#5eb8ff"/></svg>',
        easyease: '<svg viewBox="0 0 56 72" xmlns="http://www.w3.org/2000/svg">' +
            '<path d="M28 4 L48 20 L48 52 L28 68 L8 52 L8 20 Z" fill="#34d399" stroke="#111" stroke-width="2.5"/>' +
            '<path d="M18 22 L38 22 M18 50 L38 50" stroke="#111" stroke-width="2" stroke-linecap="round"/></svg>',
        graphcurve: '<svg viewBox="0 0 72 72" xmlns="http://www.w3.org/2000/svg">' +
            '<rect width="72" height="72" rx="8" fill="#f6d32d"/>' +
            '<circle cx="14" cy="56" r="4" fill="#111"/><circle cx="58" cy="16" r="4" fill="#111"/>' +
            '<path d="M14 56 C14 56 14 16 58 16" fill="none" stroke="#111" stroke-width="2.5"/></svg>',
        eye: '<svg viewBox="0 0 56 56" xmlns="http://www.w3.org/2000/svg">' +
            '<rect width="56" height="56" rx="8" fill="#7eb8ff"/>' +
            '<ellipse cx="28" cy="28" rx="16" ry="10" fill="#fff" stroke="#111" stroke-width="2"/>' +
            '<ellipse cx="28" cy="28" rx="5" ry="8" fill="#111"/></svg>',
        timeline: '<svg viewBox="0 0 80 48" xmlns="http://www.w3.org/2000/svg">' +
            '<rect width="80" height="48" rx="6" fill="#a8d86a" stroke="#111" stroke-width="2"/>' +
            '<rect x="10" y="14" width="50" height="8" rx="4" fill="#8ab4f8"/>' +
            '<rect x="10" y="28" width="32" height="8" rx="4" fill="#fff"/>' +
            '<line x1="44" y1="8" x2="44" y2="40" stroke="#111" stroke-width="2"/>' +
            '<circle cx="44" cy="8" r="4" fill="#fff" stroke="#111" stroke-width="1.5"/></svg>',
        keyframe: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 4l8 8-8 8-8-8z"/></svg>',
        diamond: '<svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="16" y="16" width="32" height="32" rx="5" transform="rotate(45 32 32)" fill="#ff6b6b" stroke="#111" stroke-width="3"/>' +
            '<rect x="24" y="24" width="16" height="16" rx="3" transform="rotate(45 32 32)" fill="#fff" opacity="0.35"/></svg>',
        layers: '<svg viewBox="0 0 80 64" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="6" y="32" width="52" height="14" rx="4" fill="#7c6cff" stroke="#111" stroke-width="2.5"/>' +
            '<rect x="14" y="19" width="52" height="14" rx="4" fill="#5eb8ff" stroke="#111" stroke-width="2.5"/>' +
            '<rect x="22" y="6" width="52" height="14" rx="4" fill="#f6d32d" stroke="#111" stroke-width="2.5"/></svg>'
    };

    var FLOATERS = [
        { type: 'face', color: '#f6d32d', x: 5, y: 14, size: 96, depth: 0.04, rot: -12, blur: false },
        { type: 'bbox', x: 82, y: 10, size: 88, depth: 0.055, rot: 6, blur: true },
        { type: 'easyease', x: 78, y: 58, size: 72, depth: 0.035, rot: 0, blur: false },
        { type: 'layers', x: 10, y: 62, size: 84, depth: 0.03, rot: 8, blur: true },
        { type: 'graphcurve', x: 90, y: 36, size: 76, depth: 0.05, rot: -18, blur: false },
        { type: 'eye', x: 4, y: 38, size: 64, depth: 0.025, rot: 0, blur: true },
        { type: 'timeline', x: 68, y: 78, size: 88, depth: 0.02, rot: -4, blur: true },
        { type: 'diamond', x: 22, y: 6, size: 60, depth: 0.045, rot: 15, blur: false },
        { type: 'easyease', x: 48, y: 82, size: 56, depth: 0.028, rot: 20, blur: true }
    ];

    var nav = document.getElementById('showcaseNav');
    var iframe = document.getElementById('showcaseIframe');
    var frame = document.getElementById('showcaseFrame');
    var tagEl = document.getElementById('showcaseTag');
    var titleEl = document.getElementById('showcaseTitle');
    var repoEl = document.getElementById('showcaseRepo');
    var activeId = null;
    var activeTool = null;

    var mouseX = 0;
    var mouseY = 0;
    var smoothX = 0;
    var smoothY = 0;
    var scrollY = 0;

    function fillRows(measureEl, appendEl, rowH, gap, makeEl) {
        if (!appendEl) return;
        appendEl.innerHTML = '';
        var target = measureEl || appendEl;
        var h = target.clientHeight;
        if (!h) return;
        var n = Math.max(3, Math.ceil(h / (rowH + gap)));
        for (var i = 0; i < n; i++) {
            appendEl.appendChild(makeEl(i));
        }
    }

    function makeTrackBar(i) {
        var bar = document.createElement('div');
        bar.className = 'ae-tl-bar';
        bar.style.setProperty('--w', TRACK_WIDTHS[i % TRACK_WIDTHS.length] + '%');
        if (i % 2 === 1) bar.style.opacity = '0.55';
        return bar;
    }

    function makeLabel(i) {
        var l = document.createElement('div');
        l.className = 'ae-tl-label' + (i % 4 === 3 ? ' ae-tl-label--sm' : '');
        return l;
    }

    function makeBlock(i) {
        var b = document.createElement('div');
        b.className = 'ae-block' + (i % 3 === 2 ? ' ae-block--sm' : '');
        return b;
    }

    function fillDockPanels(container, excludeName, count) {
        if (!container) return;
        container.innerHTML = '';
        var pool = DOCK_PANEL_NAMES.filter(function (n) {
            return n.toLowerCase() !== String(excludeName || '').toLowerCase();
        });
        for (var i = 0; i < count; i++) {
            var bar = document.createElement('div');
            bar.className = 'fake-ae-mini fake-ae-mini--label';
            bar.textContent = pool[i % pool.length];
            container.appendChild(bar);
        }
    }

    function populateFillers(tool) {
        if (!tool) return;

        if (tool.layout === 'timeline') {
            fillRows(null, document.getElementById('tlProjectCol'), 28, 6, makeBlock);
            fillDockPanels(document.getElementById('tlStackFiller'), tool.name, 4);
            var tracksWrap = document.querySelector('.fake-ui--timeline .fake-ae-tl-tracks');
            var labelsWrap = document.getElementById('tlLabels');
            fillRows(tracksWrap, document.getElementById('tlTracks'), 10, 5, makeTrackBar);
            fillRows(labelsWrap, labelsWrap, 10, 5, makeLabel);
        }

        if (tool.layout === 'workspace') {
            fillRows(null, document.getElementById('wsProjectCol'), 28, 6, makeBlock);
            var wsTracksWrap = document.querySelector('.fake-ui--workspace .fake-ae-tl-tracks');
            var wsLabelsWrap = document.getElementById('wsLabels');
            fillRows(wsTracksWrap, document.getElementById('wsTracks'), 10, 6, makeTrackBar);
            fillRows(wsLabelsWrap, wsLabelsWrap, 10, 6, makeLabel);
        }

        if (tool.layout === 'scriptui') {
            fillRows(null, document.getElementById('suProjectCol'), 28, 6, makeBlock);
            var tlMini = document.querySelector('.fake-ui--scriptui .fake-ae-timeline-mini');
            fillRows(tlMini, document.getElementById('suTracks'), 10, 5, makeTrackBar);

            var dockStack = document.querySelector('.fake-ae-stack--dock');
            var top = document.getElementById('suDockTop');
            var bottom = document.getElementById('suDockBottom');
            if (dockStack && top && bottom) {
                top.innerHTML = '';
                bottom.innerHTML = '';
                var stackH = dockStack.clientHeight;
                var used = tool.h;
                var remaining = Math.max(0, stackH - used);
                var rowH = 22;
                var topCount = Math.floor((remaining / 2) / rowH);
                var bottomCount = Math.max(0, Math.floor(remaining / rowH) - topCount);
                fillDockPanels(top, tool.name, topCount);
                fillDockPanels(bottom, tool.name, bottomCount);
            }
        }

        if (tool.layout === 'creative') {
            var layerMaker = function (i) {
                var l = document.createElement('div');
                l.className = 'ai-layer' + (i === 1 ? ' ai-layer--on' : '');
                return l;
            };
            var layerPanels = document.querySelectorAll('.ai-panel--layers');
            fillRows(layerPanels[0], document.getElementById('aiLayers'), 14, 6, layerMaker);
            if (layerPanels[1]) {
                fillRows(layerPanels[1], document.getElementById('aiLayersBottom'), 14, 6, layerMaker);
            }
        }
    }

    function selectTool(id) {
        var tool = TOOLS.filter(function (t) { return t.id === id; })[0];
        if (!tool || activeId === id) return;

        activeId = id;
        activeTool = tool;

        nav.querySelectorAll('.showcase-item').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.id === id);
        });

        tagEl.textContent = tool.tag;
        titleEl.textContent = tool.name;
        repoEl.href = tool.repo;

        frame.style.setProperty('--frame-w', tool.w + 'px');
        frame.style.setProperty('--frame-h', tool.h + 'px');
        frame.style.setProperty('--frame-bg', tool.bg);

        iframe.title = tool.name;
        iframe.src = tool.src;

        Object.keys(LAYOUTS).forEach(function (key) {
            var layout = LAYOUTS[key];
            var shell = document.getElementById(layout.el);
            if (shell) {
                shell.hidden = key !== tool.layout;
                if (key === tool.layout) {
                    shell.style.setProperty('--frame-w', tool.w + 'px');
                    shell.style.setProperty('--tl-slot-w', tool.w + 'px');
                    shell.style.setProperty('--ext-w', tool.w + 'px');
                    shell.style.setProperty('--dock-w', tool.w + 'px');
                }
            }
        });

        var target = LAYOUTS[tool.layout];
        if (target) {
            var slot = document.getElementById(target.slot);
            if (slot) slot.appendChild(frame);
        }

        requestAnimationFrame(function () {
            requestAnimationFrame(function () { populateFillers(tool); });
        });
    }

    if (nav) {
        TOOLS.forEach(function (tool, i) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'showcase-item' + (i === 0 ? ' active' : '');
            btn.dataset.id = tool.id;
            btn.innerHTML =
                '<span class="showcase-item-name">' + tool.name + '</span>' +
                '<span class="showcase-item-tag">' + tool.tag + '</span>' +
                '<span class="showcase-item-desc">' + tool.desc + '</span>';
            btn.addEventListener('click', function () { selectTool(tool.id); });
            nav.appendChild(btn);
        });
        selectTool(TOOLS[0].id);
    }

    function initHeroFloaters() {
        var wrap = document.getElementById('heroFloaters');
        if (!wrap) return;

        FLOATERS.forEach(function (f) {
            var el = document.createElement('div');
            el.className = 'hero-floater' +
                (f.blur ? ' hero-floater--blur' : '') +
                (f.type === 'face' ? ' hero-floater--face' : '');
            el.style.left = f.x + '%';
            el.style.top = f.y + '%';
            el.style.width = f.size + 'px';
            el.style.height = f.size + 'px';
            el.dataset.depth = String(f.depth);
            el.dataset.rot = String(f.rot);
            el.dataset.baseX = String(f.x);
            el.dataset.baseY = String(f.y);

            if (f.type === 'face') {
                el.innerHTML = ICONS.face(f.color);
            } else {
                el.innerHTML = ICONS[f.type] || ICONS.keyframe;
            }
            wrap.appendChild(el);
        });
    }

    function onScrollMotion() {
        scrollY = window.scrollY;
        var max = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
        var t = scrollY / max;

        var glow = document.getElementById('scrollGlow');
        if (glow) {
            glow.style.top = (scrollY + window.innerHeight * 0.42) + 'px';
            glow.style.opacity = String(0.55 + t * 0.45);
        }

        var heroGlow = document.querySelector('.hero-glow');
        if (heroGlow) {
            heroGlow.style.transform = 'translate(-50%, calc(-50% + ' + (scrollY * 0.08) + 'px))';
        }
    }

    function animateFloaters() {
        smoothX += (mouseX - smoothX) * 0.045;
        smoothY += (mouseY - smoothY) * 0.045;

        document.querySelectorAll('.hero-floater').forEach(function (el, i) {
            var depth = parseFloat(el.dataset.depth) || 0.03;
            var rot = parseFloat(el.dataset.rot) || 0;
            var drift = Math.sin(scrollY * 0.002 + i * 1.3) * 5;
            var mx = smoothX * depth * 80;
            var my = smoothY * depth * 80;
            el.style.transform =
                'translate3d(' + mx + 'px,' + (-scrollY * depth * 40 + drift + my) + 'px,0) ' +
                'rotate(' + (rot + smoothX * 4) + 'deg)';
        });

        requestAnimationFrame(animateFloaters);
    }

    document.addEventListener('mousemove', function (e) {
        mouseX = (e.clientX / window.innerWidth - 0.5) * 2;
        mouseY = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    initHeroFloaters();
    window.addEventListener('scroll', onScrollMotion, { passive: true });
    window.addEventListener('resize', onScrollMotion);
    onScrollMotion();
    requestAnimationFrame(animateFloaters);

    var resizeFillTimer = null;
    window.addEventListener('resize', function () {
        clearTimeout(resizeFillTimer);
        resizeFillTimer = setTimeout(function () {
            if (activeTool) populateFillers(activeTool);
        }, 150);
    });
})();
