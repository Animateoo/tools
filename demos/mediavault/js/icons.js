/**

 * MediaVault by Animateoo — iconos simples estilo BadFX

 */

const MediaVaultIcons = (function () {

    const stroke = ' stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"';



    const svgs = {

        list:

            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +

            '<line x1="2.5" y1="4" x2="13.5" y2="4"/>' +

            '<line x1="2.5" y1="8" x2="13.5" y2="8"/>' +

            '<line x1="2.5" y1="12" x2="9.5" y2="12"/>' +

            "</svg>",

        grid:

            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +

            '<rect x="2.5" y="2.5" width="4.5" height="4.5" rx="0.5"/>' +

            '<rect x="9" y="2.5" width="4.5" height="4.5" rx="0.5"/>' +

            '<rect x="2.5" y="9" width="4.5" height="4.5" rx="0.5"/>' +

            '<rect x="9" y="9" width="4.5" height="4.5" rx="0.5"/>' +

            "</svg>",

        sidebar:

            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +

            '<rect x="2.5" y="2.5" width="11" height="11" rx="1"/>' +

            '<line x1="6" y1="2.5" x2="6" y2="13.5"/>' +

            "</svg>",

        star:

            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +

            '<path d="M8 3l1.4 2.8 3.1.5-2.2 2.1.5 3.1L8 10.2 5.2 11.5l.5-3.1-2.2-2.1 3.1-.5L8 3z"/>' +

            "</svg>",

        starFill:

            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" stroke="none">' +

            '<path d="M8 2.5l1.8 3.6 4 .6-2.9 2.8.7 4L8 11.8l-3.6 2 .7-4-2.9-2.8 4-.6L8 2.5z"/>' +

            "</svg>",

        play:

            '<svg class="mv-icon" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" stroke="none">' +

            '<path d="M6 4.5v7l6-3.5-6-3.5z"/>' +

            "</svg>",

        pause:

            '<svg class="mv-icon" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" stroke="none">' +

            '<rect x="4.5" y="4" width="2.5" height="8" rx="0.5"/>' +

            '<rect x="9" y="4" width="2.5" height="8" rx="0.5"/>' +

            "</svg>",

        audio:

            '<svg class="mv-icon" viewBox="0 0 16 16" width="13" height="13"' + stroke + '>' +

            '<path d="M3.5 10V6.5a2 2 0 0 1 4 0V10a2 2 0 0 1-4 0z"/>' +

            '<path d="M7.5 7.5V4.5a2.5 2.5 0 0 1 5 0V10a2 2 0 0 1-4 0"/>' +

            "</svg>",

        video:

            '<svg class="mv-icon" viewBox="0 0 16 16" width="13" height="13"' + stroke + '>' +

            '<rect x="2.5" y="4.5" width="8" height="7" rx="1"/>' +

            '<path d="M10.5 7l3-1.5v5l-3-1.5V7z"/>' +

            "</svg>",

        image:

            '<svg class="mv-icon" viewBox="0 0 16 16" width="13" height="13"' + stroke + '>' +

            '<rect x="2.5" y="3.5" width="11" height="9" rx="1"/>' +

            '<circle cx="5.5" cy="6.5" r="1"/>' +

            '<path d="M3 11.5l3-2.5 2 1.5 2-1.5 3 2.5"/>' +

            "</svg>",

        file:

            '<svg class="mv-icon" viewBox="0 0 16 16" width="13" height="13"' + stroke + '>' +

            '<path d="M5.5 2.5h3.5l2.5 2.5v8.5H5.5V2.5z"/>' +

            '<path d="M9 2.5v2.5h2.5"/>' +

            "</svg>",

        importIn:

            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +

            '<path d="M8 3v5.5"/><path d="M5.5 7.5L8 10l2.5-2.5"/><path d="M3.5 12.5h9"/>' +

            "</svg>",

        timeline:

            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +

            '<path d="M2.5 5.5h9"/><path d="M2.5 9.5h5.5"/><path d="M13 7.5v4"/><path d="M11 9.5h4"/>' +

            "</svg>",

        volume:

            '<svg class="mv-icon" viewBox="0 0 16 16" width="12" height="12"' + stroke + '>' +

            '<path d="M3.5 6.5v3h1.5l2.5 2V4.5L5 6.5H3.5z"/>' +

            '<path d="M10.5 6.5a2 2 0 0 1 0 3"/><path d="M12 5a3.5 3.5 0 0 1 0 6"/>' +

            "</svg>",

        chevron:

            '<svg class="mv-icon mv-chevron" viewBox="0 0 16 16" width="10" height="10"' + stroke + '>' +

            '<path d="M6 4l4 4-4 4"/>' +

            "</svg>"

    };



    function html(name) {

        return svgs[name] || svgs.file;

    }



    function typeHtml(type) {

        const map = {

            video: "video",

            audio: "audio",

            image: "image",

            project: "file",

            preset: "file",

            other: "file"

        };

        return html(map[type] || "file");

    }



    function starHtml(on) {

        return on ? html("starFill") : html("star");

    }



    function setPlayState(btn, playing) {

        if (!btn) return;

        btn.innerHTML = playing ? html("pause") : html("play");

        btn.setAttribute("aria-label", playing ? "Pausar" : "Reproducir");

    }



    function mountTypeIcon(el, type) {

        if (!el) return;

        el.innerHTML = typeHtml(type);

    }



    return {

        html: html,

        typeHtml: typeHtml,

        starHtml: starHtml,

        setPlayState: setPlayState,

        mountTypeIcon: mountTypeIcon

    };

})();


