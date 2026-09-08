/* eslint-disable no-unused-vars */
var ANIMATEO_TOOLS = [
    {
        id: 'grapheditor',
        name: 'GraphEditor',
        tag: 'Extensión · AE + Pr',
        shortDesc: 'Edita curvas de animación y aplícalas a tus keyframes en After Effects o Premiere.',
        longDesc: 'Abres el panel, mueves la curva, y se aplica a tus keyframes. Sin menús ni vueltas.',
        tldr: 'El graph editor de AE, pero sin ganas de llorar.',
        repo: 'https://github.com/Animateoo/GraphEditor',
        repos: [
            { label: 'Descargar After Effects', url: 'https://github.com/Animateoo/GraphEditor', demo: '../demos/grapheditor/index.html', w: 300, h: 480 },
            { label: 'Descargar Premiere Pro', url: 'https://github.com/Animateoo/GraphEditor', demo: '../demos/grapheditor/index.html?app=PPRO', w: 300, h: 480 }
        ],
        src: '../demos/grapheditor/index.html',
        w: 300,
        h: 480,
        bg: '#161616',
        shell: 'ae',
        howItWorks: [
            'Menú de presets: eliges curvas rápidas como ease (suave), bounce (rebote), elastic (elástico), spring (resorte) o step (por pasos).',
            'Editor de curvas: arrastras los tiradores para personalizar la forma del movimiento a tu gusto.',
            'Botón APLICAR: aplica la curva que elegiste a los keyframes que tengas seleccionados.',
            'Ease in/out: controla qué tan rápido empieza o termina el movimiento.',
            'Botón Reset: vuelve la curva al estado lineal (sin ease).',
            'Selector de versión: cambia entre el repo de AE y el de Premiere si tienes ambos.'
        ],
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
        shortDesc: 'Encuentra y aplica presets de texto en After Effects con un clic.',
        longDesc: 'Un panel para ver y buscar todos tus .ffx de texto. Seleccionas la capa, le das clic y listo.',
        tldr: 'Tus presets de texto, a un clic y sin buscar en carpetas.',
        repo: 'https://github.com/Animateoo/TextsPresetsAE',
        src: '../demos/textpresets/preview.html',
        w: 300,
        h: 460,
        bg: '#191919',
        shell: 'ae',
        howItWorks: [
            'Barra de búsqueda: escribe cualquier palabra y filtra tus presets al toque.',
            'Lista de presets: muestra todos tus .ffx con nombre y preview.',
            'Clic en un preset: se aplica a todas las capas de texto que tengas seleccionadas.',
            'Icono de estrella: marcas el preset como favorito y siempre aparece arriba.',
            'Selección múltiple: puedes elegir varias capas de texto y aplicar el mismo preset a todas de una.'
        ],
        faq: [
            { q: '¿Necesito tener presets instalados?', a: 'TextPresets lee los .ffx de tu carpeta de presets de AE y los organiza en el panel.' },
            { q: '¿Puedo aplicar a varias capas?', a: 'Sí. Selecciona varias capas de texto y aplica el preset con un clic.' }
        ]
    },
    {
        id: 'compvault',
        name: 'CompVault',
        tag: 'Extensión · AE',
        shortDesc: 'Guarda comps y capas que reutilizas y llámalas cuando las necesites.',
        longDesc: 'Tu biblioteca personal de comps y capas recurrentes. Arrastras al panel para guardar, y al proyecto para usar.',
        tldr: 'El copy-paste definitivo para tus proyectos de AE.',
        repo: 'https://github.com/Animateoo',
        src: '../demos/compvault/preview.html',
        w: 540,
        h: 320,
        bg: '#1c1c1c',
        shell: 'ae',
        howItWorks: [
            'Botón de guardar: añade la comp o capa seleccionada a tu biblioteca personal.',
            'Vista de lista: ves todo en formato compacto con nombre y tipo.',
            'Vista de cuadrícula: ves las miniaturas más grandes para identificar rápido.',
            'Arrastrar y soltar: llevas los elementos del panel directo a tu proyecto actual.',
            'Botón de eliminar: sacas lo que ya no necesites de la biblioteca.'
        ],
        faq: [
            { q: '¿Qué puedo guardar?', a: 'Comps completas o capas individuales que uses con frecuencia en tus proyectos.' }
        ]
    },
    {
        id: 'mediavault',
        name: 'MediaVault',
        tag: 'Extensión · AE + Pr',
        shortDesc: 'Encuentra audios y clips rápido con carpetas y ondas de sonido.',
        longDesc: 'Un explorador de archivos directo en tu programa. Ves las ondas de audio antes de importar para no perder tiempo.',
        tldr: 'Deja de adivinar cuál es el "swoosh_03.wav" correcto.',
        repo: 'https://github.com/Animateoo/MediaVault',
        src: '../demos/mediavault/preview.html',
        w: 540,
        h: 420,
        bg: '#1c1c1c',
        shell: 'ae',
        howItWorks: [
            'Navegador de carpetas: te mueves por tus archivos sin salir de AE o Premiere.',
            'Vista de onda (waveform): ves la forma del audio para saber qué suena sin darle play.',
            'Preview rápido: le das clic a un archivo y lo escuchas directo en el panel.',
            'Botón Importar: metes el archivo que estás viendo a tu proyecto al instante.',
            'Filtro por tipo: te muestra solo videos, solo audios o todo junto.'
        ],
        faq: [
            { q: '¿Funciona en Premiere?', a: 'Sí. MediaVault está pensado para AE y Pr con la misma lógica de biblioteca.' }
        ]
    },
    {
        id: 'assetpack',
        name: 'AssetPack',
        tag: 'Extensión · AE',
        shortDesc: 'Ordena el footage, haz collect y recupera archivos perdidos.',
        longDesc: 'Una barra minimalista que te limpia el desastre de carpetas. Ordenas, buscas o empacas tu proyecto con un clic.',
        tldr: 'La escoba mágica para tus proyectos desordenados.',
        repo: 'https://github.com/Animateoo',
        src: '../demos/assetpack/preview.html',
        w: 480,
        h: 32,
        bg: '#232323',
        shell: 'ae',
        howItWorks: [
            'Botón Ordenar: te acomoda todo el footage suelto en carpetas por tipo (video, audio, imágenes).',
            'Botón Buscar faltantes: reconecta esos archivos que se muestran offline al toque.',
            'Botón Collect: reúne todos los archivos del proyecto en una sola carpeta.',
            'Botón ZIP: empaqueta todo el proyecto listo para mandarlo por email/drive.',
            'Barra compacta: ocupa una sola línea en la interfaz, no estorba.'
        ],
        faq: [
            { q: '¿Reemplaza el collect de AE?', a: 'Usa el flujo nativo de AE con accesos rápidos desde la barra del panel.' },
            { q: '¿Es lo mismo que Root Pro?', a: 'Sí. AssetPack es el nuevo nombre y diseño del panel, con la misma lógica de organización y collect.' }
        ]
    },
    {
        id: 'maskunlinker',
        name: 'Mask Unlinker',
        tag: 'ScriptUI · AE',
        shortDesc: 'Desvincula, vuelve a vincular y separa máscaras en After Effects.',
        longDesc: 'Tres botones para domar las máscaras. Sepáralas de su capa, conviértelas o reconéctalas sin romper nada.',
        tldr: 'Ctrl+Z para tus máscaras rebeldes.',
        repo: 'https://github.com/Animateoo/Mask-Unliker',
        src: '../demos/maskunlinker/index.html',
        w: 300,
        h: 84,
        bg: '#1f1f1f',
        shell: 'ae',
        howItWorks: [
            'Botón Unlink: separa la máscara de la capa y la vuelve independiente.',
            'Botón Relink: vuelve a pegar la máscara separada a la capa de donde salió.',
            'Botón Convert: te convierte esa máscara en una capa de forma (shape layer).',
            'Funciona con selección: solo afecta las máscaras/capas que tengas seleccionadas.',
            'Panel chico: ocupa poco espacio, lo dejas siempre abierto sin molestar.'
        ],
        faq: [
            { q: '¿Es extensión o script?', a: 'ScriptUI (.jsx). Copia el archivo en Scripts/ScriptUI Panels/ y abre Window → Mask Unlinker.' }
        ]
    },
    {
        id: 'aurapro',
        name: 'Aura Pro',
        tag: 'ScriptUI · AE',
        shortDesc: 'Crea y guarda paletas de color para tus proyectos en AE.',
        longDesc: 'Gestor de colores para no andar copiando y pegando hexadecimles. Pinchas, guardas y aplicas.',
        tldr: 'Tus colores a mano, por fin.',
        repo: 'https://github.com/Animateoo/Aura-Pro',
        src: '../demos/aurapro/index.html',
        w: 550,
        h: 430,
        bg: '#262626',
        shell: 'none',
        howItWorks: [
            'Gotero (eyedropper): seleccionas cualquier color de tu pantalla y lo agregas a la paleta.',
            'Clic en muestra de color: aplicas ese color directo al fill o stroke de tu capa.',
            'Crear paleta nueva: armas grupos de colores para cada proyecto.',
            'Botón Import: cargas paletas de un archivo .json que te hayan pasado.',
            'Botón Export: guardas tu paleta como .json para compartir o usar después.'
        ],
        faq: [
            { q: '¿El JSON es compatible con el script real?', a: 'Sí. El formato de export/import replica la lógica del .jsx instalado en AE.' }
        ]
    },
    {
        id: 'audify',
        name: 'Audify',
        tag: 'ScriptUI · AE',
        shortDesc: 'Controla volumen, fades y ducking de audio en un solo panel.',
        longDesc: 'Domina el audio sin salir a Audition. Bajas el volumen de la música automáticamente cuando alguien habla.',
        tldr: 'Audio para animadores que odian editar audio.',
        repo: 'https://github.com/Animateoo/Audify-After-Effect',
        src: '../demos/audify/index.html',
        w: 300,
        h: 290,
        bg: '#141414',
        shell: 'ae',
        howItWorks: [
            'Slider de volumen: subes o bajas los dB de las capas de audio seleccionadas.',
            'Fade In / Fade Out: controlas cuántos segundos tarda en entrar o salir el sonido.',
            'Botón Reverse: invierte el audio completo con un clic.',
            'EQ simple: ajustas graves, medios y agudos sin salir a otro programa.',
            'Auto-ducking: la música baja sola cuando detecta voces en otra capa del timeline.'
        ],
        faq: [
            { q: '¿Trabaja con capas seleccionadas?', a: 'Sí. Selecciona capas de audio en el timeline y aplica los controles del panel.' }
        ]
    },
    {
        id: 'cachepro',
        name: 'Cache Pro',
        tag: 'ScriptUI · AE',
        shortDesc: 'Limpia caché, saca snap y guarda versión del proyecto al toque.',
        longDesc: 'Cuatro atajos de vida o muerte para After Effects. Limpias espacio y salvas tu proyecto sin entrar a 40 menús.',
        tldr: 'El botón de pánico y limpieza para AE.',
        repo: 'https://github.com/Animateoo/Cache-Pro',
        src: '../demos/cachepro/index.html',
        w: 300,
        h: 80,
        bg: '#1f1f21',
        shell: 'ae',
        howItWorks: [
            'Botón Screenshot: saca una captura limpia del visor (Composition Viewer) al instante.',
            'Botón Purge: libera la RAM de AE cuando se pone pesado.',
            'Botón Clean Disk Cache: borra el caché del disco para recuperar espacio en tu SSD.',
            'Botón Save Version: te guarda una copia del .aep con fecha, por si algo sale mal.',
            'Panel compacto: 4 botones en una barra, siempre a la mano sin estorbar.'
        ],
        faq: [
            { q: '¿El purge abre el diálogo nativo de AE?', a: 'Sí. El botón de purge dispara la ventana Clear Disk Cache como en After Effects.' }
        ]
    },
    {
        id: 'shuttle',
        name: 'Shuttle',
        tag: 'Extensión · Ai + Ps',
        shortDesc: 'Pasa arte entre Illustrator y Photoshop sin copiar a mano.',
        longDesc: 'Mandas tu arte de Illustrator a Photoshop, o al revés, con un solo clic. Chau al Copy+Paste fallido.',
        tldr: 'El puente mágico entre vectores y píxeles.',
        repo: 'https://github.com/Animateoo/Shuttle',
        download: 'https://github.com/Animateoo/Shuttle/releases/latest',

        src: '../demos/shuttle/preview.html',
        w: 300,
        h: 78,
        bg: '#323232',
        shell: 'ai',
        howItWorks: [
            'Botón "Send to Ps": manda lo seleccionado en Illustrator directo a Photoshop.',
            'Botón "Bring from Ps": te trae la capa activa de Photoshop a tu mesa de Illustrator.',
            'Cambio automático de app: apretas el botón y te salta a la otra app sin Alt+Tab.',
            'Funciona con artboards: respeta el tamaño y posición original de lo que mandas.',
            'Panel simétrico: el mismo panel funciona igual en Illustrator y en Photoshop.'
        ],
        faq: [
            { q: '¿Es panel de AE?', a: 'No. Shuttle vive en Illustrator y Photoshop como extensión CEP.' },
            { q: '¿Cómo instalo Shuttle?', a: 'Instala el .zxp con ZXP Installer y ábrelo desde Window → Extensions en Ai o Ps.' }
        ]
    }
];
