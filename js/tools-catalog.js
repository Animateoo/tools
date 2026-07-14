(function () {
    'use strict';

    var grid = document.getElementById('toolsGrid');
    if (!grid || typeof ANIMATEO_TOOLS === 'undefined') return;

    var icons = typeof TOOL_ICONS !== 'undefined' ? TOOL_ICONS : {};

    ANIMATEO_TOOLS.forEach(function (tool) {
        var wrap = document.createElement('a');
        wrap.className = 'tool-card-wrap';
        wrap.href = tool.id + '/';

        var shadow = document.createElement('span');
        shadow.className = 'tool-card-shadow';
        shadow.setAttribute('aria-hidden', 'true');

        var card = document.createElement('div');
        card.className = 'tool-card';

        var iconHtml = icons[tool.id] || '';
        card.innerHTML =
            '<span class="tool-card-tag">' + tool.tag + '</span>' +
            '<div class="tool-card-head">' +
                (iconHtml ? '<span class="tool-card-icon">' + iconHtml + '</span>' : '') +
                '<h2>' + tool.name + '</h2>' +
            '</div>' +
            '<p>' + tool.shortDesc + '</p>' +
            '<span class="tool-card-cta">Ver tool →</span>';

        wrap.appendChild(shadow);
        wrap.appendChild(card);
        grid.appendChild(wrap);
    });
})();
