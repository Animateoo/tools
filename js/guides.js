(function () {
    'use strict';

    var picker = document.getElementById('guidePicker');
    var detail = document.getElementById('guideDetail');
    var search = document.getElementById('guideSearch');
    if (!picker || !detail || typeof ANIMATEO_TOOLS === 'undefined') return;

    var activeId = ANIMATEO_TOOLS[0] ? ANIMATEO_TOOLS[0].id : null;

    function installKind(tool) {
        var tag = (tool.tag || '').toLowerCase();
        if (tag.indexOf('scriptui') >= 0) {
            return {
                kind: 'ScriptUI (.jsx)',
                where: 'Scripts / ScriptUI Panels',
                open: 'Window → ' + tool.name,
                tip: 'Si no aparece, reinicia After Effects y revisa que el .jsx esté en la carpeta correcta de tu versión.'
            };
        }
        var hosts = tag.indexOf('ai') >= 0 || tag.indexOf('ps') >= 0
            ? 'Illustrator / Photoshop'
            : (tag.indexOf('pr') >= 0 ? 'After Effects / Premiere Pro' : 'After Effects');
        return {
            kind: 'Extensión CEP (.zxp)',
            where: hosts,
            open: 'Window → Extensions → ' + tool.name,
            tip: 'Instala con ZXP Installer (o aescripts ZXP Installer), reinicia la app y habilita unsigned si hace falta en debug.'
        };
    }

    function renderPicker(filter) {
        var q = (filter || '').trim().toLowerCase();
        picker.innerHTML = '';

        ANIMATEO_TOOLS.forEach(function (tool, index) {
            var hay = (tool.name + ' ' + tool.tag + ' ' + tool.shortDesc).toLowerCase();
            if (q && hay.indexOf(q) === -1) return;

            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'guides-pick' + (tool.id === activeId ? ' is-active' : '');
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', tool.id === activeId ? 'true' : 'false');
            btn.dataset.id = tool.id;
            btn.innerHTML =
                '<span class="guides-pick-index">#' + String(index + 1).padStart(2, '0') + '</span>' +
                '<span class="guides-pick-name">' + tool.name + '</span>' +
                '<span class="guides-pick-tag">' + tool.tag + '</span>';
            btn.addEventListener('click', function () {
                activeId = tool.id;
                renderPicker(search ? search.value : '');
                renderDetail();
            });
            picker.appendChild(btn);
        });
    }

    function renderDetail() {
        var tool = null;
        for (var i = 0; i < ANIMATEO_TOOLS.length; i++) {
            if (ANIMATEO_TOOLS[i].id === activeId) {
                tool = ANIMATEO_TOOLS[i];
                break;
            }
        }
        if (!tool) {
            detail.innerHTML = '<p class="guides-empty">No hay tools que coincidan con el filtro.</p>';
            return;
        }

        var install = installKind(tool);
        var howItWorks = (tool.howItWorks || []).map(function (f) {
            return '<li>' + f + '</li>';
        }).join('');

        var faq = '';
        if (tool.faq && tool.faq.length) {
            faq = '<div class="guides-faq">' + tool.faq.map(function (item) {
                return '<details><summary>' + item.q + '</summary><p>' + item.a + '</p></details>';
            }).join('') + '</div>';
        }

        detail.innerHTML =
            '<header class="guides-detail-head">' +
                '<span class="guides-chapter-tag">' + tool.tag + '</span>' +
                '<h2>' + tool.name + '</h2>' +
                '<p>' + tool.longDesc + '</p>' +
                (tool.tldr ? '<p class="guides-tldr"><strong>TL;DR:</strong> ' + tool.tldr + '</p>' : '') +
                '<div class="guides-detail-actions">' +
                    '<a class="btn-3d btn-3d--primary" href="../' + tool.id + '/">Abrir demo →</a>' +
                    '<a class="btn-3d btn-3d--ghost" href="' + tool.repo + '" target="_blank" rel="noopener">Repo / download</a>' +
                '</div>' +
            '</header>' +

            '<div class="guides-detail-grid">' +
                '<section class="guides-block">' +
                    '<h3>Instalación</h3>' +
                    '<dl class="guides-meta">' +
                        '<div><dt>Tipo</dt><dd>' + install.kind + '</dd></div>' +
                        '<div><dt>Host</dt><dd>' + install.where + '</dd></div>' +
                        '<div><dt>Abrir</dt><dd>' + install.open + '</dd></div>' +
                    '</dl>' +
                    '<p class="guides-tip">' + install.tip + '</p>' +
                    '<h4 style="margin-top:1.2rem;font-size:0.85rem;font-weight:700;color:#555;">Demo en el navegador</h4>' +
                    '<p style="font-size:0.88rem;color:#666;margin-top:0.3rem;">La demo replica el panel real. Puedes probar botones y controles — las acciones que tocan el proyecto se simulan.</p>' +
                '</section>' +

                '<section class="guides-block">' +
                    '<h3>Cómo funciona</h3>' +
                    '<ul class="guides-features">' + howItWorks + '</ul>' +
                '</section>' +
            '</div>' +

            (faq ? '<section class="guides-block guides-block--faq"><h3>Preguntas frecuentes</h3>' + faq + '</section>' : '');
    }

    if (search) {
        search.addEventListener('input', function () {
            renderPicker(search.value);
            var first = picker.querySelector('.guides-pick');
            if (first && !picker.querySelector('.guides-pick.is-active')) {
                activeId = first.dataset.id;
            }
            renderDetail();
        });
    }

    renderPicker('');
    renderDetail();
})();
