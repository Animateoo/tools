/*
Â© Mateo Crespo (Animateo)

Puedes usar este plugin libremente.
No puedes venderlo, redistribuirlo ni publicar versiones modificadas.

Â¿Encontraste una mejora o correcciÃ³n?
Por favor, compÃ¡rtela con el autor.
*/
/**

 * MediaVault by Animateoo — iconos simples estilo panel Animateoo

 */

const MediaVaultIcons = (function () {

    const stroke = ' stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"';



    const svgs = {

        list:
            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +
            '<line x1="2" y1="4" x2="14" y2="4"/>' +
            '<line x1="2" y1="8" x2="14" y2="8"/>' +
            '<line x1="2" y1="12" x2="10" y2="12"/>' +
            "</svg>",

        grid:
            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +
            '<rect x="2" y="2" width="5" height="5" rx="1"/>' +
            '<rect x="9" y="2" width="5" height="5" rx="1"/>' +
            '<rect x="2" y="9" width="5" height="5" rx="1"/>' +
            '<rect x="9" y="9" width="5" height="5" rx="1"/>' +
            "</svg>",

        sidebar:
            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +
            '<rect x="2" y="2" width="12" height="12" rx="1.5"/>' +
            '<line x1="6" y1="2" x2="6" y2="14"/>' +
            "</svg>",

        star:
            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +
            '<path d="M8 2.5l1.5 3 3.3.5-2.4 2.3.6 3.2L8 10l-3 1.5.6-3.2L3.2 6l3.3-.5L8 2.5z"/>' +
            "</svg>",

        starFill:
            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14" fill="currentColor" stroke="none">' +
            '<path d="M8 2.5l1.5 3 3.3.5-2.4 2.3.6 3.2L8 10l-3 1.5.6-3.2L3.2 6l3.3-.5L8 2.5z"/>' +
            "</svg>",

        play:
            '<svg class="mv-icon" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" stroke="none">' +
            '<path d="M5.5 3.5v9l7-4.5-7-4.5z"/>' +
            "</svg>",

        pause:
            '<svg class="mv-icon" viewBox="0 0 16 16" width="12" height="12" fill="currentColor" stroke="none">' +
            '<rect x="4" y="3.5" width="2.8" height="9" rx="0.6"/>' +
            '<rect x="9.2" y="3.5" width="2.8" height="9" rx="0.6"/>' +
            "</svg>",

        audio:
            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +
            '<circle cx="5" cy="11.5" r="2"/>' +
            '<path d="M7 11.5V3.5l5-1.5v8"/>' +
            '<circle cx="12" cy="10" r="2"/>' +
            "</svg>",

        video:
            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +
            '<rect x="2" y="4" width="8.5" height="8" rx="1.2"/>' +
            '<path d="M10.5 7l3.5-2v6l-3.5-2"/>' +
            "</svg>",

        image:
            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +
            '<rect x="2" y="3" width="12" height="10" rx="1.2"/>' +
            '<circle cx="5.5" cy="6.5" r="1.2"/>' +
            '<path d="M2.5 11.5l3.5-3 2 1.5 2.5-2 3.5 3.5"/>' +
            "</svg>",

        file:
            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +
            '<path d="M5 2h4l3 3v9H5V2z"/>' +
            '<path d="M9 2v3h3"/>' +
            "</svg>",

        importIn:
            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +
            '<path d="M2 8h7"/><path d="M7 5.5L9.5 8 7 10.5"/>' +
            '<path d="M10 3h2.5a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H10"/>' +
            "</svg>",

        timeline:
            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +
            '<path d="M3 8h10"/><path d="M10 5l3 3-3 3"/>' +
            "</svg>",

        volume:
            '<svg class="mv-icon" viewBox="0 0 16 16" width="14" height="14"' + stroke + '>' +
            '<path d="M3 6.5v3h2l3 2.5V4L5 6.5H3z"/>' +
            '<path d="M10.5 6a2.5 2.5 0 0 1 0 4"/>' +
            '<path d="M12 4.5a4.5 4.5 0 0 1 0 7"/>' +
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


