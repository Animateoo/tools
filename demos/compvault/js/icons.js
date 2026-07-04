/**
 * CompVault — SVG icons (mismos que MediaVault)
 */
const CompVaultIcons = (function () {
    const svgs = {
        list:
            '<svg class="cv-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
            '<line x1="2" y1="4" x2="14" y2="4"/><line x1="2" y1="8" x2="14" y2="8"/><line x1="2" y1="12" x2="10" y2="12"/>' +
            "</svg>",
        grid:
            '<svg class="cv-icon" viewBox="0 0 16 16" width="14" height="14" fill="currentColor">' +
            '<rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/>' +
            '<rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>' +
            "</svg>",
        sidebar:
            '<svg class="cv-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="2" y="2.5" width="12" height="11" rx="1.2"/>' +
            '<line x1="5.8" y1="2.5" x2="5.8" y2="13.5"/>' +
            "</svg>",
        star:
            '<svg class="cv-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round">' +
            '<path d="M8 2.2l1.6 3.4 3.6.6-2.6 2.5.6 3.6L8 10.9l-3.2 1.8.6-3.6-2.6-2.5 3.6-.6L8 2.2z"/>' +
            "</svg>",
        starFill:
            '<svg class="cv-icon" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" stroke="currentColor" stroke-width="0.5">' +
            '<path d="M8 1.8l2 4.1 4.5.7-3.2 3.2.8 4.5L8 11.6 4 14.3l.8-4.5L1.5 6.6l4.5-.7L8 1.8z"/>' +
            "</svg>",
        link:
            '<svg class="cv-icon" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">' +
            '<path d="M6.5 9.5a3 3 0 0 0 4.2 0l2-2a3 3 0 1 0-4.2-4.2l-1 1"/>' +
            '<path d="M9.5 6.5a3 3 0 0 0-4.2 0l-2 2a3 3 0 1 0 4.2 4.2l1-1"/>' +
            "</svg>",
        chevron:
            '<svg class="cv-icon cv-chevron" viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M6 4l4 4-4 4"/>' +
            "</svg>",
        timeline:
            '<svg class="cv-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M2 5.5h10"/><path d="M2 9.5h6"/><path d="M13 7.5v4"/><path d="M11 9.5h4"/>' +
            "</svg>",
        importIn:
            '<svg class="cv-icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M8 3v6"/><path d="M5.5 7.5L8 10l2.5-2.5"/><path d="M3 13h10"/>' +
            "</svg>",
        settings:
            '<svg class="cv-icon" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">' +
            '<circle cx="8" cy="8" r="2.2"/>' +
            '<path d="M8 1.5v1.8M8 12.7v1.8M1.5 8h1.8M12.7 8h1.8M3.2 3.2l1.3 1.3M11.5 11.5l1.3 1.3M3.2 12.8l1.3-1.3M11.5 4.5l1.3-1.3"/>' +
            "</svg>",
        save:
            '<svg class="cv-icon" viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round">' +
            '<path d="M3 2.5h7l3 3v8.5H3V2.5z"/><path d="M6 2.5v3.5h4"/><rect x="5" y="9" width="6" height="3.5" rx="0.5"/></svg>',
        packExport:
            '<svg class="cv-icon" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M8 3v6"/><path d="M5.5 5.5L8 3l2.5 2.5"/><path d="M3 13h10"/></svg>',
        packImport:
            '<svg class="cv-icon" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M8 10V4"/><path d="M5.5 6.5L8 9l2.5-2.5"/><path d="M3 13h10"/></svg>',
        multiSelect:
            '<svg class="cv-icon" viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="2.5" y="2.5" width="5.5" height="5.5" rx="1"/><rect x="8" y="8" width="5.5" height="5.5" rx="1"/></svg>',
        comp:
            '<svg class="cv-icon cv-asset-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
            '<rect x="3" y="5" width="18" height="14" rx="2"/>' +
            '<path d="M10 9.5l5 3-5 3v-6z"/></svg>',
        layers:
            '<svg class="cv-icon cv-asset-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round">' +
            '<path d="M4 8l8-4 8 4-8 4-8-4z"/>' +
            '<path d="M4 13l8 4 8-4"/>' +
            '<path d="M4 18l8 4 8-4"/></svg>',
        preset:
            '<svg class="cv-icon cv-asset-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">' +
            '<path d="M4 7h16M4 12h10M4 17h14"/>' +
            '<circle cx="18" cy="12" r="2" fill="currentColor" stroke="none"/>' +
            '<circle cx="12" cy="17" r="2" fill="currentColor" stroke="none"/></svg>'
    };

    const assetSizes = { sm: 18, md: 28, lg: 48 };

    function html(name) {
        return svgs[name] || "";
    }

    function assetTypeHtml(type, size) {
        const key = type === "layers" ? "layers" : type === "preset" ? "preset" : "comp";
        const px = assetSizes[size] || assetSizes.md;
        const raw = svgs[key] || svgs.comp;
        return raw.replace(/class="cv-icon cv-asset-icon"/, 'class="cv-icon cv-asset-icon" width="' + px + '" height="' + px + '"');
    }

    function starHtml(on) {
        return on ? html("starFill") : html("star");
    }

    return { html: html, starHtml: starHtml, assetTypeHtml: assetTypeHtml };
})();
