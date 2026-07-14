/* eslint-disable no-unused-vars */
var ANIMATEO_TOOLS = [
    {
        id: 'grapheditor',
        name: 'GraphEditor',
        tag: 'Extensión · AE + Pr',
        shortDesc: 'Curvas CURVE / VALUE con easing y botón APLICAR — After Effects y Premiere Pro.',
        longDesc: 'Editor de curvas de velocidad y valor para After Effects y Premiere Pro. Arrastra handles, cambia entre modos CURVE y VALUE, aplica easing con un clic y manda el resultado al timeline. Disponible en dos repos: GraphEditorAE para AE y GraphEditorPR para Premiere.',
        repo: 'https://github.com/Animateoo/GraphEditorAE',
        repos: [
            { label: 'After Effects', url: 'https://github.com/Animateoo/GraphEditorAE', demo: '../../demos/grapheditor/index.html', w: 300, h: 480 },
            { label: 'Premiere Pro', url: 'https://github.com/Animateoo/GraphEditorPR', demo: '../../demos/grapheditorpr/index.html', w: 300, h: 480 }
        ],
        src: '../../demos/grapheditor/index.html',
        w: 300,
        h: 480,
        bg: '#161616',
        shell: 'ae',
        features: ['Modos CURVE y VALUE', 'Elastic, Bounce, Step', 'fx EXPR o ◆ KEYS (AE)', 'Filtros + Clean (PR)', 'Traer de AE / APLICAR'],
        faq: [
            { q: '¿Hay versión para Premiere Pro?', a: 'Sí. GraphEditorPR es la extensión para Premiere Pro (repo GraphEditorPR). GraphEditorAE es para After Effects. Cada una se instala por separado con su .zxp.' },
            { q: '¿Qué versiones soporta?', a: 'After Effects y Premiere Pro 2022+ con soporte CEP (Window → Extensions).' },
            { q: '¿Cómo instalo GraphEditor?', a: 'Descarga el .zxp del repo correspondiente (AE o PR), instálalo con ZXP Installer y reinicia la app. Lo encuentras en Window → Extensions.' },
            { q: '¿Funciona con keyframes seleccionados?', a: 'Sí. Selecciona propiedades con keyframes, abre el panel, edita la curva y pulsa APLICAR.' }
        ]
    },
    {
        id: 'textpresets',
        name: 'TextPresets',
        tag: 'Extensión · AE',
        shortDesc: 'Presets .ffx, favoritos y aplicación masiva con un clic.',
        longDesc: 'Navega, guarda y aplica presets de texto .ffx sin salir de After Effects. Marca favoritos, previsualiza y aplica a múltiples capas de texto a la vez.',
        repo: 'https://github.com/Animateoo/TextsPresetsAE',
        src: '../../demos/textpresets/preview.html',
        w: 300,
        h: 460,
        bg: '#191919',
        shell: 'ae',
        features: ['Biblioteca de presets .ffx', 'Favoritos', 'Aplicación masiva', 'Vista compacta en panel'],
        faq: [
            { q: '¿Necesito tener presets instalados?', a: 'TextPresets lee los .ffx de tu carpeta de presets de AE y los organiza en el panel.' },
            { q: '¿Puedo aplicar a varias capas?', a: 'Sí. Selecciona varias capas de texto y aplica el preset con un clic.' }
        ]
    },
    {
        id: 'compvault',
        name: 'CompVault',
        tag: 'Extensión · AE',
        shortDesc: 'Biblioteca de comps y capas con vista lista o cuadrícula.',
        longDesc: 'Guarda comps y capas favoritas en una biblioteca reutilizable. Cambia entre vista lista y cuadrícula, arrastra al proyecto y mantén tu flujo organizado.',
        repo: 'https://github.com/Animateoo',
        src: '../../demos/compvault/preview.html',
        w: 540,
        h: 320,
        bg: '#1c1c1c',
        shell: 'ae',
        features: ['Vista lista y cuadrícula', 'Biblioteca de comps', 'Arrastrar al proyecto', 'Organización rápida'],
        faq: [
            { q: '¿Qué puedo guardar?', a: 'Comps completas o capas individuales que uses con frecuencia en tus proyectos.' }
        ]
    },
    {
        id: 'mediavault',
        name: 'MediaVault',
        tag: 'Extensión · AE + Pr',
        shortDesc: 'Audios y footage con waveforms y árbol de carpetas.',
        longDesc: 'Explora audios y footage con waveforms integrados y árbol de carpetas. Ideal para encontrar clips rápido en AE y Premiere.',
        repo: 'https://github.com/Animateoo/MediaVault',
        src: '../../demos/mediavault/preview.html',
        w: 540,
        h: 420,
        bg: '#1c1c1c',
        shell: 'ae',
        features: ['Waveforms de audio', 'Árbol de carpetas', 'AE y Premiere', 'Preview rápido'],
        faq: [
            { q: '¿Funciona en Premiere?', a: 'Sí. MediaVault está pensado para AE y Pr con la misma lógica de biblioteca.' }
        ]
    },
    {
        id: 'assetpack',
        name: 'AssetPack',
        tag: 'Extensión · AE',
        shortDesc: 'Organiza footage, collect nativo y recupera archivos perdidos.',
        longDesc: 'Barra compacta para mantener tu proyecto limpio: organiza en (Footage), collect nativo, ZIP del timeline y recuperación de missing con un clic.',
        repo: 'https://github.com/Animateoo',
        src: '../../demos/assetpack/preview.html',
        w: 480,
        h: 32,
        bg: '#232323',
        shell: 'ae',
        features: ['Root All', 'Collect + ZIP', 'Find missing', 'Barra compacta'],
        faq: [
            { q: '¿Reemplaza el collect de AE?', a: 'Usa el flujo nativo de AE con accesos rápidos desde la barra del panel.' },
            { q: '¿Es lo mismo que Root Pro?', a: 'Sí. AssetPack es el nuevo nombre y diseño del panel, con la misma lógica de organización y collect.' }
        ]
    },
    {
        id: 'maskunlinker',
        name: 'Mask Unlinker',
        tag: 'ScriptUI · AE',
        shortDesc: 'Unlink, relink, mask ↔ shape y separar máscaras.',
        longDesc: 'ScriptUI para desvincular y revincular máscaras, convertir entre mask y shape, y separar máscaras en capas independientes.',
        repo: 'https://github.com/Animateoo/Mask-Unliker',
        src: '../../demos/maskunlinker/index.html',
        w: 300,
        h: 84,
        bg: '#1f1f1f',
        shell: 'ae',
        features: ['Unlink / Relink', 'Mask ↔ Shape', 'Separar máscaras', 'ScriptUI nativo'],
        faq: [
            { q: '¿Es extensión o script?', a: 'ScriptUI (.jsx). Copia el archivo en Scripts/ScriptUI Panels/ y abre Window → Mask Unlinker.' }
        ]
    },
    {
        id: 'aurapro',
        name: 'Aura Pro',
        tag: 'ScriptUI · AE',
        shortDesc: 'Paletas con sync, import/export JSON y picker nativo.',
        longDesc: 'Gestiona paletas de color con sincronización entre comps, import/export JSON real y picker nativo de After Effects.',
        repo: 'https://github.com/Animateoo/Aura-Pro',
        src: '../../demos/aurapro/index.html',
        w: 300,
        h: 190,
        bg: '#262626',
        shell: 'ae',
        features: ['Paletas múltiples', 'Import / Export JSON', 'Color picker nativo', 'Sync entre comps'],
        faq: [
            { q: '¿El JSON es compatible con el script real?', a: 'Sí. El formato de export/import replica la lógica del .jsx instalado en AE.' }
        ]
    },
    {
        id: 'audify',
        name: 'Audify',
        tag: 'ScriptUI · AE',
        shortDesc: 'Fade, volumen dB, reverse, EQ y ducking automático.',
        longDesc: 'Herramientas de audio en un solo panel: fades, volumen en dB, reverse, EQ básico y ducking automático para locución y música.',
        repo: 'https://github.com/Animateoo/Audify-After-Effect',
        src: '../../demos/audify/index.html',
        w: 300,
        h: 290,
        bg: '#141414',
        shell: 'ae',
        features: ['Fade in/out', 'Volumen dB', 'Reverse y EQ', 'Ducking automático'],
        faq: [
            { q: '¿Trabaja con capas seleccionadas?', a: 'Sí. Selecciona capas de audio en el timeline y aplica los controles del panel.' }
        ]
    },
    {
        id: 'cachepro',
        name: 'Cache Pro',
        tag: 'ScriptUI · AE',
        shortDesc: 'Snap, purge, caché, borrar footage y guardar versión.',
        longDesc: 'Accesos rápidos a snap del viewer, purge de caché con diálogo nativo, limpieza de footage y guardado de versión del proyecto.',
        repo: 'https://github.com/Animateoo/Cache-Pro',
        src: '../../demos/cachepro/index.html',
        w: 300,
        h: 80,
        bg: '#1f1f21',
        shell: 'ae',
        features: ['Snap viewer', 'Purge caché', 'Clear disk cache', 'Guardar versión'],
        faq: [
            { q: '¿El purge abre el diálogo nativo de AE?', a: 'Sí. El botón de purge dispara la ventana Clear Disk Cache como en After Effects.' }
        ]
    },
    {
        id: 'shuttle',
        name: 'Shuttle',
        tag: 'Extensión · Ai + Ps',
        shortDesc: 'Push & Pull entre Illustrator y Photoshop.',
        longDesc: 'Mueve arte entre Illustrator y Photoshop con push, pull y cambio rápido de aplicación. Pensado para flujos de ilustración y retoque.',
        repo: 'https://github.com/Animateoo',
        src: '../../demos/shuttle/preview.html',
        w: 300,
        h: 78,
        bg: '#323232',
        shell: 'ai',
        features: ['Push a Photoshop', 'Pull desde Ps', 'Switch de app', 'Panel CEP compacto'],
        faq: [
            { q: '¿Es panel de AE?', a: 'No. Shuttle vive en Illustrator y Photoshop como extensión CEP.' },
            { q: '¿Cómo instalo Shuttle?', a: 'Instala el .zxp con ZXP Installer y ábrelo desde Window → Extensions en Ai o Ps.' }
        ]
    }
];
