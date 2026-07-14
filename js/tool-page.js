(function () {
    'use strict';

    var LAYER_NAMES = [
        'Color Correct', 'Title Text', 'Subtitle Text', 'Divider Shape', 'Logo Shape',
        'Null Control', 'Intro Comp', 'Main Camera', 'Key Light', 'Null Parent',
        'Safe Zone', 'Background', 'Adjustment', 'Matte Layer'
    ];

    var LAYER_COLORS = ['#e8a735', '#5eb8ff', '#5eb8ff', '#c678dd', '#c678dd', '#e06c75', '#98c379', '#61afef', '#e5c07b', '#e06c75', '#56b6c2', '#abb2bf', '#d19a66', '#82cfff'];

    var TRACK_WIDTHS = [72, 48, 85, 60, 92, 40, 76, 54, 88, 62, 44, 80, 58, 70];

    function getToolById(id) {
        if (typeof ANIMATEO_TOOLS === 'undefined') return null;
        for (var i = 0; i < ANIMATEO_TOOLS.length; i++) {
            if (ANIMATEO_TOOLS[i].id === id) return ANIMATEO_TOOLS[i];
        }
        return null;
    }

    function resolveToolId() {
        if (window.TOOL_SLUG) return window.TOOL_SLUG;
        var parts = location.pathname.replace(/\\/g, '/').split('/').filter(Boolean);
        if (!parts.length) return null;
        var last = parts[parts.length - 1];
        if (last === 'index.html' && parts.length > 1) last = parts[parts.length - 2];
        if (last === 'tools') return null;
        return last;
    }

    function fillTimeline(shell, count) {
        var labels = shell.querySelector('.tryit-labels');
        var tracks = shell.querySelector('.tryit-tracks-inner');
        if (!labels || !tracks) return;

        labels.innerHTML = '';
        tracks.innerHTML = '';

        for (var i = 0; i < count; i++) {
            var label = document.createElement('div');
            label.className = 'tryit-label';
            label.innerHTML =
                '<span class="tryit-label-dot" style="background:' + LAYER_COLORS[i % LAYER_COLORS.length] + '"></span>' +
                '<span>' + LAYER_NAMES[i % LAYER_NAMES.length] + '</span>';
            labels.appendChild(label);

            var bar = document.createElement('div');
            bar.className = 'tryit-bar';
            bar.style.setProperty('--w', TRACK_WIDTHS[i % TRACK_WIDTHS.length] + '%');
            tracks.appendChild(bar);
        }
    }

    function fillAiLayers(container, count) {
        if (!container) return;
        container.innerHTML = '';
        for (var i = 0; i < count; i++) {
            var layer = document.createElement('div');
            layer.className = 'tryit-ai-layer' + (i === 1 ? ' tryit-ai-layer--on' : '');
            container.appendChild(layer);
        }
    }

    function buildAeShell(tool) {
        var shell = document.createElement('div');
        shell.className = 'tryit-shell';
        shell.style.setProperty('--plugin-w', tool.w + 'px');
        shell.style.setProperty('--plugin-h', tool.h + 'px');
        shell.style.setProperty('--plugin-bg', tool.bg);

        var wide = tool.w > 400 ? ' tryit-body--wide' : '';

        shell.innerHTML =
            '<div class="tryit-transport">' +
                '<div class="tryit-transport-left">' +
                    '<span class="tryit-transport-btn" aria-hidden="true"></span>' +
                    '<span class="tryit-transport-btn" aria-hidden="true"></span>' +
                    '<span class="tryit-timecode">0;00;02;15</span>' +
                    '<span class="tryit-fps">30 fps</span>' +
                '</div>' +
                '<span class="tryit-panel-name">' + tool.name + '</span>' +
            '</div>' +
            '<div class="tryit-body' + wide + '">' +
                '<div class="tryit-timeline">' +
                    '<div class="tryit-labels"></div>' +
                    '<div class="tryit-tracks">' +
                        '<div class="tryit-tracks-inner"></div>' +
                        '<div class="tryit-playhead" aria-hidden="true"></div>' +
                    '</div>' +
                '</div>' +
                '<div class="tryit-plugin">' +
                    '<iframe title="' + tool.name + '" src="' + tool.src + '" loading="lazy"></iframe>' +
                '</div>' +
            '</div>';

        fillTimeline(shell, 12);
        return shell;
    }

    function buildAiShell(tool) {
        var shell = document.createElement('div');
        shell.className = 'tryit-shell tryit-shell--ai';
        shell.style.setProperty('--plugin-w', tool.w + 'px');
        shell.style.setProperty('--plugin-h', tool.h + 'px');
        shell.style.setProperty('--plugin-bg', tool.bg);

        shell.innerHTML =
            '<div class="tryit-transport">' +
                '<div class="tryit-transport-left">' +
                    '<span class="tryit-timecode">Illustrator</span>' +
                '</div>' +
                '<span class="tryit-panel-name">' + tool.name + '</span>' +
            '</div>' +
            '<div class="tryit-body">' +
                '<div class="tryit-ai-wrap">' +
                    '<div class="tryit-ai-tools">' +
                        '<div class="tryit-ai-tool tryit-ai-tool--on"></div>' +
                        '<div class="tryit-ai-tool"></div>' +
                        '<div class="tryit-ai-tool"></div>' +
                        '<div class="tryit-ai-tool"></div>' +
                        '<div class="tryit-ai-tool"></div>' +
                    '</div>' +
                    '<div class="tryit-ai-canvas">' +
                        '<div class="tryit-ai-artboard">' +
                            '<div class="tryit-ai-shape tryit-ai-shape--1"></div>' +
                            '<div class="tryit-ai-shape tryit-ai-shape--2"></div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="tryit-ai-layers" id="tryitAiLayers"></div>' +
                '</div>' +
                '<div class="tryit-plugin">' +
                    '<iframe title="' + tool.name + '" src="' + tool.src + '" loading="lazy"></iframe>' +
                '</div>' +
            '</div>';

        fillAiLayers(shell.querySelector('#tryitAiLayers'), 10);
        return shell;
    }

    function mountTryIt(tool, variant) {
        var mount = document.getElementById('tryitMount');
        if (!mount) return;

        var active = variant || (tool.repos && tool.repos[0]) || tool;
        var demoTool = Object.assign({}, tool, {
            src: active.demo || tool.src,
            w: active.w || tool.w,
            h: active.h || tool.h
        });

        mount.innerHTML = '';
        var shell = demoTool.shell === 'ai' ? buildAiShell(demoTool) : buildAeShell(demoTool);
        mount.appendChild(shell);
    }

    function renderRepoControls(tool) {
        var actions = document.getElementById('toolActions');
        var switchWrap = document.getElementById('repoSwitch');
        if (!actions) return;

        actions.innerHTML = '';

        if (tool.repos && tool.repos.length) {
            tool.repos.forEach(function (repo, i) {
                var a = document.createElement('a');
                a.className = 'tool-btn tool-btn--primary';
                a.href = repo.url;
                a.target = '_blank';
                a.rel = 'noopener';
                a.textContent = 'Descargar ' + repo.label;
                actions.appendChild(a);
            });
            var docs = document.createElement('a');
            docs.className = 'tool-btn tool-btn--ghost';
            docs.href = tool.repos[0].url;
            docs.target = '_blank';
            docs.rel = 'noopener';
            docs.textContent = 'Ver repos';
            actions.appendChild(docs);

            if (switchWrap) {
                switchWrap.innerHTML = '';
                tool.repos.forEach(function (repo, i) {
                    var btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'tool-repo-pill' + (i === 0 ? ' is-active' : '');
                    btn.textContent = 'Demo ' + repo.label;
                    btn.addEventListener('click', function () {
                        switchWrap.querySelectorAll('.tool-repo-pill').forEach(function (p) {
                            p.classList.remove('is-active');
                        });
                        btn.classList.add('is-active');
                        mountTryIt(tool, repo);
                    });
                    switchWrap.appendChild(btn);
                });
            }
        } else {
            var dl = document.createElement('a');
            dl.className = 'tool-btn tool-btn--primary';
            dl.id = 'toolDownload';
            dl.href = tool.repo;
            dl.target = '_blank';
            dl.rel = 'noopener';
            dl.textContent = 'Descargar';
            actions.appendChild(dl);

            var docsSingle = document.createElement('a');
            docsSingle.className = 'tool-btn tool-btn--ghost';
            docsSingle.id = 'toolDocs';
            docsSingle.href = tool.repo;
            docsSingle.target = '_blank';
            docsSingle.rel = 'noopener';
            docsSingle.textContent = 'Ver repo';
            actions.appendChild(docsSingle);
        }
    }

    function renderFaq(tool) {
        var list = document.getElementById('faqList');
        if (!list || !tool.faq) return;

        tool.faq.forEach(function (item) {
            var wrap = document.createElement('div');
            wrap.className = 'faq-item';
            wrap.innerHTML =
                '<button type="button" class="faq-q">' + item.q + '</button>' +
                '<div class="faq-a">' + item.a + '</div>';
            wrap.querySelector('.faq-q').addEventListener('click', function () {
                wrap.classList.toggle('is-open');
            });
            list.appendChild(wrap);
        });
    }

    function renderPage(tool) {
        document.title = tool.name + ' | Animateo Tools';

        var meta = document.querySelector('meta[name="description"]');
        if (meta) meta.content = tool.longDesc;

        var tag = document.getElementById('toolTag');
        var title = document.getElementById('toolTitle');
        var desc = document.getElementById('toolDesc');
        var features = document.getElementById('toolFeatures');
        var ctaTitle = document.getElementById('ctaTitle');
        var ctaDesc = document.getElementById('ctaDesc');
        var ctaDownload = document.getElementById('ctaDownload');

        if (tag) tag.textContent = tool.tag;
        if (title) title.textContent = tool.name;
        if (desc) desc.textContent = tool.longDesc;
        if (ctaTitle) ctaTitle.textContent = '¿Listo para probar ' + tool.name + '?';
        if (ctaDesc) ctaDesc.textContent = tool.shortDesc;
        if (ctaDownload) ctaDownload.href = tool.repo;

        renderRepoControls(tool);

        if (features && tool.features) {
            tool.features.forEach(function (f) {
                var li = document.createElement('li');
                li.textContent = f;
                features.appendChild(li);
            });
        }

        mountTryIt(tool, tool.repos ? tool.repos[0] : null);

        renderFaq(tool);
    }

    function showNotFound() {
        var main = document.querySelector('.tool-detail-main');
        if (main) {
            main.innerHTML =
                '<div class="tools-container">' +
                    '<p>Tool no encontrada. <a href="../">Volver al catálogo</a></p>' +
                '</div>';
        }
    }

    var id = resolveToolId();
    var tool = getToolById(id);

    if (!tool) {
        showNotFound();
        return;
    }

    renderPage(tool);

    window.addEventListener('resize', function () {
        var shell = document.querySelector('.tryit-shell');
        if (!shell || tool.shell === 'ai') return;
        var tracks = shell.querySelector('.tryit-tracks');
        if (!tracks) return;
        var h = tracks.clientHeight;
        var count = Math.max(8, Math.min(14, Math.floor(h / 14)));
        fillTimeline(shell, count);
    });
})();
