/**
 * TextPresets - Complete Application Logic
 * Includes: Quick Animator + Full Preset Manager
 */

// Initialize CSInterface
const csInterface = new CSInterface();
const extensionPath = csInterface.getSystemPath(SystemPath.EXTENSION);

/** Carpeta raíz de presets (.ffx oficiales + personalizados). */
function getPresetsRootPath() {
    if (path) {
        return path.join(extensionPath.replace(/[/\\]+$/, ''), 'presets');
    }
    return extensionPath.replace(/[/\\]+$/, '') + '/presets';
}

/** Única carpeta para importar / guardar presets personalizados. */
function getAnimateFFXFolderPath() {
    if (path) {
        return path.join(getPresetsRootPath(), 'animate');
    }
    return getPresetsRootPath().replace(/[/\\]+$/, '') + '/animate';
}

/** ExtendScript en Windows necesita rutas nativas para File.exists. */
function toExtendScriptPath(filePath) {
    if (!filePath) return filePath;
    return String(filePath).replace(/\//g, '\\');
}

/** Clave estable para favoritos (por ruta del .ffx, no por id que cambia al escanear). */
function getFavoriteKeyForPreset(preset) {
    if (!preset) return null;
    if (preset.path) {
        return 'ffx:' + toExtendScriptPath(preset.path).toLowerCase();
    }
    if (preset.id) return String(preset.id);
    if (preset.key) return 'fx:' + preset.key;
    return null;
}

function isPresetFavorite(preset) {
    const key = getFavoriteKeyForPreset(preset);
    if (!key) return false;
    return state.favoritePresets.has(key) ||
        (preset.id && state.favoritePresets.has(preset.id));
}

function setFavoriteStarIcon(starEl, favorited) {
    const filled = '<svg class="favorite-star-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>';
    const outline = '<svg class="favorite-star-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="none" stroke="currentColor" stroke-width="1.65" d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27z"/></svg>';
    starEl.innerHTML = favorited ? filled : outline;
    starEl.classList.toggle('favorited', favorited);
}

function updateFavoriteStarUI(preset, buttonElement) {
    const favorite = isPresetFavorite(preset);
    const pathNorm = preset.path
        ? toExtendScriptPath(preset.path).toLowerCase()
        : '';

    const applyToStar = (star) => {
        setFavoriteStarIcon(star, favorite);
        star.title = favorite ? 'Quitar de favoritos' : 'Agregar a favoritos';
        star.setAttribute('aria-pressed', favorite ? 'true' : 'false');
    };

    if (buttonElement) applyToStar(buttonElement);

    document.querySelectorAll('.effect-btn[data-is-ae-preset="true"]').forEach((btn) => {
        const matchId = preset.id && btn.dataset.presetId === preset.id;
        const matchPath = pathNorm && btn.dataset.presetPath &&
            toExtendScriptPath(btn.dataset.presetPath).toLowerCase() === pathNorm;
        if (matchId || matchPath) {
            const star = btn.querySelector('.favorite-star');
            if (star) applyToStar(star);
        }
    });
}

function attachFavoriteStarHandler(starBtn, preset) {
    starBtn.type = 'button';
    starBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    starBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleFavorite(preset, starBtn);
    });
}

// Node.js modules for robust file handling
let fs, path;
try {
    fs = require('fs');
    path = require('path');
} catch (e) {
    console.error('Node.js modules not available:', e);
}

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let state = {
    // Quick Animator
    currentPresets: { entrance: [], exit: [] },
    selectedEffects: { entrance: null, exit: null },

    // Preset Manager
    currentTab: 'quick',
    currentPresetTab: 'custom',
    currentCategory: 'favorites',
    aePresets: { animateIn: [], animateOut: [] },
    customPresets: [],
    selectedPreset: null,
    editingPreset: null,
    searchQuery: '',

    // Favorites (stored as preset IDs for AE presets, effect keys for quick effects)
    favoritePresets: new Set(),
    favoriteEffects: new Set(),

    // Favorites filter toggle
    showOnlyFavorites: false,

    // Last clicked AE preset for deletion/management
    lastClickedAEPreset: null,

    // Preset seleccionado para APLICAR (único)
    selectedApplyPreset: null
};

// Category mapping for quick animator + AE presets
const categoryMapping = {
    'entrance-basic': ['fade_in', 'slide_up', 'slide_right'],
    'entrance-dynamic': ['bounce_in', 'pop_in', 'expand'],
    'entrance-advanced': ['zoom_blur', 'rotate_3d', 'glitch'],
    'entrance-special': ['tiktok_style', 'double_shadow'],
    'exit': ['fade_out', 'slide_down', 'zoom_out', 'shrink']
};

// Keyword-based animation mapping for AE presets
// This maps keywords in preset names to animation classes
function getAnimationForPreset(presetName) {
    const name = presetName.toLowerCase();

    // Fade animations
    if (name.includes('fade') && (name.includes('up') || name.includes('in') || name.includes('on'))) {
        return 'fade-in';
    }
    if (name.includes('fade') && (name.includes('down') || name.includes('out') || name.includes('off'))) {
        return 'fade-out';
    }
    if (name.includes('opacity') || name.includes('decoder')) {
        return 'fade-in';
    }

    // Slide animations
    if (name.includes('slide') && name.includes('up')) {
        return 'slide-up';
    }
    if (name.includes('slide') && (name.includes('down') || name.includes('out'))) {
        return 'slide-down';
    }
    if (name.includes('slide') && (name.includes('in') || name.includes('right') || name.includes('edge'))) {
        return 'slide-right';
    }

    // Drop/Fall animations
    if (name.includes('drop') || name.includes('rain')) {
        return 'slide-down';
    }

    // Fly animations
    if (name.includes('fly') && (name.includes('bottom') || name.includes('in'))) {
        return 'slide-up';
    }
    if (name.includes('fly') && (name.includes('top') || name.includes('out'))) {
        return 'slide-up';
    }

    // Pop/Bounce animations
    if (name.includes('pop') || name.includes('buzz')) {
        return 'pop-in';
    }
    if (name.includes('bounce')) {
        return 'bounce-in';
    }

    // Spin/Rotate/Twirl animations
    if (name.includes('spin') || name.includes('twirl') || name.includes('twist')) {
        return 'rotate-3d';
    }
    if (name.includes('spiral')) {
        return 'rotate-3d';
    }

    // Shuffle/Glitch/Random animations
    if (name.includes('shuffle') || name.includes('random') || name.includes('alternating')) {
        return 'glitch';
    }
    if (name.includes('decode')) {
        return 'glitch';
    }

    // Typewriter
    if (name.includes('typewriter') || name.includes('cursor')) {
        return 'fade-in';
    }

    // Straight/Wipe animations
    if (name.includes('straight') || name.includes('wipe')) {
        return 'slide-right';
    }

    // Smooth/Move
    if (name.includes('smooth') || name.includes('move')) {
        return 'slide-up';
    }

    // Stretch/Expand
    if (name.includes('stretch') || name.includes('expand')) {
        return 'expand';
    }

    // Shrink/Zoom
    if (name.includes('shrink')) {
        return 'shrink';
    }
    if (name.includes('zoom') && name.includes('out')) {
        return 'zoom-out';
    }
    if (name.includes('zoom') || name.includes('eye chart')) {
        return 'zoom-blur';
    }

    // Default fallback based on type
    if (name.includes('out') || name.includes('off')) {
        return 'fade-out';
    }

    // Default for entrance
    return 'fade-in';
}

// Animation mapping
const animationMap = {
    'fade_in': 'fade-in', 'slide_up': 'slide-up', 'slide_right': 'slide-right',
    'bounce_in': 'bounce-in', 'expand': 'expand', 'zoom_blur': 'zoom-blur',
    'glitch': 'glitch', 'rotate_3d': 'rotate-3d', 'pop_in': 'pop-in',
    'tiktok_style': 'tiktok-style', 'double_shadow': 'double-shadow',
    'fade_out': 'fade-out', 'slide_down': 'slide-down', 'zoom_out': 'zoom-out',
    'shrink': 'shrink'
};

// Icons mapping
const ICON_MAP = {
    'fade_in': '🌫️', 'slide_up': '⬆️', 'slide_right': '➡️', 'bounce_in': '🏀',
    'expand': '💥', 'zoom_blur': '🔭', 'glitch': '📺', 'rotate_3d': '🔄',
    'pop_in': '🎈', 'tiktok_style': '🎵', 'double_shadow': '👥',
    'fade_out': '🌫️', 'slide_down': '⬇️', 'zoom_out': '🔭', 'shrink': '🤏'
};

/**
 * Tipo de aplicación: entrada, salida o ambos (según preset.type o nombre del .ffx).
 */
function inferPresetApplyType(preset) {
    if (!preset) return 'entrance';

    const explicit = String(preset.type || preset.applyType || '').toLowerCase();
    if (explicit === 'entrance' || explicit === 'exit' || explicit === 'both') {
        return explicit;
    }

    const name = String(preset.name || '').toLowerCase();

    if (/\b(ambos|both|in\s*out|in_out|in-out)\b/.test(name) ||
        (/\b(in|entrada|entrance)\b/.test(name) && /\b(out|salida|exit)\b/.test(name))) {
        return 'both';
    }
    if (/\b(salida|exit|outro|fade\s*out|zoom\s*out|slide\s*out|off)\b/.test(name) || /\bout\b/.test(name)) {
        return 'exit';
    }
    if (/\b(entrada|entrance|intro|fade\s*in|zoom\s*in|slide\s*in)\b/.test(name) || /\bin\b/.test(name)) {
        return 'entrance';
    }

    return 'entrance';
}

function getSelectedApplyPreset() {
    if (state.selectedApplyPreset) return state.selectedApplyPreset;
    if (state.selectedPreset) return state.selectedPreset;
    if (state.lastClickedAEPreset) return state.lastClickedAEPreset;
    const legacy = state.selectedEffects && state.selectedEffects.entrance;
    if (legacy && typeof legacy === 'object' && legacy.isAEPreset) return legacy;
    return null;
}

function setApplyButtonsDisabled(disabled) {
    const ids = ['applyBtn', 'applyPresetManagerBtn', 'applyPresetBtn'];
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.disabled = disabled;
    });
}

function normalizeAEPresetsList(presets) {
    if (!presets || !presets.length) return;
    presets.forEach((p) => {
        if (p.sourceFolder === 'Animate In') {
            p.type = 'entrance';
            p.applyType = 'entrance';
            return;
        }
        if (p.sourceFolder === 'Animate Out') {
            p.type = 'exit';
            p.applyType = 'exit';
            return;
        }
        const applyType = inferPresetApplyType(p);
        p.type = applyType;
        p.applyType = applyType;
    });
}

/**
 * Escanea presets .ffx: Animate In/Out (oficiales) + carpeta animate (personalizados).
 */
function scanFfxPresetsFromDisk() {
    const result = { animateIn: [], animateOut: [] };
    if (!fs || !path) return result;

    const root = getPresetsRootPath();
    const seenPaths = new Set();
    const list = result.animateIn;

    function addFromFolder(relativeFolder, defaultType, isCustom) {
        const folderPath = path.join(root, relativeFolder);
        if (!fs.existsSync(folderPath)) return;

        if (relativeFolder.toLowerCase() === 'animate') {
            fs.mkdirSync(folderPath, { recursive: true });
        }

        fs.readdirSync(folderPath).forEach((file) => {
            if (!file.toLowerCase().endsWith('.ffx')) return;

            const fullPath = path.join(folderPath, file);
            const dedupeKey = fullPath.toLowerCase();
            if (seenPaths.has(dedupeKey)) return;
            seenPaths.add(dedupeKey);

            const stats = fs.statSync(fullPath);
            const presetName = file.replace(/\.ffx$/i, '');
            const applyType = defaultType === 'infer'
                ? inferPresetApplyType({ name: presetName })
                : defaultType;

            const idPrefix = isCustom
                ? 'ae_custom_'
                : (defaultType === 'exit' ? 'ae_out_' : 'ae_in_');

            const presetObj = {
                id: idPrefix + file,
                name: presetName,
                path: fullPath,
                isAEPreset: true,
                isCustom: isCustom,
                sourceFolder: relativeFolder,
                type: applyType,
                applyType: applyType,
                size: stats.size,
                date: stats.mtime
            };

            list.push(presetObj);
            if (applyType === 'exit') {
                result.animateOut.push(presetObj);
            }
        });
    }

    addFromFolder('Animate In', 'entrance', false);
    addFromFolder('Animate Out', 'exit', false);
    addFromFolder('animate', 'infer', true);

    normalizeAEPresetsList(list);
    return result;
}

// DOM Elements
const elements = {
    // Quick Animator
    applyBtn: document.getElementById('applyBtn'),
    resetBtn: document.getElementById('resetBtn'),
    keysInOutBtn: document.getElementById('keysInOutBtn'),
    refreshBtn: document.getElementById('refreshBtn'),
    importSRTBtn: document.getElementById('importSRTBtn'),
    srtFileInput: document.getElementById('srtFileInput'),
    status: document.getElementById('status'),
    compName: document.getElementById('compName'),
    compResolution: document.getElementById('compResolution'),
    textLayers: document.getElementById('textLayers'),
    entranceSpeed: document.getElementById('entranceSpeed'), // Optional - may not exist
    exitSpeed: document.getElementById('exitSpeed'), // Optional - may not exist
    entranceSpeedValue: document.getElementById('entranceSpeedValue'), // Optional
    exitSpeedValue: document.getElementById('exitSpeedValue'), // Optional
    saveSelectionBtn: document.getElementById('saveSelectionBtn'), // New button
    renamePresetBtn: document.getElementById('renamePresetBtn'), // New button
    deleteSelectedPresetBtn: document.getElementById('deleteSelectedPresetBtn'), // New button

    // Preset Manager
    presetSearch: document.getElementById('presetSearch'),
    presetGrid: document.getElementById('presetGrid'),
    createPresetBtn: document.getElementById('createPresetBtn'),
    importPresetsBtn: document.getElementById('importPresetsBtn'),
    exportPresetsBtn: document.getElementById('exportPresetsBtn'),
    applyPresetBtn: document.getElementById('applyPresetBtn'),
    presetImportInput: document.getElementById('presetImportInput'),

    // Modal
    presetModal: document.getElementById('presetModal'),
    modalTitle: document.getElementById('modalTitle'),
    modalClose: document.getElementById('modalClose'),
    presetName: document.getElementById('presetName'),
    presetType: document.getElementById('presetType'),
    baseEntranceAnim: document.getElementById('baseEntranceAnim'),
    baseExitAnim: document.getElementById('baseExitAnim'),
    modalEntranceSpeed: document.getElementById('modalEntranceSpeed'),
    modalExitSpeed: document.getElementById('modalExitSpeed'),
    modalEntranceSpeedValue: document.getElementById('modalEntranceSpeedValue'),
    modalExitSpeedValue: document.getElementById('modalExitSpeedValue'),
    presetFavorite: document.getElementById('presetFavorite'),
    cancelPresetBtn: document.getElementById('cancelPresetBtn'),
    savePresetBtn: document.getElementById('savePresetBtn'),

    // UI shell (sin alert / confirm / prompt del navegador)
    presetContextMenu: document.getElementById('presetContextMenu'),
    uiConfirmModal: document.getElementById('uiConfirmModal'),
    uiConfirmTitle: document.getElementById('uiConfirmTitle'),
    uiConfirmMessage: document.getElementById('uiConfirmMessage'),
    uiConfirmClose: document.getElementById('uiConfirmClose'),
    uiConfirmCancel: document.getElementById('uiConfirmCancel'),
    uiConfirmOk: document.getElementById('uiConfirmOk'),
    uiPromptModal: document.getElementById('uiPromptModal'),
    uiPromptTitle: document.getElementById('uiPromptTitle'),
    uiPromptLabel: document.getElementById('uiPromptLabel'),
    uiPromptInput: document.getElementById('uiPromptInput'),
    uiPromptClose: document.getElementById('uiPromptClose'),
    uiPromptCancel: document.getElementById('uiPromptCancel'),
    uiPromptOk: document.getElementById('uiPromptOk'),
    uiMessageModal: document.getElementById('uiMessageModal'),
    uiMessageTitle: document.getElementById('uiMessageTitle'),
    uiMessageBody: document.getElementById('uiMessageBody'),
    uiMessageClose: document.getElementById('uiMessageClose'),
    uiMessageOk: document.getElementById('uiMessageOk')
};

let _contextMenuPreset = null;
let _documentClickCloseCtx = null;

function closePresetContextMenu() {
    const menu = elements.presetContextMenu;
    if (!menu) return;
    menu.classList.remove('active');
    menu.setAttribute('aria-hidden', 'true');
    _contextMenuPreset = null;
    if (_documentClickCloseCtx) {
        document.removeEventListener('click', _documentClickCloseCtx);
        _documentClickCloseCtx = null;
    }
}

function showPresetContextMenu(preset, event) {
    const menu = elements.presetContextMenu;
    if (!menu) return;
    closePresetContextMenu();
    _contextMenuPreset = preset;
    menu.classList.add('active');
    menu.setAttribute('aria-hidden', 'false');

    const pad = 8;
    let x = (event && event.clientX) ? event.clientX : pad;
    let y = (event && event.clientY) ? event.clientY : pad;
    menu.style.left = x + 'px';
    menu.style.top = y + 'px';

    requestAnimationFrame(() => {
        const rect = menu.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        if (x + rect.width > vw - pad) x = Math.max(pad, vw - rect.width - pad);
        if (y + rect.height > vh - pad) y = Math.max(pad, vh - rect.height - pad);
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
    });

    if (_documentClickCloseCtx) {
        document.removeEventListener('click', _documentClickCloseCtx);
    }
    setTimeout(() => {
        _documentClickCloseCtx = function (e) {
            if (!menu.contains(e.target)) {
                closePresetContextMenu();
            }
        };
        document.addEventListener('click', _documentClickCloseCtx);
    }, 0);
}

function showConfirmDialog(opts) {
    const {
        title,
        message,
        confirmLabel = 'Aceptar',
        cancelLabel = 'Cancelar',
        danger = false
    } = opts;
    const modal = elements.uiConfirmModal;
    return new Promise((resolve) => {
        if (!modal || !elements.uiConfirmOk) {
            resolve(false);
            return;
        }
        elements.uiConfirmTitle.textContent = title;
        elements.uiConfirmMessage.textContent = message;
        elements.uiConfirmOk.textContent = confirmLabel;
        elements.uiConfirmCancel.textContent = cancelLabel;
        elements.uiConfirmOk.className = danger ? 'btn-apply btn-destructive' : 'btn-apply btn-both';

        function cleanup(result) {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            modal.removeEventListener('click', onBackdrop);
            elements.uiConfirmOk.removeEventListener('click', onOk);
            elements.uiConfirmCancel.removeEventListener('click', onCancel);
            elements.uiConfirmClose.removeEventListener('click', onCancel);
            resolve(result);
        }

        function onOk(e) {
            e.preventDefault();
            e.stopPropagation();
            cleanup(true);
        }
        function onCancel(e) {
            e.preventDefault();
            e.stopPropagation();
            cleanup(false);
        }
        function onBackdrop(e) {
            if (e.target === modal) cleanup(false);
        }

        elements.uiConfirmOk.addEventListener('click', onOk);
        elements.uiConfirmCancel.addEventListener('click', onCancel);
        elements.uiConfirmClose.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    });
}

function showPromptDialog(opts) {
    const {
        title,
        label,
        defaultValue = '',
        okLabel = 'Aceptar',
        cancelLabel = 'Cancelar'
    } = opts;
    const modal = elements.uiPromptModal;
    return new Promise((resolve) => {
        if (!modal || !elements.uiPromptInput) {
            resolve(null);
            return;
        }
        elements.uiPromptTitle.textContent = title;
        elements.uiPromptLabel.textContent = label;
        elements.uiPromptOk.textContent = okLabel;
        elements.uiPromptCancel.textContent = cancelLabel;
        elements.uiPromptInput.value = defaultValue;

        function cleanup(result) {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            modal.removeEventListener('click', onBackdrop);
            elements.uiPromptOk.removeEventListener('click', onOk);
            elements.uiPromptCancel.removeEventListener('click', onCancel);
            elements.uiPromptClose.removeEventListener('click', onCancel);
            elements.uiPromptInput.removeEventListener('keydown', onKey);
            resolve(result);
        }

        function onOk(e) {
            e.preventDefault();
            e.stopPropagation();
            const v = elements.uiPromptInput.value.trim();
            cleanup(v === '' ? null : v);
        }
        function onCancel(e) {
            e.preventDefault();
            e.stopPropagation();
            cleanup(null);
        }
        function onBackdrop(e) {
            if (e.target === modal) cleanup(null);
        }
        function onKey(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                const v = elements.uiPromptInput.value.trim();
                cleanup(v === '' ? null : v);
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cleanup(null);
            }
        }

        elements.uiPromptOk.addEventListener('click', onOk);
        elements.uiPromptCancel.addEventListener('click', onCancel);
        elements.uiPromptClose.addEventListener('click', onCancel);
        elements.uiPromptInput.addEventListener('keydown', onKey);
        modal.addEventListener('click', onBackdrop);
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        setTimeout(() => {
            elements.uiPromptInput.focus();
            elements.uiPromptInput.select();
        }, 0);
    });
}

function showMessageDialog(opts) {
    const { title, message } = opts;
    const modal = elements.uiMessageModal;
    return new Promise((resolve) => {
        if (!modal) {
            resolve();
            return;
        }
        elements.uiMessageTitle.textContent = title;
        elements.uiMessageBody.textContent = message;

        function cleanup() {
            modal.classList.remove('active');
            modal.setAttribute('aria-hidden', 'true');
            modal.removeEventListener('click', onBackdrop);
            elements.uiMessageOk.removeEventListener('click', onOk);
            elements.uiMessageClose.removeEventListener('click', onOk);
            resolve();
        }

        function onOk(e) {
            e.preventDefault();
            e.stopPropagation();
            cleanup();
        }
        function onBackdrop(e) {
            if (e.target === modal) cleanup();
        }

        elements.uiMessageOk.addEventListener('click', onOk);
        elements.uiMessageClose.addEventListener('click', onOk);
        modal.addEventListener('click', onBackdrop);
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
    });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init() {
    console.log('Initializing TextPresets...');

    // Load saved state first so it's available for populate functions
    loadState();

    // Load quick animator presets
    loadPresets();

    // Update comp info
    updateCompInfo();

    // Setup event listeners
    setupEventListeners();

    // Load AE presets
    loadAEPresets();

    // Load custom presets
    loadCustomPresets();

    setStatus('Listo', 'success');

    // Welcome message in debug log
    setTimeout(() => {
        debugLog('🎬 TextPresets iniciado correctamente', 'success');
        debugLog('Click en el botón 🐛 para mostrar/ocultar este panel', 'info');
    }, 100);
}

// ============================================================================
// DEBUG LOGGING (Visible in UI)
// ============================================================================

function debugLog(message, type = 'info') {
    const debugLogEl = document.getElementById('debugLog');
    const debugContent = document.getElementById('debugLogContent');

    if (!debugLogEl || !debugContent) return;

    // Show debug log
    // debugLogEl.style.display = 'block';

    // Create log entry
    const entry = document.createElement('div');
    entry.style.marginBottom = '2px';
    entry.style.fontSize = '10px';

    const timestamp = new Date().toLocaleTimeString();

    // Color based on type
    let color = '#0f0'; // green for info
    let icon = 'ℹ️';
    if (type === 'error') {
        color = '#f00';
        icon = '❌';
    } else if (type === 'success') {
        color = '#0f0';
        icon = '✅';
    } else if (type === 'warning') {
        color = '#ff0';
        icon = '⚠️';
    }

    entry.style.color = color;
    entry.innerHTML = `<span style="color: #888;">[${timestamp}]</span> ${icon} ${message}`;

    debugContent.appendChild(entry);

    // Auto-scroll to bottom
    debugContent.scrollTop = debugContent.scrollHeight;

    // Keep only last 50 entries
    while (debugContent.children.length > 50) {
        debugContent.removeChild(debugContent.firstChild);
    }

    // Also log to console
    console.log(`[${timestamp}] ${message}`);
}

function clearDebugLog() {
    const debugContent = document.getElementById('debugLogContent');
    if (debugContent) {
        debugContent.innerHTML = '';
    }
}


function loadPresets() {
    evalScript('$.global.getPresets()', function (result) {
        if (!result || result === 'undefined' || result.indexOf('Error') > -1) {
            console.error('Invalid JSX result:', result);
            setStatus('Error de conexión con After Effects', 'error');
            return;
        }

        try {
            const data = JSON.parse(result);
            if (data.error) {
                console.error('Error loading presets:', data.error);
                setStatus('Error cargando presets', 'error');
                return;
            }
            state.currentPresets = data;
            populateEffectGrid();
        } catch (e) {
            console.error('Error parsing presets:', e, 'Raw result:', result);
            setStatus('Error de datos: ' + e.message, 'error');
        }
    });
}

function loadAEPresets() {
    const presetsRoot = getPresetsRootPath();
    console.log('Loading .ffx presets from:', presetsRoot);

    // Try Node.js first (much more stable)
    if (fs) {
        try {
            const result = scanFfxPresetsFromDisk();
            state.aePresets = result;
            console.log('AE Presets loaded via Node.js:', result);
            if (migrateLegacyFavoriteKeys()) saveState();
            populateMisPresetsGrid();
            updateCategoryCounts();
            if (state.currentPresetTab === 'ae') renderPresetGrid();

            const n = result.animateIn.length;
            if (n > 0) setStatus(`✓ ${n} preset(s) .ffx en Mis presets`, 'success');
            return; // Success, skip JSX fallback
        } catch (err) {
            console.error('Node.js scan failed, falling back to JSX:', err);
        }
    }

    // Fallback to JSX (escanea Animate In, Animate Out y animate)
    evalScript(`$.global.scanAEPresets(${JSON.stringify(presetsRoot)})`, function (result) {
        if (!result || result === 'undefined' || result.indexOf('Error') > -1) {
            console.error('Invalid AE Presets result:', result);
            return;
        }
        try {
            const data = JSON.parse(result);
            if (data.error) {
                setStatus('Presets de AE no disponibles', 'error');
                return;
            }
            state.aePresets = data;
            normalizeAEPresetsList(data.animateIn);
            if (migrateLegacyFavoriteKeys()) saveState();
            populateMisPresetsGrid();
            updateCategoryCounts();
            if (state.currentPresetTab === 'ae') renderPresetGrid();
            const n = (data.animateIn || []).length;
            if (n > 0) setStatus(`✓ ${n} preset(s) .ffx en Mis presets`, 'success');
        } catch (e) {
            console.error('Could not load AE presets:', e, 'Raw result:', result);
        }
    });
}

function loadCustomPresets() {
    evalScript('$.global.loadCustomPresets()', function (result) {
        try {
            const data = JSON.parse(result);
            if (!data.error) {
                state.customPresets = data;
                updateCategoryCounts();
                if (state.currentPresetTab === 'custom') {
                    renderPresetGrid();
                }
            }
        } catch (e) {
            console.log('Could not load custom presets:', e);
        }
    });
}

// ============================================================================
// QUICK ANIMATOR FUNCTIONS
// ============================================================================

/**
 * Cuadrícula "Mis presets": SOLO presets .ffx (sin Fade/Slide/Tiktok/Shrink integrados).
 * La selección es única; luego ENTRADA/SALIDA/AMBOS decide cómo aplicarlo.
 */
function populateMisPresetsGrid() {
    const showOnlyFavorites = state.showOnlyFavorites || false;
    const grid = document.getElementById('grid-mis-presets');
    if (!grid) return;

    grid.innerHTML = '';

    const aeIn = (state.aePresets && state.aePresets.animateIn) || [];

    let ffxList = aeIn.filter(p => p.isAEPreset);
    if (showOnlyFavorites) {
        ffxList = ffxList.filter(p => isPresetFavorite(p));
    }

    ffxList.forEach(preset => {
        grid.appendChild(createAEPresetButton(preset));
    });

    if (grid.children.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 20px; color: #666; font-size: 11px;">No hay presets para mostrar.<br>Importa .ffx o quita el filtro de favoritos.</div>';
    }
}

function populateEffectGrid() {
    populateMisPresetsGrid();
}

function populateFlatFavorites() {
    const flatGrid = document.getElementById('favoritesFlatGrid');
    if (!flatGrid) return;

    flatGrid.innerHTML = '';

    const allFavorites = [];

    // Favoritos .ffx (selección única)
    (state.aePresets.animateIn || []).forEach(preset => {
        if (!preset.isAEPreset || !isPresetFavorite(preset)) return;
        allFavorites.push({ preset });
    });

    // Show message if no favorites
    if (allFavorites.length === 0) {
        flatGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">No hay favoritos<br>Haz click en ☆ para agregar</div>';
        return;
    }

    // Create buttons for all favorites
    allFavorites.forEach(({ preset }) => {
        flatGrid.appendChild(createAEPresetButton(preset));
    });
}

function createAEPresetButton(preset) {
    const btn = document.createElement('div');
    btn.className = 'effect-btn';
    btn.dataset.presetPath = preset.path;
    btn.dataset.presetName = preset.name;
    btn.dataset.presetId = preset.id;
    const applyType = inferPresetApplyType(preset);
    btn.dataset.effectType = applyType;
    btn.dataset.isAEPreset = 'true';

    const nameDiv = document.createElement('div');
    nameDiv.className = 'effect-name';
    const typeHint = applyType === 'exit' ? ' · salida' : applyType === 'both' ? ' · ambos' : '';
    nameDiv.textContent = `🎬 ${preset.name}${typeHint}`;

    const starBtn = document.createElement('button');
    starBtn.className = 'favorite-star';
    setFavoriteStarIcon(starBtn, isPresetFavorite(preset));
    starBtn.title = isPresetFavorite(preset) ? 'Quitar de favoritos' : 'Agregar a favoritos';
    starBtn.setAttribute('aria-label', starBtn.title);
    attachFavoriteStarHandler(starBtn, preset);

    btn.appendChild(nameDiv);
    btn.appendChild(starBtn);

    // Click handler para seleccionar (ignorar clic en la estrella)
    btn.addEventListener('click', (e) => {
        if (e.target.closest('.favorite-star')) return;
        handleAEPresetClick(btn, preset);
    });

    return btn;
}

function handleAEPresetClick(btn, preset) {
    // Toggle: si ya está seleccionado, deseleccionar
    const alreadySelected =
        state.selectedEffects &&
        state.selectedEffects.entrance &&
        typeof state.selectedEffects.entrance === 'object' &&
        state.selectedEffects.entrance.isAEPreset &&
        state.selectedEffects.entrance.path === preset.path;

    // Deselect all buttons (una sola selección global)
    document.querySelectorAll('.effect-btn').forEach(b => {
        b.classList.remove('selected', 'selected-entrance', 'selected-exit');
    });

    if (alreadySelected) {
        state.selectedApplyPreset = null;
        state.selectedEffects.entrance = null;
        state.selectedEffects.exit = null;
        state.lastClickedAEPreset = null;
        saveState();
        return;
    }

    btn.classList.add('selected');

    const applyType = inferPresetApplyType(preset);
    const presetObj = {
        isAEPreset: true,
        path: preset.path,
        name: preset.name,
        type: applyType,
        applyType: applyType
    };

    state.selectedApplyPreset = presetObj;
    state.selectedEffects.entrance = presetObj;
    state.selectedEffects.exit = null;
    state.lastClickedAEPreset = presetObj;

    saveState();
}

function createEffectButton(preset, isExit) {
    const btn = document.createElement('div');
    btn.className = 'effect-btn';
    btn.dataset.effectKey = preset.key;
    btn.dataset.effectType = isExit ? 'exit' : 'entrance';

    // Nombre del efecto
    const nameDiv = document.createElement('div');
    nameDiv.className = 'effect-name';
    const icon = ICON_MAP[preset.key] || '🎬';
    nameDiv.textContent = `${icon} ${preset.name}`;

    // ⭐ BOTÓN DE FAVORITO
    const starBtn = document.createElement('button');
    starBtn.className = 'favorite-star';
    setFavoriteStarIcon(starBtn, state.favoriteEffects.has(preset.key));
    starBtn.title = state.favoriteEffects.has(preset.key) ? 'Quitar de favoritos' : 'Agregar a favoritos';
    starBtn.type = 'button';
    starBtn.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });
    starBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleEffectFavorite(preset.key, starBtn);
    });

    btn.appendChild(nameDiv);
    btn.appendChild(starBtn);

    btn.addEventListener('click', (e) => {
        if (e.target.closest('.favorite-star')) return;
        handleEffectClick(btn, preset.key, isExit);
        updatePreview(preset.key, preset.name, isExit);
    });

    return btn;
}

function handleEffectHover(btn, effectKey, previewText) {
    const animClass = animationMap[effectKey];
    if (animClass) {
        previewText.classList.add('animate-' + animClass);
    }
}

function handleEffectLeave(previewText, effectKey) {
    const animClass = animationMap[effectKey];
    if (animClass) {
        previewText.classList.remove('animate-' + animClass);
    }
}

function updatePreview(effectKey, effectName, isExit) {
    const previewText = document.getElementById('previewText');
    const previewName = document.getElementById('previewName');
    const previewDisplay = document.querySelector('.preview-display');

    if (!previewText || !previewName) return;

    // Store current effect for replay
    previewDisplay.dataset.currentEffect = effectKey;
    previewDisplay.dataset.currentName = effectName;

    // Remove all animation classes
    previewText.className = 'preview-text';

    // Update name
    previewName.textContent = effectName;

    // Add animation class
    const animClass = animationMap[effectKey];
    if (animClass) {
        // Small delay to restart animation
        setTimeout(() => {
            previewText.classList.add('animate-' + animClass);
        }, 50);
    }
}

// Add click handler to preview display (only once)
if (!window.previewClickHandlerAdded) {
    const previewDisplay = document.querySelector('.preview-display');
    if (previewDisplay) {
        previewDisplay.addEventListener('click', () => {
            const effectKey = previewDisplay.dataset.currentEffect;
            const effectName = previewDisplay.dataset.currentName;
            if (effectKey) {
                updatePreview(effectKey, effectName, false);
            }
        });
        window.previewClickHandlerAdded = true;
    }
}



function handleEffectClick(btn, effectKey, isExit) {
    const effectType = isExit ? 'exit' : 'entrance';

    if (state.selectedEffects[effectType] === effectKey) {
        state.selectedEffects[effectType] = null;
        btn.classList.remove('selected', 'selected-entrance', 'selected-exit');
    } else {
        const previousBtn = document.querySelector(`.effect-btn.selected-${effectType}`);
        if (previousBtn) {
            previousBtn.classList.remove('selected', 'selected-entrance', 'selected-exit');
        }

        state.selectedEffects[effectType] = effectKey;
        btn.classList.add('selected', `selected-${effectType}`);
    }

    saveState();
}

function applyPresetByType(preset, batchMode, callback) {
    preset = resolvePresetForApply(preset);
    const applyType = inferPresetApplyType(preset);
    const typeLabel = applyType === 'exit' ? 'salida' : applyType === 'both' ? 'entrada y salida' : 'entrada';

    setStatus(`Aplicando preset (${typeLabel})...`, 'loading');

    if (preset.path && (preset.isAEPreset || String(preset.path).toLowerCase().endsWith('.ffx'))) {
        let entranceAEPreset = null;
        let exitAEPreset = null;

        if (applyType === 'both') {
            entranceAEPreset = preset;
            exitAEPreset = preset;
        } else if (applyType === 'exit') {
            exitAEPreset = preset;
        } else {
            entranceAEPreset = preset;
        }

        applyAEPresetsSequentially(entranceAEPreset, exitAEPreset, batchMode, callback);
        return;
    }

    let entranceKey = 'null';
    let exitKey = 'null';
    if (applyType === 'entrance' || applyType === 'both') {
        entranceKey = preset.baseEntrance || 'null';
    }
    if (applyType === 'exit' || applyType === 'both') {
        exitKey = preset.baseExit || 'null';
    }

    const entSpeed = elements.entranceSpeed ? elements.entranceSpeed.value : 1;
    const exSpeed = elements.exitSpeed ? elements.exitSpeed.value : 1;
    const script = `$.global.applyAnimations(${JSON.stringify(entranceKey)}, ${JSON.stringify(exitKey)}, ${batchMode}, ${entSpeed}, ${exSpeed})`;

    evalScript(script, function (result) {
        try {
            const data = JSON.parse(result);
            if (data.error) {
                setStatus(`Error: ${data.error}`, 'error');
            } else if (data.success) {
                setStatus(`✓ ${data.layersAnimated} capas animadas`, 'success');
                updateCompInfo();
            }
        } catch (e) {
            setStatus(`Error: ${e.message}`, 'error');
        }
        if (callback) callback();
    });
}

function handleApply() {
    const preset = getSelectedApplyPreset();
    if (!preset) {
        setStatus('Selecciona un preset', 'error');
        return;
    }

    const batchMode = false;
    setApplyButtonsDisabled(true);

    applyPresetByType(preset, batchMode, () => {
        setApplyButtonsDisabled(false);
    });
}

function resolvePresetForApply(preset) {
    if (!preset || !preset.path) return preset;

    const normalizedPath = toExtendScriptPath(preset.path);
    const match = (state.aePresets.animateIn || []).find(
        (p) => p.path && toExtendScriptPath(p.path).toLowerCase() === normalizedPath.toLowerCase()
    );

    if (match) {
        return { ...preset, path: toExtendScriptPath(match.path), type: match.type, applyType: match.applyType };
    }

    return { ...preset, path: normalizedPath };
}

function applyAEPresetsSequentially(entrancePreset, exitPreset, batchMode, callback) {
    let totalLayers = 0;
    if (entrancePreset) entrancePreset = resolvePresetForApply(entrancePreset);
    if (exitPreset) exitPreset = resolvePresetForApply(exitPreset);

    // Apply entrance first, then exit (sequential, not parallel)
    if (entrancePreset && exitPreset) {
        // Both presets: apply entrance first
        const script1 = `$.global.applyFFXPreset(${JSON.stringify(entrancePreset.path)}, ${batchMode}, "entrance")`;

        console.log('Applying entrance preset:', entrancePreset.name);

        evalScript(script1, function (result1) {
            console.log('Entrance result:', result1);
            try {
                const data1 = JSON.parse(result1);
                if (data1.success) {
                    totalLayers = data1.layersAnimated;

                    // Now apply exit preset
                    const script2 = `$.global.applyFFXPreset(${JSON.stringify(exitPreset.path)}, ${batchMode}, "exit")`;

                    console.log('Applying exit preset:', exitPreset.name);

                    evalScript(script2, function (result2) {
                        console.log('Exit result:', result2);
                        try {
                            const data2 = JSON.parse(result2);
                            if (data2.success) {
                                setStatus(`✓ ${totalLayers} capas animadas (entrada + salida)`, 'success');
                                updateCompInfo();
                            } else if (data2.error) {
                                setStatus('Error aplicando salida: ' + data2.error, 'error');
                            }
                        } catch (e) {
                            console.error('Error parsing exit result:', e);
                            setStatus('Error aplicando salida', 'error');
                        }
                        if (callback) callback();
                    });
                } else if (data1.error) {
                    setStatus('Error aplicando entrada: ' + data1.error, 'error');
                    if (callback) callback();
                }
            } catch (e) {
                console.error('Error parsing entrance result:', e);
                setStatus('Error aplicando entrada', 'error');
                if (callback) callback();
            }
        });
    } else if (entrancePreset) {
        // Only entrance
        const script = `$.global.applyFFXPreset(${JSON.stringify(entrancePreset.path)}, ${batchMode}, "entrance")`;

        console.log('Applying entrance preset:', entrancePreset.name);

        evalScript(script, function (result) {
            console.log('Entrance result:', result);
            try {
                const data = JSON.parse(result);
                if (data.success) {
                    totalLayers = data.layersAnimated;
                    setStatus(`✓ ${totalLayers} capas animadas (entrada)`, 'success');
                    updateCompInfo();
                } else if (data.error) {
                    setStatus('Error: ' + data.error, 'error');
                }
            } catch (e) {
                console.error('Error:', e);
                setStatus('Error aplicando preset', 'error');
            }
            if (callback) callback();
        });
    } else if (exitPreset) {
        // Only exit
        const script = `$.global.applyFFXPreset(${JSON.stringify(exitPreset.path)}, ${batchMode}, "exit")`;

        console.log('Applying exit preset:', exitPreset.name);

        evalScript(script, function (result) {
            console.log('Exit result:', result);
            try {
                const data = JSON.parse(result);
                if (data.success) {
                    totalLayers = data.layersAnimated;
                    setStatus(`✓ ${totalLayers} capas animadas (salida)`, 'success');
                    updateCompInfo();
                } else if (data.error) {
                    setStatus('Error: ' + data.error, 'error');
                }
            } catch (e) {
                console.error('Error:', e);
                setStatus('Error aplicando preset', 'error');
            }
            if (callback) callback();
        });
    }
}

// ============================================================================
// PRESET MANAGER FUNCTIONS
// ============================================================================

function renderPresetGrid() {
    const grid = document.getElementById('presetGrid');
    if (!grid) return;

    grid.innerHTML = '';

    let presets = [];

    // Get presets based on current tab and category
    if (state.currentPresetTab === 'custom') {
        if (state.currentCategory === 'favorites') {
            const pathSeen = new Set();
            const favAE = [];
            (state.aePresets.animateIn || []).forEach(p => {
                if (!p.path || !isPresetFavorite(p)) return;
                if (pathSeen.has(p.path)) return;
                pathSeen.add(p.path);
                favAE.push(p);
            });
            // Solo favoritos .ffx (Mis presets)
            presets = [...favAE];
        } else {
            presets = state.customPresets;
        }
    } else if (state.currentPresetTab === 'ae') {
        if (state.currentCategory === 'animate-in') {
            presets = state.aePresets.animateIn || [];
        } else if (state.currentCategory === 'animate-out') {
            presets = state.aePresets.animateOut || [];
        }
    }

    // Apply search filter
    if (state.searchQuery) {
        const query = state.searchQuery.toLowerCase();
        presets = presets.filter(p => p.name.toLowerCase().includes(query));
    }

    if (presets.length === 0) {
        const message = state.currentCategory === 'favorites'
            ? 'No hay presets favoritos<br>Haz click en ☆ para agregar'
            : 'No hay presets disponibles';
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #666;">${message}</div>`;
        return;
    }

    presets.forEach(preset => {
        const card = createPresetCard(preset);
        grid.appendChild(card);
    });
}

function createPresetCard(preset) {
    const card = document.createElement('div');
    card.className = 'preset-card';
    if (state.selectedPreset && state.selectedPreset.id === preset.id) {
        card.classList.add('selected');
    }

    const thumbnail = document.createElement('div');
    thumbnail.className = 'preset-thumbnail';

    const thumbnailText = document.createElement('div');
    thumbnailText.className = 'preset-thumbnail-text';
    thumbnailText.textContent = 'ABC';

    // Add animation class if it's a quick effect or has baseEntrance
    let animClass = null;
    if (preset.isQuickEffect && preset.key) {
        animClass = animationMap[preset.key];
    } else if (preset.baseEntrance && animationMap[preset.baseEntrance]) {
        animClass = animationMap[preset.baseEntrance];
    } else if (preset.name) {
        // For AE presets, use keyword mapping
        animClass = getAnimationForPreset(preset.name);
    }

    if (animClass) {
        thumbnailText.dataset.animation = animClass;
    }

    thumbnail.appendChild(thumbnailText);

    // Add hover animation
    card.addEventListener('mouseenter', () => {
        if (animClass) {
            thumbnailText.classList.add('animate-' + animClass);
        }
    });

    card.addEventListener('mouseleave', () => {
        if (animClass) {
            thumbnailText.classList.remove('animate-' + animClass);
        }
    });

    const info = document.createElement('div');
    info.className = 'preset-info';

    const name = document.createElement('div');
    name.className = 'preset-name';
    name.textContent = preset.name;

    const meta = document.createElement('div');
    meta.className = 'preset-meta';

    const badge = document.createElement('span');
    badge.className = `preset-badge ${preset.type || 'both'}`;
    badge.textContent = preset.type === 'entrance' ? 'Entrada' : preset.type === 'exit' ? 'Salida' : 'Ambos';

    const actionsBtn = document.createElement('button');
    actionsBtn.className = 'preset-actions-btn';
    actionsBtn.textContent = '⋮';
    actionsBtn.onclick = (e) => {
        e.stopPropagation();
        showPresetContextMenu(preset, e);
    };

    meta.appendChild(badge);
    if (preset.isCustom !== false) {
        meta.appendChild(actionsBtn);
    }

    info.appendChild(name);
    info.appendChild(meta);

    card.appendChild(thumbnail);
    card.appendChild(info);

    card.onclick = () => selectPreset(preset);

    return card;
}

function selectPreset(preset) {
    state.selectedPreset = preset;
    if (preset && (preset.path || preset.isAEPreset)) {
        const applyType = inferPresetApplyType(preset);
        state.selectedApplyPreset = {
            isAEPreset: !!preset.isAEPreset || !!preset.path,
            path: preset.path,
            name: preset.name,
            type: applyType,
            applyType: applyType
        };
    }
    renderPresetGrid();
}

function openPresetCreator() {
    state.editingPreset = null;
    elements.modalTitle.textContent = 'Crear Nuevo Preset';
    elements.presetName.value = '';
    elements.presetType.value = 'entrance';
    elements.baseEntranceAnim.value = 'fade_in';
    elements.baseExitAnim.value = 'fade_out';
    elements.modalEntranceSpeed.value = '1.0';
    elements.modalExitSpeed.value = '1.0';
    elements.modalEntranceSpeedValue.textContent = '1.0x';
    elements.modalExitSpeedValue.textContent = '1.0x';
    elements.presetFavorite.checked = false;

    elements.presetModal.classList.add('active');
}

function editPreset(preset) {
    state.editingPreset = preset;
    elements.modalTitle.textContent = 'Editar Preset';
    elements.presetName.value = preset.name;
    elements.presetType.value = preset.type || 'both';
    elements.baseEntranceAnim.value = preset.baseEntrance || 'fade_in';
    elements.baseExitAnim.value = preset.baseExit || 'fade_out';
    elements.modalEntranceSpeed.value = preset.entranceSpeed || '1.0';
    elements.modalExitSpeed.value = preset.exitSpeed || '1.0';
    elements.modalEntranceSpeedValue.textContent = (preset.entranceSpeed || '1.0') + 'x';
    elements.modalExitSpeedValue.textContent = (preset.exitSpeed || '1.0') + 'x';
    elements.presetFavorite.checked = preset.favorite || false;

    elements.presetModal.classList.add('active');
}

function savePreset() {
    const presetData = {
        id: state.editingPreset ? state.editingPreset.id : 'custom_' + Date.now(),
        name: elements.presetName.value || 'Nuevo Preset',
        type: elements.presetType.value,
        baseEntrance: elements.baseEntranceAnim.value,
        baseExit: elements.baseExitAnim.value,
        entranceSpeed: parseFloat(elements.modalEntranceSpeed.value),
        exitSpeed: parseFloat(elements.modalExitSpeed.value),
        favorite: elements.presetFavorite.checked,
        isCustom: true,
        created: state.editingPreset ? state.editingPreset.created : new Date().toISOString()
    };

    const script = `$.global.saveCustomPreset(${JSON.stringify(JSON.stringify(presetData))})`;

    evalScript(script, function (result) {
        try {
            const data = JSON.parse(result);
            if (data.success) {
                setStatus('✓ Preset guardado', 'success');
                loadCustomPresets();
                closeModal();
            } else {
                setStatus('Error guardando preset', 'error');
            }
        } catch (e) {
            setStatus('Error: ' + e.message, 'error');
        }
    });
}

function duplicatePreset(preset) {
    const newPreset = {
        ...preset,
        id: 'custom_' + Date.now(),
        name: preset.name + ' (Copia)',
        created: new Date().toISOString()
    };

    const script = `$.global.saveCustomPreset(${JSON.stringify(JSON.stringify(newPreset))})`;

    evalScript(script, function (result) {
        try {
            const data = JSON.parse(result);
            if (data.success) {
                setStatus('✓ Preset duplicado', 'success');
                loadCustomPresets();
            }
        } catch (e) {
            setStatus('Error: ' + e.message, 'error');
        }
    });
}

function deletePreset(preset) {
    showConfirmDialog({
        title: 'Eliminar preset',
        message: `¿Eliminar el preset "${preset.name}"?`,
        confirmLabel: 'Eliminar',
        cancelLabel: 'Cancelar',
        danger: true
    }).then((ok) => {
        if (!ok) return;

        const script = `$.global.deleteCustomPreset("${preset.id}")`;

        evalScript(script, function (result) {
            try {
                const data = JSON.parse(result);
                if (data.success) {
                    setStatus('✓ Preset eliminado', 'success');
                    state.selectedPreset = null;
                    loadCustomPresets();
                }
            } catch (e) {
                setStatus('Error: ' + e.message, 'error');
            }
        });
    });
}

function applySelectedPreset() {
    const preset = state.selectedPreset || getSelectedApplyPreset();
    if (!preset) {
        setStatus('Selecciona un preset primero', 'error');
        return;
    }

    const batchMode = false;
    setApplyButtonsDisabled(true);
    applyPresetByType(preset, batchMode, () => setApplyButtonsDisabled(false));
}

function closeModal() {
    elements.presetModal.classList.remove('active');
}

function updateCategoryCounts() {
    // Update custom presets count
    const customCount = document.getElementById('count-custom');
    if (customCount) {
        customCount.textContent = state.customPresets.length;
    }

    // Update favorites count (.ffx only en "Mis presets")
    const favoritesCount = document.getElementById('count-favorites');
    if (favoritesCount) {
        const total = state.favoritePresets.size;
        favoritesCount.textContent = total;
    }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

function setupEventListeners() {
    // IMPORTAR PRESET .FFX - Configuración corregida
    const importPresetBtn = document.getElementById('importPresetBtn');
    const presetImportInput = document.getElementById('presetImportInput');

    if (importPresetBtn && presetImportInput) {
        importPresetBtn.addEventListener('click', function () {
            debugLog('📂 Botón de importar clickeado - Abriendo explorador...', 'info');
            presetImportInput.click();
        });
        presetImportInput.addEventListener('change', handlePresetFilesSelected);
        debugLog('✅ Botón de importar preset configurado correctamente', 'success');
    } else {
        debugLog('❌ ERROR: No se encontró importPresetBtn o presetImportInput', 'error');
    }

    // Tab navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            e.target.classList.add('active');
            const tabId = e.target.dataset.tab;
            document.getElementById(`tab-${tabId}`).classList.add('active');
            state.currentTab = tabId;
        });
    });

    // Preset sub-tabs
    document.querySelectorAll('.preset-tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.preset-tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            state.currentPresetTab = e.target.dataset.presetTab;
            state.currentCategory = state.currentPresetTab === 'custom' ? 'custom' : 'animate-in';

            // Update active category
            document.querySelectorAll('.preset-category').forEach(c => c.classList.remove('active'));
            const activeCategory = document.querySelector(`[data-category="${state.currentCategory}"]`);
            if (activeCategory) activeCategory.classList.add('active');

            renderPresetGrid();
        });
    });

    // Category selection
    document.querySelectorAll('.preset-category').forEach(cat => {
        cat.addEventListener('click', (e) => {
            document.querySelectorAll('.preset-category').forEach(c => c.classList.remove('active'));
            cat.classList.add('active');

            state.currentCategory = cat.dataset.category;
            renderPresetGrid();
        });
    });

    // Search
    if (elements.presetSearch) {
        elements.presetSearch.addEventListener('input', (e) => {
            state.searchQuery = e.target.value;
            renderPresetGrid();
        });
    }

    // Favorites toggle button
    const favoritesToggleBtn = document.getElementById('favoritesToggleBtn');
    if (favoritesToggleBtn) {
        favoritesToggleBtn.addEventListener('click', () => {
            state.showOnlyFavorites = !state.showOnlyFavorites;
            favoritesToggleBtn.classList.toggle('active');

            // Update star icon
            // Update star icon state handled by CSS toggle of 'active' class

            // Toggle between flat favorites and categorized view
            const flatContainer = document.getElementById('favoritesFlatContainer');
            const categorizedContainer = document.getElementById('categorizedEffects');

            if (state.showOnlyFavorites) {
                // Show flat favorites list
                flatContainer.style.display = 'block';
                categorizedContainer.style.display = 'none';
                populateFlatFavorites();
            } else {
                // Show categorized view
                flatContainer.style.display = 'none';
                categorizedContainer.style.display = 'block';
                populateEffectGrid();
            }
        });
    }

    // Debug toggle button
    const debugToggleBtn = document.getElementById('debugToggleBtn');
    if (debugToggleBtn) {
        debugToggleBtn.addEventListener('click', () => {
            const debugLog = document.getElementById('debugLog');
            if (debugLog) {
                if (debugLog.style.display === 'none') {
                    debugLog.style.display = 'block';
                    debugToggleBtn.classList.add('active');
                    debugLog.scrollTop = debugLog.scrollHeight;
                } else {
                    debugLog.style.display = 'none';
                    debugToggleBtn.classList.remove('active');
                }
            }
        });
    }

    // Category headers (accordion)
    document.querySelectorAll('.category-header').forEach(header => {
        header.addEventListener('click', toggleCategory);
    });

    if (elements.applyBtn) {
        elements.applyBtn.addEventListener('click', handleApply);
    }

    const applyPresetManagerBtn = document.getElementById('applyPresetManagerBtn');
    if (applyPresetManagerBtn) {
        applyPresetManagerBtn.addEventListener('click', applySelectedPreset);
    }
    if (elements.saveSelectionBtn) {
        elements.saveSelectionBtn.addEventListener('click', handleSaveSelection);
    }

    if (elements.deleteSelectedPresetBtn) {
        elements.deleteSelectedPresetBtn.addEventListener('click', handleDeleteSelectedPreset);
    }
    if (elements.renamePresetBtn) {
        elements.renamePresetBtn.addEventListener('click', handleRenamePreset);
    }

    elements.resetBtn.addEventListener('click', handleReset);
    elements.keysInOutBtn.addEventListener('click', handleKeysInOut);
    const textExploderBtn = document.getElementById('textExploderBtn');
    if (textExploderBtn) {
        textExploderBtn.addEventListener('click', handleTextExploder);
    }
    initTextToolsModal();
    elements.refreshBtn.addEventListener('click', handleRefresh);
    elements.importSRTBtn.addEventListener('click', handleImportSRT);
    elements.srtFileInput.addEventListener('change', handleSRTFileSelected);

    // Speed sliders (optional - only if they exist)
    if (elements.entranceSpeed) {
        elements.entranceSpeed.addEventListener('input', function () {
            if (elements.entranceSpeedValue) {
                elements.entranceSpeedValue.textContent = this.value + 'x';
            }
            saveState();
        });
    }

    if (elements.exitSpeed) {
        elements.exitSpeed.addEventListener('input', function () {
            if (elements.exitSpeedValue) {
                elements.exitSpeedValue.textContent = this.value + 'x';
            }
            saveState();
        });
    }

    // batchModeCheckbox removed - no event listener needed

    // Preset Manager buttons
    elements.createPresetBtn.addEventListener('click', openPresetCreator);
    elements.applyPresetBtn.addEventListener('click', applySelectedPreset);
    elements.importPresetsBtn.addEventListener('click', handleImportPresets);
    elements.exportPresetsBtn.addEventListener('click', handleExportPresets);
    // elements.presetImportInput.addEventListener('change', handlePresetFilesSelected); // Comentado - ahora se configura al inicio de setupEventListeners()

    // Modal
    elements.modalClose.addEventListener('click', closeModal);
    elements.cancelPresetBtn.addEventListener('click', closeModal);
    elements.savePresetBtn.addEventListener('click', savePreset);

    // Modal speed sliders
    elements.modalEntranceSpeed.addEventListener('input', function () {
        elements.modalEntranceSpeedValue.textContent = this.value + 'x';
    });

    elements.modalExitSpeed.addEventListener('input', function () {
        elements.modalExitSpeedValue.textContent = this.value + 'x';
    });

    // Close modal on background click
    elements.presetModal.addEventListener('click', (e) => {
        if (e.target === elements.presetModal) {
            closeModal();
        }
    });

    if (elements.presetContextMenu) {
        elements.presetContextMenu.querySelectorAll('[data-ctx-action]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const action = btn.getAttribute('data-ctx-action');
                const preset = _contextMenuPreset;
                closePresetContextMenu();
                if (!preset) return;
                if (action === 'edit') editPreset(preset);
                else if (action === 'duplicate') duplicatePreset(preset);
                else if (action === 'delete') deletePreset(preset);
            });
        });
    }
}

function toggleEffectFavorite(effectKey, buttonElement) {
    if (state.favoriteEffects.has(effectKey)) {
        state.favoriteEffects.delete(effectKey);
        setFavoriteStarIcon(buttonElement, false);
        buttonElement.title = 'Agregar a favoritos';
    } else {
        state.favoriteEffects.add(effectKey);
        setFavoriteStarIcon(buttonElement, true);
        buttonElement.title = 'Quitar de favoritos';
    }

    saveState();
    updateCategoryCounts();

    // Update preset grid if we're viewing favorites
    if (state.currentTab === 'presets' && state.currentCategory === 'favorites') {
        renderPresetGrid();
    }

    // Update flat favorites if showing
    if (state.showOnlyFavorites) {
        populateFlatFavorites();
    }
}

function toggleCategory(event) {
    const header = event.currentTarget;
    const categoryId = header.dataset.category;
    const content = document.getElementById(categoryId);

    header.classList.toggle('collapsed');
    content.classList.toggle('collapsed');

    saveCategoryState();
}

function handleReset() {
    const batchMode = false; // Apply only to selected text layers

    elements.resetBtn.disabled = true;
    setStatus('Reseteando animaciones...', 'loading');

    const script = `$.global.resetAnimations(${batchMode})`;

    evalScript(script, function (result) {
        elements.resetBtn.disabled = false;

        try {
            const data = JSON.parse(result);

            if (data.error) {
                setStatus(`Error: ${data.error}`, 'error');
                return;
            }

            if (data.success) {
                setStatus(`✓ ${data.layersReset} capas reseteadas`, 'success');
                updateCompInfo();
            }

        } catch (e) {
            setStatus(`Error: ${e.message}`, 'error');
        }
    });
}

function handleKeysInOut() {
    elements.keysInOutBtn.disabled = true;
    setStatus('Alineando keyframes...', 'loading');

    evalScript('$.global.alignKeysToInOut()', function (result) {
        elements.keysInOutBtn.disabled = false;
        try {
            const data = JSON.parse(result);
            if (data.error) {
                setStatus(`Error: ${data.error}`, 'error');
                return;
            }
            if (data.success) {
                setStatus(`✓ ${data.layersProcessed} capas alineadas`, 'success');
            }
        } catch (e) {
            setStatus(`Error: ${e.message}`, 'error');
        }
    });
}

function getTextToolsOptions() {
    const deleteEl = document.getElementById('textToolsDeleteOriginal');
    const rtlEl = document.getElementById('textToolsRtl');
    const orderEl = document.getElementById('textToolsLayerOrder');
    return {
        deleteOriginal: deleteEl ? deleteEl.checked : true,
        rtlText: rtlEl ? rtlEl.checked : false,
        layerOrder: orderEl ? orderEl.value : 'bottomToTop'
    };
}

function setTextToolsBusy(busy) {
    const modal = document.getElementById('textToolsModal');
    if (!modal) return;
    modal.querySelectorAll('.text-tools-btn').forEach((btn) => {
        btn.disabled = !!busy;
    });
    const txBtn = document.getElementById('textExploderBtn');
    if (txBtn) txBtn.disabled = !!busy;
}

function openTextToolsModal() {
    const modal = document.getElementById('textToolsModal');
    if (!modal) return;
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
}

function closeTextToolsModal() {
    const modal = document.getElementById('textToolsModal');
    if (!modal) return;
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
}

function handleTextToolsResult(result, successMsg) {
    setTextToolsBusy(false);
    if (!result || result === 'undefined') {
        setStatus(successMsg, 'success');
        closeTextToolsModal();
        return;
    }
    try {
        const data = JSON.parse(result);
        if (data.error) {
            setStatus(data.error, 'error');
            showMessageDialog({ title: 'Texto', message: data.error });
            return;
        }
        setStatus(successMsg, 'success');
        closeTextToolsModal();
    } catch (e) {
        setStatus(successMsg, 'success');
        closeTextToolsModal();
    }
}

function runTextExplode(splitMode) {
    const opts = getTextToolsOptions();
    setTextToolsBusy(true);
    setStatus('Separando texto...', 'loading');
    const optsJson = JSON.stringify(opts);
    evalScript(
        `$.global.textExploderSplit(${JSON.stringify(splitMode)}, ${JSON.stringify(optsJson)})`,
        (result) => handleTextToolsResult(result, 'Texto separado')
    );
}

function runMergeText() {
    setTextToolsBusy(true);
    setStatus('Uniendo capas...', 'loading');
    evalScript('$.global.mergeTextLayers()', (result) => handleTextToolsResult(result, 'Texto unido'));
}

function initTextToolsModal() {
    const modal = document.getElementById('textToolsModal');
    if (!modal) return;

    const closeBtn = document.getElementById('textToolsClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeTextToolsModal);
    }

    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeTextToolsModal();
    });

    modal.querySelectorAll('[data-text-split]').forEach((btn) => {
        btn.addEventListener('click', () => runTextExplode(btn.getAttribute('data-text-split')));
    });

    const mergeBtn = document.getElementById('textToolsMergeBtn');
    if (mergeBtn) {
        mergeBtn.addEventListener('click', runMergeText);
    }
}

function handleTextExploder() {
    openTextToolsModal();
    setStatus('Herramientas de texto', 'info');
}

function handleRefresh() {
    setStatus('Actualizando...', 'loading');
    loadPresets();
    loadAEPresets();
    loadCustomPresets();
    updateCompInfo();
    setTimeout(() => {
        setStatus('Actualizado', 'success');
    }, 500);
}

function handleImportSRT() {
    elements.srtFileInput.click();
}

function handleImportPresets() {
    elements.presetImportInput.click();
}

function handlePresetFilesSelected(event) {
    debugLog('🔥 handlePresetFilesSelected EJECUTADA', 'warning');

    const files = event.target.files;
    if (!files || files.length === 0) {
        debugLog('❌ No hay archivos seleccionados', 'error');
        return;
    }

    debugLog(`Archivos seleccionados: ${Array.from(files).map(f => f.name).join(', ')}`, 'info');
    setStatus('Importando presets...', 'loading');

    const importBtn = document.getElementById('importPresetBtn');
    if (importBtn) importBtn.disabled = true;

    const presetsPath = getAnimateFFXFolderPath();

    const validFiles = Array.from(files).filter(file => file.name.toLowerCase().endsWith('.ffx'));
    const totalFiles = files.length;
    let processedCount = 0;
    let importedCount = 0;
    let errorCount = 0;

    if (validFiles.length === 0) {
        setStatus(`Error: Solo se aceptan archivos .ffx`, 'error');
        if (importBtn) importBtn.disabled = false;
        return;
    }

    validFiles.forEach((file) => {
        const fileName = file.name;
        const reader = new FileReader();

        reader.onload = function (e) {
            const arrayBuffer = e.target.result;
            const buffer = Buffer.from(arrayBuffer);

            let success = false;

            // Try saving via Node.js first (more robust)
            if (fs) {
                try {
                    if (!fs.existsSync(presetsPath)) {
                        fs.mkdirSync(presetsPath, { recursive: true });
                    }
                    const filePath = path.join(presetsPath, fileName);
                    fs.writeFileSync(filePath, buffer);
                    success = true;
                    debugLog(`✓ Preset guardado con Node.js: ${fileName}`, 'info');
                } catch (fsErr) {
                    console.error('Node.js save failed:', fsErr);
                }
            }

            // Fallback to JSX if Node.js fails or is not available
            if (!success) {
                const base64Data = buffer.toString('base64');
                const script = `$.global.saveFFXFile(${JSON.stringify(presetsPath)}, ${JSON.stringify(fileName)}, ${JSON.stringify(base64Data)})`;

                evalScript(script, function (result) {
                    try {
                        if (!result || result === 'undefined') throw new Error('JSX no devolvió respuesta');
                        const data = JSON.parse(result);
                        if (data.success) {
                            importedCount++;
                            debugLog(`✓ Preset importado: ${fileName}`, 'success');
                        } else {
                            errorCount++;
                            debugLog(`✗ Error en JSX: ${fileName} - ${data.error}`, 'error');
                        }
                    } catch (err) {
                        errorCount++;
                        debugLog(`✗ Error crítico: ${fileName} - ${err.message}`, 'error');
                    }
                    finalize();
                });
            } else {
                importedCount++;
                debugLog(`✓ Preset importado: ${fileName}`, 'success');
                finalize();
            }
        };

        reader.onerror = function () {
            errorCount++;
            debugLog(`✗ Error leyendo archivo: ${file.name}`, 'error');
            finalize();
        };

        reader.readAsArrayBuffer(file);
    });

    function finalize() {
        processedCount++;
        if (processedCount === validFiles.length) {
            if (importedCount > 0) {
                setStatus(`✓ ${importedCount} preset(s) importado(s)`, 'success');
                setTimeout(() => loadAEPresets(), 500);
            } else {
                setStatus('Error al importar presets', 'error');
            }

            if (importBtn) importBtn.disabled = false;
            event.target.value = '';
            debugLog('=== Importación finalizada ===', 'info');
        }
    }
}

function handleSaveSelection() {
    debugLog('💾 Botón de guardar selección clickeado', 'info');

    showPromptDialog({
        title: 'Guardar como preset',
        label: 'Nombre del preset',
        defaultValue: 'Mi Preset',
        okLabel: 'Guardar',
        cancelLabel: 'Cancelar'
    }).then((presetName) => {
        if (!presetName) return;

        setStatus('Guardando preset...', 'loading');

        const presetsPath = getAnimateFFXFolderPath();

        debugLog(`Guardando preset "${presetName}" en: ${presetsPath}`, 'info');

        const script = `$.global.saveSelectionAsPreset(${JSON.stringify(presetsPath)}, ${JSON.stringify(presetName)})`;

        evalScript(script, function (result) {
            try {
                const data = JSON.parse(result);
                if (data.success) {
                    setStatus(`✓ Preset "${presetName}" guardado`, 'success');
                    debugLog(`✓ Preset guardado exitosamente: ${data.fileName}`, 'success');
                    loadAEPresets();
                } else {
                    setStatus(`Error: ${data.error}`, 'error');
                    debugLog(`✗ Error guardando preset: ${data.error}`, 'error');
                }
            } catch (e) {
                setStatus(`Error: ${e.message}`, 'error');
                debugLog(`✗ Error parseando resultado: ${e.message}`, 'error');
            }
        });
    });
}

function handleRenamePreset() {
    debugLog('📝 Botón de renombrar preset clickeado', 'info');

    // Use target from last clicked for single-item rename
    const targetPreset = state.lastClickedAEPreset;

    if (!targetPreset || !targetPreset.isAEPreset) {
        setStatus('Selecciona un preset de AE (.ffx) para renombrar', 'error');
        return;
    }

    const oldName = targetPreset.name;

    showPromptDialog({
        title: 'Renombrar preset',
        label: 'Nuevo nombre',
        defaultValue: oldName,
        okLabel: 'Renombrar',
        cancelLabel: 'Cancelar'
    }).then((newName) => {
        if (!newName || newName === oldName) {
            return;
        }

        setStatus('Renombrando preset...', 'loading');

        const script = `$.global.renameFFXFile(${JSON.stringify(targetPreset.path)}, ${JSON.stringify(newName)})`;

        evalScript(script, function (result) {
            try {
                const data = JSON.parse(result);
                if (data.success) {
                    const finalNewName = data.newName.replace('.ffx', '');
                    debugLog(`✓ Renombrado: ${oldName} -> ${finalNewName}`, 'success');

                    if (state.selectedEffects.entrance && state.selectedEffects.entrance.path === targetPreset.path) {
                        state.selectedEffects.entrance = null;
                    }
                    if (state.selectedEffects.exit && state.selectedEffects.exit.path === targetPreset.path) {
                        state.selectedEffects.exit = null;
                    }

                    state.lastClickedAEPreset = null;

                    setStatus(`✓ Preset renombrado a "${finalNewName}"`, 'success');
                    saveState();
                    loadAEPresets();
                } else {
                    setStatus(`Error: ${data.error}`, 'error');
                    debugLog(`✗ Error renombrando ${oldName}: ${data.error}`, 'error');
                }
            } catch (e) {
                setStatus('Error de sistema', 'error');
                debugLog(`✗ Error de sistema al renombrar ${oldName}`, 'error');
            }
        });
    });
}

function handleDeleteSelectedPreset() {
    debugLog('🗑️ Botón de borrar selección clickeado', 'info');

    // Use target from last clicked for single-item deletion
    const targetPreset = state.lastClickedAEPreset;

    if (!targetPreset || !targetPreset.isAEPreset) {
        setStatus('Selecciona un preset de AE (.ffx) para borrar', 'error');
        return;
    }

    showConfirmDialog({
        title: 'Borrar preset',
        message: `¿Borrar permanentemente «${targetPreset.name}»?\nEsta acción no se puede deshacer.`,
        confirmLabel: 'Borrar',
        cancelLabel: 'Cancelar',
        danger: true
    }).then((ok) => {
        if (!ok) return;

        setStatus('Borrando preset...', 'loading');

        const script = `$.global.deleteFFXFile(${JSON.stringify(targetPreset.path)})`;

        evalScript(script, function (result) {
            try {
                const data = JSON.parse(result);
                if (data.success) {
                    debugLog(`✓ Borrado físicamente: ${targetPreset.name}`, 'success');

                    if (state.selectedEffects.entrance && state.selectedEffects.entrance.path === targetPreset.path) {
                        state.selectedEffects.entrance = null;
                    }
                    if (state.selectedEffects.exit && state.selectedEffects.exit.path === targetPreset.path) {
                        state.selectedEffects.exit = null;
                    }
                    if (state.selectedApplyPreset && state.selectedApplyPreset.path === targetPreset.path) {
                        state.selectedApplyPreset = null;
                    }

                    state.lastClickedAEPreset = null;

                    setStatus('✓ Preset eliminado', 'success');
                    saveState();
                    loadAEPresets();
                } else {
                    setStatus(`Error: ${data.error}`, 'error');
                    debugLog(`✗ Error borrando ${targetPreset.name}: ${data.error}`, 'error');
                }
            } catch (e) {
                setStatus('Error de sistema', 'error');
                debugLog(`✗ Error de sistema al borrar ${targetPreset.name}`, 'error');
            }
        });
    });
}

// Handle .ffx preset import
function handlePresetImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Check if it's a .ffx file
    if (!file.name.match(/\.ffx$/i)) {
        setStatus('Error: Solo se pueden importar archivos .ffx', 'error');
        event.target.value = '';
        return;
    }

    setStatus('Importando preset...', 'loading');

    // Get the file path
    const filePath = file.path || file.webkitRelativePath || file.name;

    const animateFolderPath = getAnimateFFXFolderPath();

    const script = `$.global.importPresetFile(${JSON.stringify(filePath)}, ${JSON.stringify(animateFolderPath)})`;

    evalScript(script, function (result) {
        try {
            const data = JSON.parse(result);

            if (data.error) {
                setStatus(`Error: ${data.error}`, 'error');
            } else if (data.success) {
                setStatus(`✓ Preset "${data.name}" importado correctamente`, 'success');
                // Reload AE presets to show the new preset
                setTimeout(() => {
                    loadAEPresets();
                }, 500);
            }
        } catch (e) {
            setStatus(`Error: ${e.message}`, 'error');
        }

        // Clear input
        event.target.value = '';
    });
}

function handleSRTFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        const srtContent = e.target.result;
        importSRTContent(srtContent);
    };
    reader.readAsText(file);

    event.target.value = '';
}

function importSRTContent(srtContent) {
    try {
        setStatus('Preparando importación...', 'loading');
        if (elements.importSRTBtn) elements.importSRTBtn.disabled = true;

        // Ensure extensionPath is defined
        const extPath = typeof extensionPath !== 'undefined' ? extensionPath : csInterface.getSystemPath(SystemPath.EXTENSION);

        setStatus('Conectando con After Effects...', 'loading');
        const script = "$.global.importSRT(" + JSON.stringify(srtContent) + ", " + JSON.stringify(extPath) + ");";

        evalScript(script, function (result) {
            if (elements.importSRTBtn) elements.importSRTBtn.disabled = false;

            if (!result || result === "undefined") {
                setStatus('Error: AE no respondió', 'error');
                return;
            }

            try {
                const data = JSON.parse(result);

                if (data.error) {
                    setStatus('Error AE: ' + data.error, 'error');
                    return;
                }

                if (data.success) {
                    setStatus('✓ ' + data.layersCreated + ' capas creadas', 'success');
                    updateCompInfo();
                }

            } catch (e) {
                setStatus('Error de datos: ' + e.message, 'error');
            }
        });
    } catch (err) {
        setStatus('Excepción: ' + err.message, 'error');
        if (elements.importSRTBtn) elements.importSRTBtn.disabled = false;
    }
}

function updateCompInfo() {
    evalScript('$.global.getCompInfo()', function (result) {
        try {
            const data = JSON.parse(result);

            if (data.error) {
                elements.compName.textContent = 'No activa';
                elements.compResolution.textContent = '-';
                elements.textLayers.textContent = '-';
                return;
            }

            elements.compName.textContent = data.name;
            elements.compResolution.textContent = `${data.width}x${data.height}`;
            elements.textLayers.textContent = `${data.numTextLayers} (${data.numSelectedTextLayers} seleccionadas)`;

        } catch (e) {
            console.error('Error updating comp info:', e);
        }
    });
}

// ============================================================================
// UTILITIES
// ============================================================================

function evalScript(script, callback) {
    csInterface.evalScript(script, callback);
}

function setStatus(message, type = '') {
    // Use the status message at the top
    const statusElement = document.getElementById('statusMessage');
    if (!statusElement) return;

    statusElement.textContent = message;
}

function saveState() {
    try {
        const stateToSave = {
            selectedEffects: state.selectedEffects,
            selectedApplyPreset: state.selectedApplyPreset,
            currentTab: state.currentTab,
            favoritePresets: Array.from(state.favoritePresets),
            favoriteEffects: Array.from(state.favoriteEffects)
            // showOnlyFavorites is removed to start normal as default
        };

        const json = JSON.stringify(stateToSave);

        // Save to localStorage (legacy/backup)
        localStorage.setItem('subtitlesToolState', json);

        // Robust persistence using Node.js filesystem if available
        if (typeof window.require !== 'undefined') {
            try {
                const fs = window.require('fs');
                const path = window.require('path');
                // Use a standard location in user app data
                const userDataPath = csInterface.getSystemPath(SystemPath.USER_DATA);
                const stateFolder = path.join(userDataPath, 'TextPresetsTool');

                if (!fs.existsSync(stateFolder)) {
                    fs.mkdirSync(stateFolder, { recursive: true });
                }

                fs.writeFileSync(path.join(stateFolder, 'state.json'), json, 'utf8');
                console.log('State saved to file system');
            } catch (fsErr) {
                console.error('File system save failed:', fsErr);
            }
        }
    } catch (e) {
        console.error('Error saving state:', e);
    }
}

function loadState() {
    try {
        // Default to localStorage
        let saved = localStorage.getItem('subtitlesToolState');

        // Try to load from file system for better persistence
        if (typeof window.require !== 'undefined') {
            try {
                const fs = window.require('fs');
                const path = window.require('path');
                const userDataPath = csInterface.getSystemPath(SystemPath.USER_DATA);
                const stateFile = path.join(userDataPath, 'TextPresetsTool', 'state.json');

                if (fs.existsSync(stateFile)) {
                    saved = fs.readFileSync(stateFile, 'utf8');
                    console.log('State loaded from file system');
                }
            } catch (fsErr) {
                console.error('File system load failed:', fsErr);
            }
        }

        if (saved && saved.trim().startsWith('{')) {
            try {
                const savedState = JSON.parse(saved);
                state.selectedEffects = savedState.selectedEffects || { entrance: null, exit: null };
                state.selectedApplyPreset = savedState.selectedApplyPreset || null;
                state.currentTab = savedState.currentTab || 'quick';
                state.favoritePresets = new Set(savedState.favoritePresets || []);
                state.favoriteEffects = new Set(savedState.favoriteEffects || []);
                state.showOnlyFavorites = false; // Force normal view as default on startup
            } catch (e) {
                console.error('Error parsing state:', e);
            }
        }
    } catch (e) {
        console.error('Error loading state:', e);
        // Ensure defaults on error
        state.favoritePresets = new Set();
        state.favoriteEffects = new Set();
    }
}

function toggleFavorite(preset, buttonElement) {
    const key = getFavoriteKeyForPreset(preset);
    if (!key) return;

    if (isPresetFavorite(preset)) {
        state.favoritePresets.delete(key);
        if (preset.id) state.favoritePresets.delete(preset.id);
    } else {
        state.favoritePresets.add(key);
    }

    updateFavoriteStarUI(preset, buttonElement);
    saveState();
    updateCategoryCounts();

    if (state.currentTab === 'presets' && state.currentCategory === 'favorites') {
        renderPresetGrid();
    }

    if (state.showOnlyFavorites) {
        populateFlatFavorites();
    }
}

function migrateLegacyFavoriteKeys() {
    const allPresets = (state.aePresets && state.aePresets.animateIn) || [];
    if (!allPresets.length || !state.favoritePresets.size) return false;

    let migrated = false;
    [...state.favoritePresets].forEach((legacyKey) => {
        if (String(legacyKey).startsWith('ffx:') || String(legacyKey).startsWith('fx:')) return;
        const preset = allPresets.find((p) => p.id === legacyKey);
        if (!preset) return;
        const key = getFavoriteKeyForPreset(preset);
        if (key) {
            state.favoritePresets.add(key);
            state.favoritePresets.delete(legacyKey);
            migrated = true;
        }
    });
    return migrated;
}

function saveCategoryState() {
    const categoryStates = {};
    document.querySelectorAll('.category-header').forEach(header => {
        const categoryId = header.dataset.category;
        categoryStates[categoryId] = header.classList.contains('collapsed');
    });

    localStorage.setItem('subtitlesPresetToolCategories', JSON.stringify(categoryStates));
}

function loadCategoryState() {
    const saved = localStorage.getItem('subtitlesPresetToolCategories');

    if (saved) {
        try {
            const categoryStates = JSON.parse(saved);

            Object.keys(categoryStates).forEach(categoryId => {
                if (categoryStates[categoryId]) {
                    const header = document.querySelector(`[data-category="${categoryId}"]`);
                    const content = document.getElementById(categoryId);

                    if (header && content) {
                        header.classList.add('collapsed');
                        content.classList.add('collapsed');
                    }
                }
            });

        } catch (e) {
            console.error('Error loading category state:', e);
        }
    }
}

// ============================================================================
// IMPORT/EXPORT FUNCTIONS
// ============================================================================

function handleImportPresets() {
    elements.presetImportInput.click();
}

// Función handlePresetFilesSelected duplicada ELIMINADA
// La función correcta está en la línea ~1518

function handleExportPresets() {
    if (state.customPresets.length === 0) {
        setStatus('No hay presets personalizados para exportar', 'error');
        return;
    }

    setStatus('Exportando presets...', 'loading');

    evalScript('$.global.exportCustomPresets()', function (result) {
        try {
            const data = JSON.parse(result);

            if (data.error) {
                setStatus('Error: ' + data.error, 'error');
                return;
            }

            if (data.success) {
                const message = `${data.presetsExported} preset(s) exportados.\n\nRuta:\n${data.exportPath}`;
                setStatus(`✓ ${data.presetsExported} presets exportados`, 'success');
                showMessageDialog({
                    title: 'Exportación correcta',
                    message
                });
            }

        } catch (e) {
            setStatus('Error: ' + e.message, 'error');
        }
    });
}

// ============================================================================
// START
// ============================================================================

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
