/**
 * MediaVault by Animateoo — panel UI
 */
(function () {
    const cs = new CSInterface();
    const Lib = MediaVaultLibrary;
    const Drop = MediaVaultDrop;
    const Preview = MediaVaultPreview;
    const Project = MediaVaultProject;
    const Icons = MediaVaultIcons;
    const path = Lib.path;
    const fs = Lib.fs;
    const os = Lib.os;

    let settings = Lib.readSettings();
    let cache = Lib.readCache();
    let hostInfo = { isAE: true, isPPRO: false };
    let aeInsertLayerIndex = 1;
    let aeZeroSelectionPolls = 0;
    let aeLayerPollTimer = null;

    let activeLibraryId = settings.lastLibraryId || null;
    let activeFolderId = settings.lastFolder || null;
    let typeFilter = "all";
    let searchQuery = "";
    let searchRenderRaf = 0;
    let searchResultTotal = 0;
    const SEARCH_MAX = 500;
    const searchState = {
        libId: null,
        scopeKey: "",
        lastQuery: "",
        lastResults: null,
        lastPool: null
    };
    let showFavoritesOnly = false;
    let viewMode = settings.viewMode || "icons-m";
    let expandedNodes = new Set(settings.expandedTree || []);
    let thumbSize = settings.thumbSize || viewThumbSize(viewMode);
    let selectedAsset = null;
    let ctxTarget = null;
    let iconGridVirt = null;
    let linkBrowsePath = os.homedir();
    let dragDepth = 0;
    let dragTimer = null;
    let pendingDropFiles = null;
    const $ = (id) => document.getElementById(id);

    function evalScript(script) {
        return new Promise((resolve) => {
            cs.evalScript(script, (result) => {
                if (!result || result === "EvalScript error.") {
                    resolve('{"ok":false,"error":"script_error"}');
                } else {
                    resolve(result);
                }
            });
        });
    }

    function jsxCall(fnName, args) {
        const parts = args.map(function (a) {
            if (a === true) return "true";
            if (a === false) return "false";
            if (a === null) return "null";
            if (typeof a === "number" && isFinite(a)) return String(a);
            return JSON.stringify(String(a));
        });
        return evalScript(fnName + "(" + parts.join(",") + ")");
    }

    async function hostRun(action, data) {
        const payload = JSON.stringify(Object.assign({ action: action }, data || {}));
        const raw = await evalScript("mvRun(" + JSON.stringify(payload) + ")");
        if (!raw || raw === "EvalScript error.") {
            return { ok: false, error: "script_error" };
        }
        return parseJson(raw, { ok: false, error: "script_error" });
    }

    async function ensureHostScript() {
        try {
            const extPath = cs.getSystemPath(SystemPath.EXTENSION).replace(/\\/g, "/");
            const jsxPath = extPath + "/jsx/host.jsx";
            await evalScript(
                "try{$.evalFile(" + JSON.stringify(jsxPath) + ');"ok";}catch(e){"err:" + String(e);}'
            );
        } catch (e) {}
    }

    function parseJson(str, fallback) {
        try {
            return JSON.parse(str);
        } catch (e) {
            return fallback;
        }
    }

    function showToast(msg, type) {
        const el = $("toast");
        el.textContent = msg;
        el.className = "toast " + (type || "");
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => el.classList.add("is-hidden"), 2800);
    }

    function setLoading(on, text) {
        $("loading").classList.toggle("is-hidden", !on);
        if (text) $("loading-text").textContent = text;
    }

    function saveSettings() {
        settings.lastLibraryId = activeLibraryId;
        settings.lastFolder = activeFolderId;
        settings.thumbSize = thumbSize;
        settings.viewMode = viewMode;
        settings.expandedTree = Array.from(expandedNodes);
        Lib.writeSettings(settings);
    }

    function syncSidebarUi() {
        const collapsed = settings.sidebarCollapsed === true;
        const workspace = $("workspace");
        const btn = $("btn-toggle-sidebar");
        if (workspace) workspace.classList.toggle("sidebar-collapsed", collapsed);
        if (btn) {
            btn.classList.toggle("is-active", !collapsed);
            btn.title = collapsed ? "Mostrar biblioteca (Ctrl+B)" : "Ocultar biblioteca (Ctrl+B)";
        }
    }

    function toggleSidebar(forceCollapsed) {
        if (typeof forceCollapsed === "boolean") {
            settings.sidebarCollapsed = forceCollapsed;
        } else {
            settings.sidebarCollapsed = !settings.sidebarCollapsed;
        }
        Lib.writeSettings(settings);
        syncSidebarUi();
    }

    function treeKey(libId, nodeId) {
        return libId + "::" + nodeId;
    }

    function isExpanded(libId, nodeId) {
        return expandedNodes.has(treeKey(libId, nodeId));
    }

    function toggleExpanded(libId, nodeId) {
        const key = treeKey(libId, nodeId);
        if (expandedNodes.has(key)) expandedNodes.delete(key);
        else expandedNodes.add(key);
        saveSettings();
        renderTree();
    }

    function ensureExpandedPath(libId, folderId) {
        ensureCategoryExpanded(libId);
        expandedNodes.add(treeKey(libId, "__lib__"));
        if (!folderId) return;
        const parts = folderId.split("/");
        let acc = "";
        for (let i = 0; i < parts.length; i++) {
            acc = acc ? acc + "/" + parts[i] : parts[i];
            expandedNodes.add(treeKey(libId, acc));
        }
    }

    function shortenPath(p) {
        if (!p) return "—";
        return p.replace(os.homedir(), "~").replace(/\\/g, "/");
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function treeToggleMarkup(expanded, libId, nodeId) {
        return (
            '<span class="mv-tgl' +
            (expanded ? " expanded" : "") +
            '" data-action="toggle" data-lib="' +
            escapeHtml(libId) +
            '" data-node="' +
            escapeHtml(nodeId) +
            '" title="' +
            (expanded ? "Contraer" : "Expandir") +
            '" aria-hidden="true">' +
            (expanded ? "−" : "+") +
            "</span>"
        );
    }

    const MEDIA_CATEGORIES = [
        { id: "audio", label: "Audios" },
        { id: "video", label: "Videos" },
        { id: "image", label: "Imágenes" },
        { id: "other", label: "Otros" }
    ];

    function libraryCategory(lib) {
        const counts = { audio: 0, video: 0, image: 0, other: 0 };
        (lib.files || []).forEach(function (f) {
            if (f.type === "audio") counts.audio++;
            else if (f.type === "video") counts.video++;
            else if (f.type === "image") counts.image++;
            else counts.other++;
        });
        let best = "other";
        let max = counts.other;
        ["audio", "video", "image"].forEach(function (t) {
            if (counts[t] > max) {
                max = counts[t];
                best = t;
            }
        });
        return best;
    }

    function libraryCategoryId(libId) {
        const lib = cache.libraries[libId];
        return lib ? libraryCategory(lib) : "other";
    }

    function librariesGroupedByCategory() {
        const groups = { audio: [], video: [], image: [], other: [] };
        Object.keys(cache.libraries).forEach(function (id) {
            groups[libraryCategory(cache.libraries[id])].push(cache.libraries[id]);
        });
        Object.keys(groups).forEach(function (key) {
            groups[key].sort(function (a, b) {
                return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
            });
        });
        return groups;
    }

    function ensureCategoryExpanded(libId) {
        expandedNodes.add(treeKey("__cat__", libraryCategoryId(libId)));
    }

    function typeBadge(type) {
        const map = { video: "VID", audio: "AUD", image: "IMG", project: "PRJ", preset: "FX", other: "FILE" };
        return map[type] || "FILE";
    }

    function viewThumbSize(mode) {
        const map = { "icons-xl": 220, "icons-l": 180, "icons-m": 120, grid: 120 };
        return map[mode] || 120;
    }

    function formatPreviewMeta(file) {
        if (!file) return "";
        if (file.type === "audio") return "";
        return file.ext.toUpperCase() + " · " + Lib.formatSize(file.size);
    }

    function isIconView(mode) {
        mode = mode || viewMode;
        return mode === "grid" || mode.indexOf("icons") === 0;
    }

    function syncViewUi() {
        const icon = isIconView();
        const listBtn = $("view-list");
        const gridBtn = $("view-grid");
        const sizeToggle = $("size-toggle");

        if (listBtn) listBtn.classList.toggle("active", !icon);
        if (gridBtn) gridBtn.classList.toggle("active", icon);
        if (sizeToggle) sizeToggle.classList.toggle("is-hidden", !icon);

        const favBtn = $("btn-favorites");
        if (favBtn) {
            favBtn.innerHTML = Icons.starHtml(showFavoritesOnly);
        }

        document.querySelectorAll(".size-btn").forEach(function (btn) {
            btn.classList.toggle("active", parseInt(btn.dataset.size, 10) === thumbSize);
        });
    }

    function setIconView(size) {
        thumbSize = size || thumbSize;
        if (thumbSize >= 200) viewMode = "icons-xl";
        else if (thumbSize >= 165) viewMode = "icons-l";
        else viewMode = "icons-m";
        saveSettings();
        renderAssets();
        syncViewUi();
    }

    function mountToolbarIcons() {
        $("btn-toggle-sidebar").innerHTML = Icons.html("sidebar");
        $("view-list").innerHTML = Icons.html("list");
        $("view-grid").innerHTML = Icons.html("grid");
        $("btn-favorites").innerHTML = Icons.html("star");
        $("btn-preview-use").innerHTML = Icons.html("timeline");
        $("btn-preview-import").innerHTML = Icons.html("importIn");
    }

    const PREVIEW_WAVE_MIN = 40;
    const PREVIEW_WAVE_MAX = 260;
    const PREVIEW_VIDEO_MIN = 100;
    const PREVIEW_VIDEO_MAX = 320;
    const PREVIEW_VIDEO_DEFAULT = 180;

    function isTallPreviewType(type) {
        return type === "video" || type === "image";
    }

    function previewHeightLimits(type) {
        const tall = isTallPreviewType(type);
        return {
            min: tall ? PREVIEW_VIDEO_MIN : PREVIEW_WAVE_MIN,
            max: tall ? PREVIEW_VIDEO_MAX : PREVIEW_WAVE_MAX,
            stored: tall
                ? settings.previewVideoHeight || PREVIEW_VIDEO_DEFAULT
                : settings.previewWaveHeight || 72
        };
    }

    function applyPreviewMediaHeight(height, file, persist) {
        const wave = $("preview-media");
        if (!wave) return;

        const asset = file || selectedAsset;
        const type = asset ? asset.type : "audio";
        const limits = previewHeightLimits(type);
        const target = height != null ? height : limits.stored;
        const h = Math.max(limits.min, Math.min(limits.max, target));

        wave.style.height = h + "px";
        wave.classList.toggle("is-tall-preview", isTallPreviewType(type));

        if (persist) {
            if (isTallPreviewType(type)) settings.previewVideoHeight = h;
            else settings.previewWaveHeight = h;
        }

        relayoutIconGrid(true);
    }

    function bindPreviewWaveResize() {
        const handle = $("preview-resize-handle");
        const wave = $("preview-media");
        if (!handle || !wave) return;

        if (selectedAsset && !$("preview-bar").classList.contains("is-hidden")) {
            applyPreviewMediaHeight(null, selectedAsset, false);
        }

        handle.addEventListener("mousedown", function (e) {
            if (e.button !== 0) return;
            e.preventDefault();

            const startY = e.clientY;
            const startH = wave.getBoundingClientRect().height;
            document.body.classList.add("preview-wave-resizing");

            function onMove(ev) {
                applyPreviewMediaHeight(startH + (startY - ev.clientY), selectedAsset, false);
            }

            function onUp() {
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
                document.body.classList.remove("preview-wave-resizing");
                applyPreviewMediaHeight(wave.getBoundingClientRect().height, selectedAsset, true);
                saveSettings();
            }

            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
        });
    }

    function createFavButton(filePath) {
        const isFav = settings.favorites.indexOf(filePath) >= 0;
        const fav = document.createElement("button");
        fav.type = "button";
        fav.className = "fav-btn" + (isFav ? " on" : "");
        fav.draggable = false;
        fav.innerHTML = Icons.starHtml(isFav);
        fav.setAttribute("aria-label", isFav ? "Quitar favorito" : "Marcar favorito");
        fav.addEventListener("click", function (e) {
            e.stopPropagation();
            toggleFavorite(filePath);
        });
        return fav;
    }

    function createTypeIcon(type) {
        const icon = document.createElement("span");
        icon.className = "col-icon type-icon type-" + type;
        icon.style.color = Lib.typeColor(type);
        icon.innerHTML = Icons.typeHtml(type);
        return icon;
    }

    function renderAll() {
        renderTree();
        renderAssets();
        syncViewUi();
    }

    function fileUrl(absPath) {
        return Lib.mediaFileUrl(absPath);
    }

    function getActiveLibrary() {
        if (!activeLibraryId || !cache.libraries[activeLibraryId]) {
            const ids = Object.keys(cache.libraries);
            if (ids.length) return Lib.prepareLibrarySearchIndex(cache.libraries[ids[0]]);
        }
        const lib = activeLibraryId ? cache.libraries[activeLibraryId] : null;
        return lib ? Lib.prepareLibrarySearchIndex(lib) : null;
    }

    function hasLibraries() {
        return Object.keys(cache.libraries).length > 0;
    }

    function getFileParentRelPath(relPath) {
        if (!relPath || relPath.indexOf("/") === -1) return "";
        return relPath.substring(0, relPath.lastIndexOf("/"));
    }

    function fileBelongsToFolder(file, folderId) {
        if (!folderId) return file.relPath.indexOf("/") === -1;
        if (getFileParentRelPath(file.relPath) === folderId) return true;
        return file.relPath.indexOf(folderId + "/") === 0;
    }

    function getSubfolderLabel(file, folderId) {
        if (!folderId || getFileParentRelPath(file.relPath) === folderId) return "";
        const rest = file.relPath.slice(folderId.length + 1);
        const slash = rest.indexOf("/");
        return slash === -1 ? "" : rest.slice(0, slash);
    }

    function fileListSig(files) {
        if (!files.length) return "0";
        return files.length + "|" + files[0].path + "|" + files[files.length - 1].path;
    }

    function getFileDisplayName(file) {
        const baseName = file.name.replace(/\.[^.]+$/, "");
        if (searchQuery) {
            const relDir = getFileParentRelPath(file.relPath);
            return relDir ? relDir.replace(/\//g, " / ") + " / " + baseName : baseName;
        }
        const sub = getSubfolderLabel(file, activeFolderId);
        return sub ? sub + " / " + baseName : baseName;
    }

    function getSearchPinsForLib(libId) {
        return (settings.searchPins || []).filter(function (p) {
            return p.libId === libId;
        });
    }

    function isSearchPinned(libId, folderId) {
        return getSearchPinsForLib(libId).some(function (p) {
            return (p.folderId || "") === (folderId || "");
        });
    }

    function searchPinLabel(libId, folderId) {
        const lib = cache.libraries[libId];
        if (!lib) return folderId || "Carpeta";
        if (!folderId) return lib.name;
        return lib.name + " / " + folderId.replace(/\//g, " / ");
    }

    function invalidateSearchState() {
        searchState.libId = null;
        searchState.scopeKey = "";
        searchState.lastQuery = "";
        searchState.lastResults = null;
        searchState.lastPool = null;
        searchResultTotal = 0;
    }

    function searchScopeKey(libId) {
        const pins = getSearchPinsForLib(libId);
        if (!pins.length) return "all";
        return pins
            .map(function (p) {
                return p.folderId || "*";
            })
            .sort()
            .join("|");
    }

    function getSearchPool(lib) {
        const scopeKey = searchScopeKey(lib.id);
        if (searchState.libId === lib.id && searchState.scopeKey === scopeKey && searchState.lastPool) {
            return searchState.lastPool;
        }

        const pins = getSearchPinsForLib(lib.id);
        let pool;

        if (!pins.length) {
            pool = lib.files;
        } else {
            const seen = Object.create(null);
            pool = [];
            pins.forEach(function (p) {
                const list = p.folderId ? lib.folderIndex[p.folderId] || [] : lib.files;
                for (let i = 0; i < list.length; i++) {
                    const f = list[i];
                    if (!seen[f.path]) {
                        seen[f.path] = 1;
                        pool.push(f);
                    }
                }
            });
        }

        searchState.libId = lib.id;
        searchState.scopeKey = scopeKey;
        searchState.lastQuery = "";
        searchState.lastResults = null;
        searchState.lastPool = pool;
        return pool;
    }

    function searchRank(file, ql, terms) {
        let score = 0;
        if (file._base === ql) score += 1000;
        else if (file._base.indexOf(ql) === 0) score += 800;
        else if (file._name.indexOf(ql) === 0) score += 650;
        else if (file._base.indexOf(ql) >= 0) score += 400;

        for (let i = 0; i < terms.length; i++) {
            const t = terms[i];
            if (file._base.indexOf(t) === 0) score += 60;
            else if (file._name.indexOf(t) === 0) score += 40;
            else if (file._q.indexOf(t) >= 0) score += 15;
        }
        return score;
    }

    function searchFiles(pool, query) {
        const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (!terms.length) {
            searchState.lastQuery = "";
            searchState.lastResults = null;
            searchResultTotal = pool.length;
            return pool.length > SEARCH_MAX ? pool.slice(0, SEARCH_MAX) : pool;
        }

        let source = pool;
        if (
            searchState.lastResults &&
            searchState.lastQuery &&
            query.indexOf(searchState.lastQuery) === 0
        ) {
            source = searchState.lastResults;
        }

        const ql = query.toLowerCase();
        const results = [];
        for (let i = 0; i < source.length; i++) {
            const f = source[i];
            const hay = f._q;
            let ok = true;
            for (let t = 0; t < terms.length; t++) {
                if (hay.indexOf(terms[t]) === -1) {
                    ok = false;
                    break;
                }
            }
            if (ok) results.push(f);
        }

        if (results.length > 1) {
            results.sort(function (a, b) {
                const diff = searchRank(b, ql, terms) - searchRank(a, ql, terms);
                return diff || a.relPath.localeCompare(b.relPath, undefined, { sensitivity: "base" });
            });
        }

        searchState.lastQuery = query;
        searchState.lastResults = results;
        searchResultTotal = results.length;
        return results.length > SEARCH_MAX ? results.slice(0, SEARCH_MAX) : results;
    }

    function applyFileFilters(files) {
        if (typeFilter !== "all") {
            files = files.filter(function (f) {
                return f.type === typeFilter;
            });
        }
        if (showFavoritesOnly) {
            files = files.filter(function (f) {
                return settings.favorites.indexOf(f.path) >= 0;
            });
        }
        return files;
    }

    function scheduleSearchRender() {
        if (searchRenderRaf) cancelAnimationFrame(searchRenderRaf);
        searchRenderRaf = requestAnimationFrame(function () {
            searchRenderRaf = 0;
            renderAssets();
        });
    }
    function toggleSearchPin(libId, folderId) {
        settings.searchPins = settings.searchPins || [];
        const key = folderId || "";
        const idx = settings.searchPins.findIndex(function (p) {
            return p.libId === libId && (p.folderId || "") === key;
        });
        if (idx >= 0) {
            settings.searchPins.splice(idx, 1);
            showToast("Quitado de búsqueda rápida", "success");
        } else {
            settings.searchPins.push({
                libId: libId,
                folderId: folderId || null,
                label: searchPinLabel(libId, folderId)
            });
            showToast("Añadido a búsqueda rápida", "success");
        }
        Lib.writeSettings(settings);
        invalidateSearchState();
        renderSearchPins();
        if (searchQuery) scheduleSearchRender();
    }

    function getVisibleFiles() {
        const lib = getActiveLibrary();
        if (!lib) return [];

        const searching = searchQuery.length > 0;
        let files;

        if (searching) {
            files = searchFiles(getSearchPool(lib), searchQuery);
        } else {
            invalidateSearchState();
            if (activeFolderId) {
                files = lib.folderIndex[activeFolderId] || [];
            } else {
                files = lib.folderIndex.__root__ || [];
            }
        }

        return applyFileFilters(files);
    }

    function updateWelcomeState() {
        const welcome = $("welcome-state");
        const hasLibs = hasLibraries();
        const icon = isIconView();

        welcome.classList.toggle("is-hidden", hasLibs);
        $("asset-list").classList.toggle("is-hidden", !hasLibs || icon);
        $("asset-grid").classList.toggle("is-hidden", !hasLibs || !icon);

        if (hasLibs && icon) {
            $("asset-list").innerHTML = "";
        } else if (hasLibs && !icon) {
            destroyIconGrid();
            $("asset-grid").innerHTML = "";
        }
    }

    function applyViewVisibility() {
        const icon = isIconView();
        const list = $("asset-list");
        const grid = $("asset-grid");
        if (!list || !grid) return;

        list.classList.toggle("is-hidden", icon);
        grid.classList.toggle("is-hidden", !icon);
        list.style.display = icon ? "none" : "flex";
        grid.style.display = icon ? "block" : "none";
    }

    function cssEscape(str) {
        if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(str);
        return String(str).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    }

    function stopInlineVideos() {
        document.querySelectorAll(".card-video-wrap").forEach(function (wrap) {
            wrap.classList.remove("playing", "scrubbing");
            const vid = wrap.querySelector(".card-video");
            if (vid) vid.pause();
        });
    }

    function seekInlineVideo(wrap, video, time) {
        if (!video || !video.duration || !isFinite(video.duration)) return;
        const t = Math.max(0, Math.min(video.duration, time));
        video.pause();
        video.currentTime = t;
        wrap.classList.add("has-frame");
        wrap.classList.remove("playing");

        const scrub = wrap.querySelector(".card-video-scrub");
        if (scrub) scrub.value = String(Math.floor(t * 1000));

        const head = wrap.querySelector(".card-video-head");
        if (head) head.style.width = (t / video.duration) * 100 + "%";
    }

    function mountVideoScrub(wrap, file) {
        const video = wrap.querySelector(".card-video");
        if (!video) return;

        function isActive() {
            const card = wrap.closest(".asset-card");
            return card && card.classList.contains("selected");
        }

        function seekFromMouse(clientX) {
            if (!isActive() || !video.duration) return;
            const rect = wrap.getBoundingClientRect();
            if (!rect.width) return;
            const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
            let t = ratio * video.duration;
            if (ratio >= 1) t = Math.max(0, video.duration - 0.001);
            seekInlineVideo(wrap, video, t);
        }

        wrap.addEventListener("mousedown", function (e) {
            if (e.button !== 0) return;
            if (e.target.closest(".fav-btn")) return;

            selectAsset(file);
            wrap.classList.add("scrubbing");
            seekFromMouse(e.clientX);
        });

        wrap.addEventListener("mouseenter", function (e) {
            if (!isActive()) return;
            wrap.classList.add("scrubbing");
            seekFromMouse(e.clientX);
        });

        wrap.addEventListener("mousemove", function (e) {
            if (!isActive()) return;
            wrap.classList.add("scrubbing");
            seekFromMouse(e.clientX);
        });

        wrap.addEventListener("mouseleave", function () {
            wrap.classList.remove("scrubbing");
        });
    }

    function fileUrl(absPath) {
        return Lib.mediaFileUrl(absPath);
    }

    function applyVideoSource(video, file, wrap) {
        const mime = Lib.videoMimeType(file.ext);
        const src = fileUrl(file.path);

        function setSrc(url) {
            while (video.firstChild) video.removeChild(video.firstChild);
            const source = document.createElement("source");
            source.src = url;
            source.type = mime;
            video.appendChild(source);
            video.src = url;
            video.load();
        }

        setSrc(src);

        video.addEventListener(
            "error",
            function onVideoError() {
                if (video._blobFallback) return;
                video._blobFallback = true;
                try {
                    const buf = fs.readFileSync(file.path);
                    const blob = new Blob([buf], { type: mime });
                    setSrc(URL.createObjectURL(blob));
                    wrap.classList.remove("video-error");
                } catch (e) {
                    wrap.classList.add("video-error");
                }
            },
            { once: true }
        );
    }

    function setupInlineVideoCard(wrap, file) {
        wrap.classList.add("card-video-wrap");

        const video = document.createElement("video");
        video.className = "card-video";
        video.preload = "auto";
        video.playsInline = true;
        video.setAttribute("playsinline", "");
        video.setAttribute("webkit-playsinline", "");

        applyVideoSource(video, file, wrap);

        const overlay = document.createElement("div");
        overlay.className = "card-video-scrub-hint";
        overlay.textContent = "mover sobre el video";

        const scrubTrack = document.createElement("div");
        scrubTrack.className = "card-video-scrub-track";
        const scrubHead = document.createElement("div");
        scrubHead.className = "card-video-head";
        scrubTrack.appendChild(scrubHead);

        const scrub = document.createElement("input");
        scrub.type = "range";
        scrub.className = "card-video-scrub is-hidden";
        scrub.min = "0";
        scrub.max = "1000";
        scrub.value = "0";
        scrub.title = "Posición";

        scrub.addEventListener("click", function (e) {
            e.stopPropagation();
        });
        scrub.addEventListener("mousedown", function (e) {
            e.stopPropagation();
        });

        video.addEventListener("loadedmetadata", function () {
            if (video.duration && isFinite(video.duration)) {
                scrub.max = String(Math.max(1000, Math.floor(video.duration * 1000)));
            }
            video.currentTime = 0;
            seekInlineVideo(wrap, video, 0);
        });

        video.addEventListener("loadeddata", function () {
            wrap.classList.add("has-frame");
        });

        video.addEventListener("error", function () {
            wrap.classList.remove("scrubbing");
        });

        scrub.addEventListener("input", function () {
            if (!video.duration) return;
            seekInlineVideo(wrap, video, parseInt(scrub.value, 10) / 1000);
        });

        wrap.appendChild(video);
        wrap.appendChild(overlay);
        wrap.appendChild(scrubTrack);
        wrap.appendChild(scrub);
        mountVideoScrub(wrap, file);
    }

    function dismissPreview() {
        if (!selectedAsset || $("preview-bar").classList.contains("is-hidden")) return;
        selectAsset(null);
    }

    function clearPreviewBar() {
        Preview.stopAll();
        $("preview-bar").classList.add("is-hidden");
        const media = $("preview-media");
        const controls = $("preview-controls");
        if (media) {
            media.innerHTML = "";
            media.classList.remove("is-tall-preview");
            media.style.height = "";
        }
        if (controls) controls.innerHTML = "";
        const metaEl = $("preview-meta");
        if (metaEl) {
            metaEl.textContent = "";
            metaEl.classList.add("is-hidden");
        }
    }

    function showPreviewBar(file, playOnMount) {
        $("preview-bar").classList.remove("is-hidden");
        $("preview-name").textContent = file.name;
        const metaEl = $("preview-meta");
        const metaText = formatPreviewMeta(file);
        metaEl.textContent = metaText || "—";
        metaEl.classList.toggle("is-hidden", !metaText);
        Preview.mount($("preview-media"), $("preview-controls"), file, Lib, $("preview-meta"), {
            playOnMount: !!playOnMount
        });
        applyPreviewMediaHeight(null, file, false);
    }

    function syncSelectionPreview() {
        if (!selectedAsset) {
            if (!$("preview-bar").classList.contains("is-hidden")) clearPreviewBar();
            return;
        }

        const file = selectedAsset;
        const shouldHide = isIconView() && (file.type === "video" || file.type === "image");
        const barHidden = $("preview-bar").classList.contains("is-hidden");

        if (shouldHide) {
            if (!barHidden) clearPreviewBar();
            return;
        }

        if (barHidden) {
            stopInlineVideos();
            showPreviewBar(file, false);
        }
    }

    function selectAsset(file) {
        const sameFile = selectedAsset && file && selectedAsset.path === file.path;

        if (!file) {
            selectedAsset = null;
            stopInlineVideos();
            document.querySelectorAll(".asset-card.selected, .asset-row.selected").forEach(function (c) {
                c.classList.remove("selected");
            });
            clearPreviewBar();
            return;
        }

        if (isIconView() && file.type === "video") {
            selectedAsset = file;
            document.querySelectorAll(".asset-card.selected, .asset-row.selected").forEach(function (c) {
                c.classList.remove("selected");
            });
            const card = document.querySelector('.asset-card[data-path="' + cssEscape(file.path) + '"]');
            if (card) card.classList.add("selected");

            clearPreviewBar();
            stopInlineVideos();
            return;
        }

        stopInlineVideos();

        if (sameFile && file.type === "audio") {
            Preview.playOnce();
            return;
        }

        selectedAsset = file;
        document.querySelectorAll(".asset-card.selected, .asset-row.selected").forEach(function (c) {
            c.classList.remove("selected");
        });

        const row = document.querySelector(
            '.asset-row[data-path="' + cssEscape(file.path) + '"], .asset-card[data-path="' + cssEscape(file.path) + '"]'
        );
        if (row) row.classList.add("selected");
        else if (isIconView()) updateIconGridSelection();

        if (isIconView() && file.type === "image") {
            clearPreviewBar();
            return;
        }

        showPreviewBar(file, file.type === "audio" || file.type === "video");
    }

    function buildTreeFromFiles(files) {
        const root = { id: "", name: "", children: {} };

        (files || []).forEach(function (f) {
            const parts = (f.relPath || f.name).includes("/")
                ? f.relPath.split("/").slice(0, -1)
                : [];
            let node = root;
            parts.forEach(function (part) {
                if (!node.children[part]) {
                    node.children[part] = { id: "", name: part, children: {} };
                }
                node = node.children[part];
                node.id = node.id ? node.id + "/" + part : part;
            });
        });

        function toArray(map) {
            return Object.keys(map)
                .sort(function (a, b) {
                    return a.localeCompare(b, undefined, { sensitivity: "base" });
                })
                .map(function (key) {
                    const n = map[key];
                    return {
                        id: n.id,
                        name: n.name,
                        type: "folder",
                        children: toArray(n.children)
                    };
                });
        }

        return toArray(root.children);
    }

    function getLibraryTree(lib) {
        if (lib.tree && lib.tree.length) return lib.tree;
        return buildTreeFromFiles(lib.files || []);
    }

    function renderTreeHtmlNodes(libId, nodes, depth) {
        let html = "";
        (nodes || []).forEach(function (node) {
            const hasKids = node.children && node.children.length > 0;
            const nodeExpanded = isExpanded(libId, node.id);
            const pad = 6 + depth * 10;
            const active = activeFolderId === node.id ? " active" : "";

            html += '<div class="mv-tree-row' + active + '" style="padding-left:' + pad + 'px">';
            if (hasKids) {
                html += treeToggleMarkup(nodeExpanded, libId, node.id);
            } else {
                html += '<span class="mv-tgl-spacer" aria-hidden="true"></span>';
            }
            html +=
                '<span class="mv-folder" data-action="folder" data-lib="' +
                escapeHtml(libId) +
                '" data-node="' +
                escapeHtml(node.id) +
                '">' +
                escapeHtml(node.name) +
                "</span>";
            html += "</div>";

            if (hasKids && nodeExpanded) {
                html += renderTreeHtmlNodes(libId, node.children, depth + 1);
            }
        });
        return html;
    }

    function renderTree() {
        const tree = $("folder-tree");
        if (!tree) return;

        const libIds = Object.keys(cache.libraries);
        if (!libIds.length) {
            tree.innerHTML =
                '<div class="mv-tree-empty">Arrastra una carpeta al panel o usa <strong>Vincular</strong>.</div>';
            return;
        }

        let html = "";
        const groups = librariesGroupedByCategory();

        MEDIA_CATEGORIES.forEach(function (cat) {
            const libs = groups[cat.id];
            if (!libs.length) return;

            const catExpanded = isExpanded("__cat__", cat.id);

            html += '<div class="mv-tree-row mv-tree-cat">';
            html += treeToggleMarkup(catExpanded, "__cat__", cat.id);
            html += '<span class="mv-cat-label">' + escapeHtml(cat.label) + "</span>";
            html += "</div>";

            if (!catExpanded) return;

            html += '<div class="mv-tree-cat-group">';
            libs.forEach(function (lib) {
                const libId = lib.id;
                const libExpanded = isExpanded(libId, "__lib__");
                const libActive = activeLibraryId === libId && !activeFolderId ? " active" : "";

                html += '<div class="mv-tree-row mv-tree-lib' + libActive + '">';
                html += treeToggleMarkup(libExpanded, libId, "__lib__");
                html +=
                    '<span class="mv-folder root" data-action="libroot" data-lib="' +
                    escapeHtml(libId) +
                    '" title="' +
                    escapeHtml(lib.path) +
                    '">' +
                    escapeHtml(lib.name) +
                    "</span>";
                html += "</div>";

                if (libExpanded) {
                    html += '<div class="mv-tree-group">';
                    html += renderTreeHtmlNodes(libId, getLibraryTree(lib), 0);
                    html += "</div>";
                }
            });
            html += "</div>";
        });

        tree.innerHTML = html;
        tree.classList.toggle("has-active", !!activeLibraryId);
    }

    function syncHostInfoFromEnv() {
        try {
            const env = cs.getHostEnvironment();
            if (env && env.appId) {
                hostInfo.isPPRO = env.appId === "PPRO";
                hostInfo.isAE = env.appId === "AEFT";
            }
        } catch (e) {}
    }

    async function refreshAEInsertLayerIndex() {
        if (!hostInfo.isAE) return;
        const res = await hostRun("getSelectedLayerIndex", {});
        if (!res.ok) return;
        if (res.index > 0) {
            aeInsertLayerIndex = res.index;
            aeZeroSelectionPolls = 0;
            return;
        }
        aeZeroSelectionPolls++;
        if (aeZeroSelectionPolls >= 8) {
            aeInsertLayerIndex = 1;
            aeZeroSelectionPolls = 0;
        }
    }

    function startAELayerIndexPoll() {
        if (aeLayerPollTimer || !hostInfo.isAE) return;
        refreshAEInsertLayerIndex();
        aeLayerPollTimer = setInterval(refreshAEInsertLayerIndex, 350);
    }

    function stopAELayerIndexPoll() {
        if (aeLayerPollTimer) {
            clearInterval(aeLayerPollTimer);
            aeLayerPollTimer = null;
        }
    }

    function bindAEInsertLayerCapture() {
        if (!hostInfo.isAE) return;
        const appEl = $("app");
        if (!appEl) return;
        appEl.addEventListener(
            "mousedown",
            function () {
                refreshAEInsertLayerIndex();
            },
            true
        );
    }

    function fileFromPath(filePath) {
        const ext = path.extname(filePath).replace(/^\./, "").toLowerCase();
        return {
            path: filePath,
            name: path.basename(filePath),
            ext: ext,
            type: Lib.getFileType(ext)
        };
    }

    function isPointOutsidePanel(x, y) {
        const root = $("app") || document.documentElement;
        const rect = root.getBoundingClientRect();
        return x < rect.left || x > rect.right || y < rect.top || y > rect.bottom;
    }

    function shouldInsertOnDragEnd(e, filePath) {
        if (!filePath || (!hostInfo.isPPRO && !hostInfo.isAE)) return false;
        if (settings.addToTimeline === false) return false;
        if (!isPointOutsidePanel(e.clientX, e.clientY)) return false;
        if (e.dataTransfer && e.dataTransfer.dropEffect === "copy") return false;
        return true;
    }

    function bindAssetDragHost(el, getPath) {
        Drop.bindAssetDrag(el, getPath, function (e, filePath) {
            if (!shouldInsertOnDragEnd(e, filePath)) return;
            useAsset(fileFromPath(filePath), true);
        });
    }

    let useAssetBusy = false;

    function bindFileRowEvents(el, file) {
        let clickTimer = null;

        el.addEventListener("click", function () {
            clearTimeout(clickTimer);
            clickTimer = setTimeout(function () {
                selectAsset(file);
            }, 220);
        });

        el.addEventListener("dblclick", function (e) {
            clearTimeout(clickTimer);
            e.preventDefault();
            selectAsset(file);
            useAsset(file, true);
        });

        el.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY, { kind: "file", file: file });
        });

        bindAssetDragHost(el, function () {
            return file && file.path ? file.path : "";
        });
    }

    function renderList(files) {
        const list = $("asset-list");
        list.innerHTML = "";

        const head = document.createElement("div");
        head.className = "list-head";
        head.innerHTML =
            '<span class="col-icon"></span><span class="col-name">Nombre</span><span class="col-type">Tipo</span><span class="col-size">Tamaño</span><span class="col-fav"></span>';
        list.appendChild(head);

        const frag = document.createDocumentFragment();
        files.forEach((file) => {
            const row = document.createElement("div");
            row.className =
                "asset-row" +
                (selectedAsset && selectedAsset.path === file.path ? " selected" : "");
            row.dataset.path = file.path;

            const icon = createTypeIcon(file.type);

            const name = document.createElement("span");
            name.className = "col-name";
            if (searchQuery) {
                name.textContent = getFileDisplayName(file);
            } else {
                const sub = getSubfolderLabel(file, activeFolderId);
                name.textContent = sub ? sub + " / " + file.name : file.name;
            }
            name.title = file.relPath.replace(/\//g, " / ");

            const type = document.createElement("span");
            type.className = "col-type";
            type.textContent = file.ext.toUpperCase();

            const size = document.createElement("span");
            size.className = "col-size";
            size.textContent = Lib.formatSize(file.size);

            const fav = createFavButton(file.path);
            fav.classList.add("col-fav");

            row.appendChild(icon);
            row.appendChild(name);
            row.appendChild(type);
            row.appendChild(size);
            row.appendChild(fav);
            bindFileRowEvents(row, file);
            frag.appendChild(row);
        });
        list.appendChild(frag);
    }

    function renderDetails(files) {
        const list = $("asset-list");
        list.innerHTML = "";

        const head = document.createElement("div");
        head.className = "list-head list-head-details";
        head.innerHTML =
            '<span class="col-icon"></span><span class="col-name">Nombre</span><span class="col-type">Tipo</span><span class="col-size">Tamaño</span><span class="col-date">Modificado</span><span class="col-fav"></span>';
        list.appendChild(head);

        const frag = document.createDocumentFragment();
        files.forEach(function (file) {
            const row = document.createElement("div");
            row.className =
                "asset-row asset-row-details" +
                (selectedAsset && selectedAsset.path === file.path ? " selected" : "");
            row.dataset.path = file.path;

            const icon = createTypeIcon(file.type);

            const name = document.createElement("span");
            name.className = "col-name";
            if (searchQuery) {
                name.textContent = getFileDisplayName(file);
            } else {
                const subDetail = getSubfolderLabel(file, activeFolderId);
                name.textContent = subDetail ? subDetail + " / " + file.name : file.name;
            }
            name.title = file.path;

            const type = document.createElement("span");
            type.className = "col-type";
            type.textContent = file.ext.toUpperCase();

            const size = document.createElement("span");
            size.className = "col-size";
            size.textContent = Lib.formatSize(file.size);

            const date = document.createElement("span");
            date.className = "col-date";
            date.textContent = file.modified
                ? new Date(file.modified).toLocaleDateString(undefined, { day: "2-digit", month: "short" })
                : "—";

            const fav = createFavButton(file.path);
            fav.classList.add("col-fav");

            row.appendChild(icon);
            row.appendChild(name);
            row.appendChild(type);
            row.appendChild(size);
            row.appendChild(date);
            row.appendChild(fav);
            bindFileRowEvents(row, file);
            frag.appendChild(row);
        });
        list.appendChild(frag);
    }

    function destroyIconGrid() {
        if (!iconGridVirt) return;
        if (iconGridVirt.onScroll) {
            iconGridVirt.grid.removeEventListener("scroll", iconGridVirt.onScroll);
        }
        if (iconGridVirt.ro) iconGridVirt.ro.disconnect();
        if (iconGridVirt.scrollRaf) cancelAnimationFrame(iconGridVirt.scrollRaf);
        Preview.resetCardWaveforms();
        iconGridVirt = null;
    }

    function relayoutIconGrid(preserveScroll) {
        if (!iconGridVirt) return;
        const scroll = preserveScroll !== false ? iconGridVirt.grid.scrollTop : 0;
        iconGridVirt.start = -1;
        renderIconGridWindow(true);
        if (preserveScroll !== false) iconGridVirt.grid.scrollTop = scroll;
    }

    function updateIconGridSelection() {
        if (!iconGridVirt) return;
        document.querySelectorAll(".grid-virtual-window .asset-card").forEach(function (card) {
            card.classList.toggle("selected", !!(selectedAsset && selectedAsset.path === card.dataset.path));
        });
    }

    function buildGridCard(file) {
        const card = document.createElement("article");
        card.className =
            "asset-card mv-grid-card" +
            (selectedAsset && selectedAsset.path === file.path ? " selected" : "");
        card.dataset.path = file.path;

        const waveWrap = document.createElement("div");
        waveWrap.className = "card-wave-wrap type-" + file.type;

        if (file.type === "audio") {
            const canvas = document.createElement("canvas");
            canvas.className = "card-wave";
            waveWrap.appendChild(canvas);
        } else if (file.type === "image") {
            const img = document.createElement("img");
            img.src = fileUrl(file.path);
            img.alt = "";
            img.loading = "lazy";
            waveWrap.appendChild(img);
        } else if (file.type === "video") {
            setupInlineVideoCard(waveWrap, file);
        } else {
            waveWrap.innerHTML = '<span class="card-file-badge">' + typeBadge(file.type) + "</span>";
        }

        const foot = document.createElement("div");
        foot.className = "asset-foot mv-card-foot";

        const typeIcon = document.createElement("span");
        typeIcon.className = "card-type-icon type-" + file.type;
        typeIcon.style.color = Lib.typeColor(file.type);
        typeIcon.innerHTML = Icons.typeHtml(file.type);

        const name = document.createElement("span");
        name.className = "card-title";
        name.textContent = getFileDisplayName(file);
        name.title = file.relPath.replace(/\//g, " / ");

        const fav = createFavButton(file.path);

        foot.appendChild(typeIcon);
        foot.appendChild(name);
        foot.appendChild(fav);
        card.appendChild(waveWrap);
        card.appendChild(foot);
        bindFileRowEvents(card, file);

        if (file.type === "audio") {
            const canvas = waveWrap.querySelector(".card-wave");
            Preview.mountCardWaveform(canvas, file.path, thumbSize);
        }

        return card;
    }

    function readGridLayoutVars(grid) {
        const styles = window.getComputedStyle(grid);
        const padX = parseFloat(styles.getPropertyValue("--grid-pad-x")) || 12;
        const padY = parseFloat(styles.getPropertyValue("--grid-pad-y")) || 10;
        const gap = parseFloat(styles.getPropertyValue("--grid-gap")) || 10;
        return { padX: padX, padY: padY, gap: gap };
    }

    function iconGridMetrics(virt) {
        const layout = readGridLayoutVars(virt.grid);
        virt.padX = layout.padX;
        virt.padY = layout.padY;
        virt.gap = layout.gap;

        const gridW = Math.max(1, virt.grid.clientWidth);
        const innerW = Math.max(1, gridW - virt.padX * 2);
        const cols = Math.max(1, Math.floor((innerW + virt.gap) / (thumbSize + virt.gap)));
        const cellW = (innerW - (cols - 1) * virt.gap) / cols;
        const rowH = virt.cardH + virt.gap;
        const rows = Math.max(1, Math.ceil(virt.files.length / cols));

        virt.cols = cols;
        virt.cellW = cellW;
        virt.rowH = rowH;
        virt.spacer.style.height = rows * rowH - virt.gap + virt.padY * 2 + "px";
    }

    function renderIconGridWindow(force) {
        if (!iconGridVirt) return;
        const virt = iconGridVirt;
        iconGridMetrics(virt);

        const cols = virt.cols;
        const padX = virt.padX;
        const padY = virt.padY;
        const gap = virt.gap;
        const rowH = virt.rowH;
        const cellW = virt.cellW;
        const files = virt.files;
        const scrollTop = virt.grid.scrollTop;
        const viewH = virt.grid.clientHeight;

        const startRow = Math.max(0, Math.floor((scrollTop - padY) / rowH) - 2);
        const endRow = Math.min(
            Math.ceil(files.length / cols),
            Math.ceil((scrollTop + viewH - padY) / rowH) + 3
        );
        const start = startRow * cols;
        const end = Math.min(files.length, endRow * cols);

        if (
            !force &&
            start === virt.start &&
            end === virt.end &&
            cols === virt.lastCols &&
            cellW === virt.lastCellW
        ) {
            return;
        }

        virt.start = start;
        virt.end = end;
        virt.lastCols = cols;
        virt.lastCellW = cellW;

        const savedScroll = virt.grid.scrollTop;
        Preview.resetCardWaveforms();
        virt.window.innerHTML = "";

        for (let i = start; i < end; i++) {
            const file = files[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const card = buildGridCard(file);
            card.style.position = "absolute";
            card.style.width = cellW + "px";
            card.style.left = padX + col * (cellW + gap) + "px";
            card.style.top = padY + row * rowH + "px";
            virt.window.appendChild(card);
        }

        virt.grid.scrollTop = savedScroll;
    }

    function initIconGridVirtual(files, scrollTop) {
        destroyIconGrid();
        const grid = $("asset-grid");
        const waveH = Math.max(30, Math.round(thumbSize * 0.36));
        const footH = 24;
        const layout = readGridLayoutVars(grid);

        grid.style.setProperty("--thumb-size", thumbSize + "px");
        grid.style.setProperty("--card-wave-h", waveH + "px");
        grid.innerHTML = "";

        const spacer = document.createElement("div");
        spacer.className = "grid-virtual-spacer";

        const windowEl = document.createElement("div");
        windowEl.className = "grid-virtual-window";

        grid.appendChild(spacer);
        grid.appendChild(windowEl);

        iconGridVirt = {
            grid: grid,
            spacer: spacer,
            window: windowEl,
            files: files,
            fileSig: fileListSig(files),
            cardH: waveH + footH,
            padX: layout.padX,
            padY: layout.padY,
            gap: layout.gap,
            start: -1,
            end: -1,
            lastCols: 0,
            lastCellW: 0,
            scrollRaf: 0
        };

        iconGridVirt.onScroll = function () {
            if (iconGridVirt.scrollRaf) return;
            iconGridVirt.scrollRaf = requestAnimationFrame(function () {
                iconGridVirt.scrollRaf = 0;
                renderIconGridWindow(false);
            });
        };

        grid.addEventListener("scroll", iconGridVirt.onScroll, { passive: true });

        if (typeof ResizeObserver !== "undefined") {
            iconGridVirt.ro = new ResizeObserver(function () {
                relayoutIconGrid(true);
            });
            iconGridVirt.ro.observe(grid);
        }

        renderIconGridWindow(true);
        grid.scrollTop = scrollTop || 0;
    }

    function renderIconGrid(files) {
        stopInlineVideos();
        const grid = $("asset-grid");
        if (!files.length) {
            destroyIconGrid();
            grid.innerHTML = "";
            return;
        }
        const sig = fileListSig(files);
        const keepScroll = iconGridVirt && iconGridVirt.fileSig === sig;
        const prevScroll = keepScroll && iconGridVirt.grid ? iconGridVirt.grid.scrollTop : 0;
        initIconGridVirtual(files, prevScroll);
    }

    function renderAssets() {
        const files = getVisibleFiles();
        updateWelcomeState();

        if (!hasLibraries()) return;

        $("empty-state").classList.toggle("is-hidden", files.length > 0);
        let countText;
        if (searchQuery) {
            if (searchResultTotal > files.length) {
                countText = files.length + " de " + searchResultTotal + " resultados";
            } else {
                countText = searchResultTotal + " resultado" + (searchResultTotal !== 1 ? "s" : "");
            }
        } else {
            countText = files.length + " archivo" + (files.length !== 1 ? "s" : "");
        }
        $("status-count").textContent = countText;

        const lib = getActiveLibrary();
        let crumb = lib ? lib.name : "—";
        if (searchQuery) {
            crumb += ' / Búsqueda: "' + searchQuery + '"';
        } else if (lib && activeFolderId) {
            crumb += " / " + activeFolderId.replace(/\//g, " / ");
        }
        $("breadcrumb").textContent = crumb;

        applyViewVisibility();

        if (isIconView()) renderIconGrid(files);
        else {
            destroyIconGrid();
            if (viewMode === "details") renderDetails(files);
            else renderList(files);
        }

        syncSelectionPreview();
    }

    function getAssetScrollEl() {
        if (isIconView()) {
            return iconGridVirt ? iconGridVirt.grid : $("asset-grid");
        }
        return $("asset-list");
    }

    function preserveScrollDuring(fn) {
        const el = getAssetScrollEl();
        const top = el ? el.scrollTop : 0;
        fn();
        if (el) el.scrollTop = top;
    }

    function syncFavoriteButton(filePath) {
        const isFav = settings.favorites.indexOf(filePath) >= 0;
        const sel =
            '.asset-row[data-path="' +
            cssEscape(filePath) +
            '"] .fav-btn, .asset-card[data-path="' +
            cssEscape(filePath) +
            '"] .fav-btn';
        document.querySelectorAll(sel).forEach(function (btn) {
            btn.classList.toggle("on", isFav);
            btn.innerHTML = Icons.starHtml(isFav);
            btn.setAttribute("aria-label", isFav ? "Quitar favorito" : "Marcar favorito");
        });
    }

    function toggleFavorite(filePath) {
        const idx = settings.favorites.indexOf(filePath);
        const wasFav = idx >= 0;
        if (wasFav) settings.favorites.splice(idx, 1);
        else settings.favorites.push(filePath);
        Lib.writeSettings(settings);

        if (showFavoritesOnly && wasFav) {
            preserveScrollDuring(renderAssets);
            return;
        }

        syncFavoriteButton(filePath);
    }

    function ctxMenuItem(action, label, opts) {
        opts = opts || {};
        const cls = opts.danger ? ' class="ctx-danger"' : "";
        return '<button type="button" data-action="' + action + '"' + cls + ">" + escapeHtml(label) + "</button>";
    }

    function ctxMenuSep() {
        return '<div class="ctx-menu-sep" role="separator"></div>';
    }

    function buildContextMenuHtml(target) {
        let html = "";
        if (target.kind === "file") {
            const file = target.file;
            const isFav = settings.favorites.indexOf(file.path) >= 0;
            html += ctxMenuItem("preview", "Previsualizar");
            html += ctxMenuItem("timeline", "Añadir a timeline");
            html += ctxMenuItem("import", "Solo importar");
            html += ctxMenuSep();
            html += ctxMenuItem("reveal", "Mostrar en Explorer");
            html += ctxMenuItem("favorite", isFav ? "Quitar favorito" : "Marcar favorito");
            html += ctxMenuItem("copy-path", "Copiar ruta");
            html += ctxMenuSep();
            html += ctxMenuItem("rename", "Renombrar…");
            html += ctxMenuItem("delete", "Eliminar…", { danger: true });
        } else if (target.kind === "folder") {
            html += ctxMenuItem("reveal", "Mostrar en Explorer");
            html += ctxMenuSep();
            html += ctxMenuItem("rename", "Renombrar carpeta…");
            html += ctxMenuItem("unlink", "Desvincular");
            html += ctxMenuSep();
            html += ctxMenuItem("delete", "Eliminar carpeta…", { danger: true });
            html += ctxMenuSep();
            html += ctxMenuItem(
                "search-pin",
                isSearchPinned(target.libId, target.folderId)
                    ? "Quitar de búsqueda rápida"
                    : "Añadir a búsqueda rápida"
            );
        } else if (target.kind === "library") {
            html += ctxMenuItem("reveal", "Mostrar en Explorer");
            html += ctxMenuItem("rename", "Renombrar en panel…");
            html += ctxMenuItem("rescan", "Reescanear biblioteca");
            html += ctxMenuSep();
            html += ctxMenuItem("unlink", "Desvincular biblioteca", { danger: true });
            html += ctxMenuSep();
            html += ctxMenuItem(
                "search-pin",
                isSearchPinned(target.libId, null) ? "Quitar de búsqueda rápida" : "Añadir a búsqueda rápida"
            );
        }
        return html;
    }

    function showContextMenu(x, y, target) {
        if (!target) return;
        ctxTarget = target;
        const menu = $("ctx-menu");
        menu.innerHTML = buildContextMenuHtml(target);
        menu.classList.remove("is-hidden");
        menu.style.left = Math.min(x, window.innerWidth - 200) + "px";
        menu.style.top = Math.min(y, window.innerHeight - 240) + "px";
    }

    function hideContextMenu() {
        $("ctx-menu").classList.add("is-hidden");
        ctxTarget = null;
    }

    let dialogMode = null;
    let dialogResolve = null;

    function isDialogOpen() {
        const modal = $("dialog-modal");
        return modal && !modal.classList.contains("is-hidden");
    }

    function closeDialog(result) {
        $("dialog-modal").classList.add("is-hidden");
        $("dialog-input").classList.add("is-hidden");
        const resolve = dialogResolve;
        dialogResolve = null;
        dialogMode = null;
        if (resolve) resolve(result);
    }

    function showConfirm(opts) {
        opts = opts || {};
        return new Promise(function (resolve) {
            dialogResolve = resolve;
            dialogMode = "confirm";
            $("dialog-title").textContent = opts.title || "Confirmar";
            const msg = $("dialog-message");
            msg.textContent = opts.message || "";
            msg.classList.toggle("is-hidden", !opts.message);
            $("dialog-input").classList.add("is-hidden");
            $("dialog-cancel").textContent = opts.cancelLabel || "Cancelar";
            const confirmBtn = $("dialog-confirm");
            confirmBtn.textContent = opts.confirmLabel || "Confirmar";
            confirmBtn.className = opts.danger ? "btn-accent btn-danger" : "btn-accent";
            $("dialog-modal").classList.remove("is-hidden");
        });
    }

    function showPrompt(opts) {
        opts = opts || {};
        return new Promise(function (resolve) {
            dialogResolve = resolve;
            dialogMode = "prompt";
            $("dialog-title").textContent = opts.title || "Renombrar";
            const msg = $("dialog-message");
            if (opts.message) {
                msg.textContent = opts.message;
                msg.classList.remove("is-hidden");
            } else {
                msg.textContent = "";
                msg.classList.add("is-hidden");
            }
            const input = $("dialog-input");
            input.classList.remove("is-hidden");
            input.value = opts.value != null ? opts.value : "";
            input.placeholder = opts.placeholder || "";
            $("dialog-cancel").textContent = opts.cancelLabel || "Cancelar";
            $("dialog-confirm").textContent = opts.confirmLabel || "Guardar";
            $("dialog-confirm").className = "btn-accent";
            $("dialog-modal").classList.remove("is-hidden");
            setTimeout(function () {
                input.focus();
                input.select();
            }, 0);
        });
    }

    function submitDialog() {
        if (dialogMode === "prompt") {
            closeDialog($("dialog-input").value);
        } else {
            closeDialog(true);
        }
    }

    function bindDialog() {
        $("dialog-cancel").addEventListener("click", function () {
            closeDialog(dialogMode === "prompt" ? null : false);
        });
        $("dialog-confirm").addEventListener("click", submitDialog);
        $("dialog-input").addEventListener("keydown", function (e) {
            if (e.key === "Enter") {
                e.preventDefault();
                submitDialog();
            }
        });
        $("dialog-modal").addEventListener("click", function (e) {
            if (e.target === $("dialog-modal")) {
                closeDialog(dialogMode === "prompt" ? null : false);
            }
        });
    }

    function revealInExplorer(filePath, selectFile) {
        const { exec } = require("child_process");
        const safe = filePath.replace(/"/g, "");
        if (selectFile) {
            exec('explorer /select,"' + safe + '"', { windowsHide: true });
        } else {
            exec('explorer "' + safe + '"', { windowsHide: true });
        }
    }

    function folderAbsPath(libId, folderId) {
        const lib = cache.libraries[libId];
        if (!lib || !folderId) return null;
        return path.join(lib.path, folderId.replace(/\//g, path.sep));
    }

    function updateFavoritePath(oldPath, newPath) {
        const idx = settings.favorites.indexOf(oldPath);
        if (idx >= 0) {
            settings.favorites[idx] = newPath;
            Lib.writeSettings(settings);
        }
    }

    function removeFavoritePath(filePath) {
        const idx = settings.favorites.indexOf(filePath);
        if (idx >= 0) {
            settings.favorites.splice(idx, 1);
            Lib.writeSettings(settings);
        }
    }

    async function renameFileEntry(file) {
        const ext = path.extname(file.name);
        const base = path.basename(file.name, ext);
        const input = await showPrompt({
            title: "Renombrar archivo",
            value: base,
            confirmLabel: "Renombrar"
        });
        if (input == null) return;
        const trimmed = input.trim();
        if (!trimmed || trimmed === base) return;

        const newName = trimmed + ext;
        const newPath = path.join(path.dirname(file.path), newName);
        if (fs.existsSync(newPath)) {
            showToast("Ya existe un archivo con ese nombre", "error");
            return;
        }

        try {
            fs.renameSync(file.path, newPath);
        } catch (e) {
            showToast("No se pudo renombrar", "error");
            return;
        }

        updateFavoritePath(file.path, newPath);
        if (selectedAsset && selectedAsset.path === file.path) {
            selectedAsset = Object.assign({}, file, { name: newName, path: newPath });
        }
        dismissPreview();
        rescan();
        showToast("Archivo renombrado", "success");
    }

    async function deleteFileEntry(file) {
        const ok = await showConfirm({
            title: "Eliminar archivo",
            message:
                '¿Eliminar "' + file.name + '"?\n\nSe borrará permanentemente del disco.',
            confirmLabel: "Eliminar",
            danger: true
        });
        if (!ok) return;

        try {
            fs.unlinkSync(file.path);
        } catch (e) {
            showToast("No se pudo eliminar", "error");
            return;
        }

        removeFavoritePath(file.path);
        if (selectedAsset && selectedAsset.path === file.path) {
            dismissPreview();
            selectedAsset = null;
        }
        rescan();
        showToast("Archivo eliminado", "success");
    }

    async function renameFolderEntry(libId, folderId) {
        const abs = folderAbsPath(libId, folderId);
        if (!abs || !fs.existsSync(abs)) {
            showToast("Carpeta no encontrada", "error");
            return;
        }

        const oldName = path.basename(abs);
        const input = await showPrompt({
            title: "Renombrar carpeta",
            value: oldName,
            confirmLabel: "Renombrar"
        });
        if (input == null) return;
        const trimmed = input.trim();
        if (!trimmed || trimmed === oldName) return;

        const newAbs = path.join(path.dirname(abs), trimmed);
        if (fs.existsSync(newAbs)) {
            showToast("Ya existe una carpeta con ese nombre", "error");
            return;
        }

        try {
            fs.renameSync(abs, newAbs);
        } catch (e) {
            showToast("No se pudo renombrar la carpeta", "error");
            return;
        }

        const parentRel = path.dirname(folderId.replace(/\\/g, "/"));
        const newFolderId =
            !parentRel || parentRel === "." ? trimmed : parentRel + "/" + trimmed;

        if (activeFolderId === folderId) {
            activeFolderId = newFolderId;
        } else if (activeFolderId && activeFolderId.indexOf(folderId + "/") === 0) {
            activeFolderId = newFolderId + activeFolderId.slice(folderId.length);
        }

        if (settings.hiddenFolders && settings.hiddenFolders[libId]) {
            settings.hiddenFolders[libId] = settings.hiddenFolders[libId].map(function (h) {
                if (h === folderId) return newFolderId;
                if (h.indexOf(folderId + "/") === 0) return newFolderId + h.slice(folderId.length);
                return h;
            });
        }

        saveSettings();
        rescan();
        showToast("Carpeta renombrada", "success");
    }

    async function unlinkFolderEntry(libId, folderId) {
        const abs = folderAbsPath(libId, folderId);
        if (!abs || !fs.existsSync(abs)) {
            showToast("Carpeta no encontrada", "error");
            return;
        }

        const label = folderId.replace(/\//g, " / ");
        const ok = await showConfirm({
            title: "Desvincular carpeta",
            message:
                '¿Desvincular "' +
                label +
                '" del panel?\n\nLos archivos en disco no se borran.',
            confirmLabel: "Desvincular"
        });
        if (!ok) return;

        settings.hiddenFolders = settings.hiddenFolders || {};
        if (!settings.hiddenFolders[libId]) settings.hiddenFolders[libId] = [];
        const list = settings.hiddenFolders[libId];
        if (list.indexOf(folderId) < 0) list.push(folderId);

        if (
            activeLibraryId === libId &&
            (activeFolderId === folderId ||
                (activeFolderId && activeFolderId.indexOf(folderId + "/") === 0))
        ) {
            const parentRel = path.dirname(folderId.replace(/\\/g, "/"));
            activeFolderId = !parentRel || parentRel === "." ? null : parentRel;
        }

        Lib.writeSettings(settings);
        saveSettings();
        rescan();
        showToast("Carpeta desvinculada", "success");
    }

    async function deleteFolderEntry(libId, folderId) {
        const abs = folderAbsPath(libId, folderId);
        if (!abs || !fs.existsSync(abs)) {
            showToast("Carpeta no encontrada", "error");
            return;
        }

        const label = folderId.replace(/\//g, " / ");
        const ok = await showConfirm({
            title: "Eliminar carpeta",
            message:
                '¿Eliminar la carpeta "' +
                label +
                '" y todo su contenido?\n\nAcción permanente.',
            confirmLabel: "Eliminar",
            danger: true
        });
        if (!ok) return;

        try {
            if (fs.rmSync) {
                fs.rmSync(abs, { recursive: true, force: true });
            } else {
                deleteFolderRecursive(abs);
            }
        } catch (e) {
            showToast("No se pudo eliminar la carpeta", "error");
            return;
        }

        if (
            activeFolderId === folderId ||
            (activeFolderId && activeFolderId.indexOf(folderId + "/") === 0)
        ) {
            const parentRel = path.dirname(folderId.replace(/\\/g, "/"));
            activeFolderId = !parentRel || parentRel === "." ? null : parentRel;
        }

        if (settings.hiddenFolders && settings.hiddenFolders[libId]) {
            settings.hiddenFolders[libId] = settings.hiddenFolders[libId].filter(function (h) {
                return h !== folderId && h.indexOf(folderId + "/") !== 0;
            });
            if (!settings.hiddenFolders[libId].length) delete settings.hiddenFolders[libId];
        }

        saveSettings();
        rescan();
        showToast("Carpeta eliminada", "success");
    }

    function deleteFolderRecursive(dirPath) {
        const entries = fs.readdirSync(dirPath);
        entries.forEach(function (entry) {
            const full = path.join(dirPath, entry);
            if (fs.lstatSync(full).isDirectory()) deleteFolderRecursive(full);
            else fs.unlinkSync(full);
        });
        fs.rmdirSync(dirPath);
    }

    async function renameLibraryEntry(libId) {
        const folder = (settings.folders || []).find(function (f) {
            return f.id === libId;
        });
        if (!folder) return;

        const input = await showPrompt({
            title: "Renombrar biblioteca",
            message: "Solo cambia el nombre en el panel, no en disco.",
            value: folder.name || path.basename(folder.path),
            confirmLabel: "Guardar"
        });
        if (input == null) return;
        const trimmed = input.trim();
        if (!trimmed || trimmed === folder.name) return;

        folder.name = trimmed;
        Lib.writeSettings(settings);
        saveSettings();
        rescan();
        showToast("Biblioteca renombrada", "success");
    }

    async function unlinkLibraryEntry(libId) {
        const folder = (settings.folders || []).find(function (f) {
            return f.id === libId;
        });
        if (!folder) return;

        const ok = await showConfirm({
            title: "Desvincular biblioteca",
            message:
                '¿Desvincular "' +
                (folder.name || path.basename(folder.path)) +
                '" del panel?\n\nLos archivos en disco no se borran.',
            confirmLabel: "Desvincular",
            danger: true
        });
        if (!ok) return;

        settings.folders = (settings.folders || []).filter(function (f) {
            return f.id !== libId;
        });
        if (settings.hiddenFolders && settings.hiddenFolders[libId]) {
            delete settings.hiddenFolders[libId];
        }
        if (activeLibraryId === libId) {
            activeLibraryId = settings.folders[0] ? settings.folders[0].id : null;
            activeFolderId = null;
        }
        Lib.writeSettings(settings);
        saveSettings();
        rescan();
        showToast("Biblioteca desvinculada", "success");
    }

    function copyTextToClipboard(text) {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        try {
            document.execCommand("copy");
            showToast("Ruta copiada", "success");
        } catch (e) {
            showToast("No se pudo copiar", "error");
        }
        document.body.removeChild(ta);
    }

    function handleContextMenuAction(action) {
        const target = ctxTarget;
        hideContextMenu();
        if (!target) return;

        if (target.kind === "file") {
            const file = target.file;
            if (action === "preview") selectAsset(file);
            else if (action === "timeline") useAsset(file, true);
            else if (action === "import") useAsset(file, false);
            else if (action === "reveal") revealInExplorer(file.path, true);
            else if (action === "favorite") toggleFavorite(file.path);
            else if (action === "copy-path") copyTextToClipboard(file.path);
            else if (action === "rename") renameFileEntry(file);
            else if (action === "delete") deleteFileEntry(file);
            return;
        }

        if (target.kind === "folder") {
            const abs = folderAbsPath(target.libId, target.folderId);
            if (action === "reveal" && abs) revealInExplorer(abs, false);
            else if (action === "rename") renameFolderEntry(target.libId, target.folderId);
            else if (action === "unlink") unlinkFolderEntry(target.libId, target.folderId);
            else if (action === "delete") deleteFolderEntry(target.libId, target.folderId);
            else if (action === "search-pin") toggleSearchPin(target.libId, target.folderId);
            return;
        }

        if (target.kind === "library") {
            const lib = cache.libraries[target.libId];
            if (action === "reveal" && lib) revealInExplorer(lib.path, false);
            else if (action === "rename") renameLibraryEntry(target.libId);
            else if (action === "rescan") rescan();
            else if (action === "unlink") unlinkLibraryEntry(target.libId);
            else if (action === "search-pin") toggleSearchPin(target.libId, null);
        }
    }

    async function resolveProjectRoot() {
        const res = await hostRun("getProjectFolder", {});
        if (!res.ok || !res.path) return null;
        const folder = String(res.path).trim();
        if (!folder) return null;
        try {
            const resolved = path.resolve(folder.replace(/\//g, path.sep));
            if (fs.existsSync(resolved)) return resolved;
        } catch (e) {}
        return null;
    }

    async function prepareImportPath(file) {
        if (settings.copyToProjectFootage === false) {
            return { ok: true, path: file.path, copied: false };
        }
        if (file.type === "preset" || file.type === "project") {
            return { ok: true, path: file.path, copied: false };
        }
        const projectRoot = await resolveProjectRoot();
        if (!projectRoot) {
            return { ok: false, error: "save_project_first" };
        }
        return Project.copyToProjectFootage(file.path, projectRoot);
    }

    async function useAsset(file, addToTimeline) {
        if (useAssetBusy) return;
        if (!file || !fs.existsSync(file.path)) {
            showToast("Archivo no encontrado", "error");
            return;
        }

        useAssetBusy = true;
        try {
            setLoading(true, "Preparando archivo…");
            const prep = await prepareImportPath(file);
            if (!prep.ok) {
                setLoading(false);
                showToast(errorMessage(prep.error), "error");
                return;
            }

            const importPath = prep.path;
            const toTimeline = addToTimeline && settings.addToTimeline !== false;
            const pathArg = importPath.replace(/\\/g, "/");
            const sourceArg = file.path.replace(/\\/g, "/");

            let res;

            if (hostInfo.isPPRO && toTimeline) {
                setLoading(true, "Importando…");
                const importRes = await hostRun("importMedia", {
                    path: pathArg,
                    sourcePath: sourceArg,
                    addToTimeline: false
                });

                if (!importRes.ok) {
                    setLoading(false);
                    if (prep.copied && prep.path && fs.existsSync(prep.path)) {
                        try {
                            fs.unlinkSync(prep.path);
                        } catch (cleanupErr) {}
                    }
                    showToast(errorMessage(importRes.error), "error");
                    return;
                }

                setLoading(true, "Añadiendo a timeline…");
                const insertRes = await hostRun("insertToTimeline", {
                    path: pathArg,
                    sourcePath: sourceArg,
                    nodeId: importRes.nodeId || ""
                });
                setLoading(false);

                res = {
                    ok: true,
                    name: importRes.name || insertRes.name || file.name,
                    alreadyImported: !!importRes.alreadyImported,
                    addedToTimeline: !!(insertRes.ok && insertRes.addedToTimeline)
                };

                if (!insertRes.ok) {
                    res.timelineError = insertRes.error || "insert_failed";
                }
            } else {
                setLoading(true, toTimeline ? "Añadiendo a timeline…" : "Importando…");
                const importPayload = {
                    path: pathArg,
                    sourcePath: sourceArg,
                    addToTimeline: toTimeline
                };
                if (hostInfo.isAE && toTimeline) {
                    importPayload.layerIndex = aeInsertLayerIndex;
                }
                res = await hostRun("importMedia", importPayload);
                setLoading(false);

                if (!res.ok) {
                    if (prep.copied && prep.path && fs.existsSync(prep.path)) {
                        try {
                            fs.unlinkSync(prep.path);
                        } catch (cleanupErr) {}
                    }
                    showToast(errorMessage(res.error), "error");
                    return;
                }
            }

            const label = res.name || file.name;

            if (toTimeline && !res.addedToTimeline) {
                let msg = (res.alreadyImported ? "Ya estaba importado · " : "Importado: ") + label + " · no se pudo añadir al timeline";
                if (prep.copied && prep.message === "copied") {
                    msg = "Copiado a (Footage)/" + prep.subfolder + " · " + msg;
                }
                showToast(msg, "error");
                return;
            }

            let msg;
            if (res.alreadyImported) {
                msg = res.addedToTimeline
                    ? "Ya estaba importado · añadido al timeline: " + label
                    : "Ya estaba importado: " + label;
            } else {
                msg = (res.addedToTimeline ? "Añadido: " : "Importado: ") + label;
            }
            if (prep.copied && prep.message === "copied") {
                msg = "Copiado a (Footage)/" + prep.subfolder + " · " + msg;
            }
            showToast(msg, "success");
        } finally {
            useAssetBusy = false;
        }
    }

    function errorMessage(code) {
        const map = {
            no_project: "Abre un proyecto primero",
            save_project_first: "Guarda el proyecto (.aep / .prproj) antes de importar",
            no_active_comp: "Abre una composición activa (AE)",
            no_active_sequence: "Abre una secuencia activa (Premiere)",
            select_layer: "Selecciona una capa para preset",
            file_not_found: "Archivo no encontrado",
            import_failed: "No se pudo importar",
            insert_failed: "No se pudo insertar en timeline",
            item_not_found: "Clip importado no encontrado en el proyecto",
            ffx_not_supported_ppro: "Presets .ffx solo en After Effects",
            script_error: "Error de script — reinicia el panel"
        };
        return map[code] || code || "Error desconocido";
    }

    function rescan() {
        setLoading(true, "Escaneando…");
        invalidateSearchState();
        cache = Lib.scanAllLibraries(settings);
        if (!activeLibraryId && Object.keys(cache.libraries).length) {
            activeLibraryId = Object.keys(cache.libraries)[0];
        }
        setLoading(false);
        renderAll();
    }

    function addLibraryFolder(folderPath) {
        if (!folderPath || !fs.existsSync(folderPath)) {
            showToast("Ruta no válida", "error");
            return false;
        }

        try {
            if (!fs.lstatSync(folderPath).isDirectory()) {
                showToast("Debe ser una carpeta", "error");
                return false;
            }
        } catch (e) {
            showToast("No se puede acceder a la carpeta", "error");
            return false;
        }

        const id = Lib.libraryId(folderPath);
        if ((settings.folders || []).some((f) => f.path === folderPath)) {
            showToast("Esta carpeta ya está vinculada", "error");
            return false;
        }

        settings.folders = settings.folders || [];
        settings.folders.push({
            id: id,
            name: path.basename(folderPath),
            path: folderPath
        });
        activeLibraryId = id;
        activeFolderId = null;
        ensureCategoryExpanded(id);
        expandedNodes.add(treeKey(id, "__lib__"));
        Lib.writeSettings(settings);
        saveSettings();
        rescan();
        showToast("Carpeta vinculada", "success");
        return true;
    }

    /* ─── Custom link browser (no Windows dialog) ─── */

    function getQuickPaths() {
        const home = os.homedir();
        return [
            { label: "Inicio", path: home },
            { label: "Escritorio", path: path.join(home, "Desktop") },
            { label: "Documentos", path: path.join(home, "Documents") },
            { label: "Descargas", path: path.join(home, "Downloads") },
            { label: "Música", path: path.join(home, "Music") },
            { label: "Videos", path: path.join(home, "Videos") }
        ].filter((q) => fs.existsSync(q.path));
    }

    function renderQuickLinks() {
        const wrap = $("link-quick");
        wrap.innerHTML = "";
        getQuickPaths().forEach((q) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "quick-link";
            btn.textContent = q.label;
            btn.addEventListener("click", () => browseTo(q.path));
            wrap.appendChild(btn);
        });
    }

    function browseTo(dirPath) {
        if (!dirPath || !fs.existsSync(dirPath)) return;
        try {
            if (!fs.lstatSync(dirPath).isDirectory()) return;
        } catch (e) {
            return;
        }
        linkBrowsePath = path.resolve(dirPath);
        $("link-path-input").value = linkBrowsePath;
        renderLinkBrowser();
    }

    function renderLinkBrowser() {
        $("link-crumb").textContent = shortenPath(linkBrowsePath);
        $("link-selected-path").textContent = shortenPath(linkBrowsePath);
        $("link-confirm").disabled = false;

        const list = $("link-list");
        list.innerHTML = "";

        const parent = path.dirname(linkBrowsePath);
        if (parent && parent !== linkBrowsePath) {
            const li = document.createElement("li");
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "parent";
            btn.textContent = "⬆ Carpeta superior";
            btn.addEventListener("click", () => browseTo(parent));
            li.appendChild(btn);
            list.appendChild(li);
        }

        let entries = [];
        try {
            entries = fs.readdirSync(linkBrowsePath, { withFileTypes: true });
        } catch (e) {
            list.innerHTML = "<li><span style='padding:8px;color:#8b8b98'>Sin acceso</span></li>";
            return;
        }

        entries
            .filter((e) => e.isDirectory() && (settings.showHidden || !e.name.startsWith(".")))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
            .forEach((entry) => {
                const li = document.createElement("li");
                const btn = document.createElement("button");
                btn.textContent = "📁 " + entry.name;
                btn.addEventListener("click", () => browseTo(path.join(linkBrowsePath, entry.name)));
                btn.addEventListener("dblclick", (e) => {
                    e.preventDefault();
                    browseTo(path.join(linkBrowsePath, entry.name));
                });
                li.appendChild(btn);
                list.appendChild(li);
            });

        if (!list.children.length) {
            list.innerHTML = "<li><span style='padding:8px;color:#8b8b98'>Sin subcarpetas</span></li>";
        }
    }

    function openLinkModal() {
        linkBrowsePath = os.homedir();
        $("link-path-input").value = linkBrowsePath;
        renderQuickLinks();
        renderLinkBrowser();
        $("link-modal").classList.remove("is-hidden");
    }

    function closeLinkModal() {
        $("link-modal").classList.add("is-hidden");
    }

    function confirmLink() {
        if (addLibraryFolder(linkBrowsePath)) closeLinkModal();
    }

    /* ─── Drag & drop ─── */

    function showDropOverlay(mode) {
        $("drop-overlay").classList.remove("is-hidden");
        $("drop-sub").textContent =
            mode === "folder"
                ? "Suelta para vincular carpeta a la biblioteca"
                : "Suelta archivos para importar al timeline";
    }

    function hideDropOverlaySoon() {
        clearTimeout(dragTimer);
        dragTimer = setTimeout(() => {
            if (dragDepth <= 0) $("drop-overlay").classList.add("is-hidden");
        }, 180);
    }

    function processDrop(paths) {
        const classified = Drop.classifyPaths(paths);

        if (classified.folders.length) {
            classified.folders.forEach((f) => addLibraryFolder(f));
        }

        const mediaFiles = classified.files.filter((f) => Lib.isSupportedFile(path.basename(f)));
        if (mediaFiles.length) {
            mediaFiles.forEach((f, i) => {
                setTimeout(() => useAsset({ path: f, name: path.basename(f), type: Lib.getFileType(Lib.getExt(path.basename(f))) }, true), i * 200);
            });
        }

        if (!classified.folders.length && !mediaFiles.length && paths.length) {
            showToast("Suelta carpetas o archivos de media compatibles", "error");
        }
    }

    function bindDropTarget(el, onDropClass) {
        if (!el) return;

        ["dragenter", "dragover"].forEach((ev) => {
            el.addEventListener(ev, (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!Drop.hasFileDragPayload(e)) return;
                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = "link";
                    if (e.dataTransfer.files && e.dataTransfer.files.length) {
                        pendingDropFiles = e.dataTransfer.files;
                    }
                }
                el.classList.add(onDropClass || "dragover");
            });
        });

        ["dragleave", "drop"].forEach((ev) => {
            el.addEventListener(ev, (e) => {
                e.preventDefault();
                e.stopPropagation();
                el.classList.remove(onDropClass || "dragover");
            });
        });

        el.addEventListener("drop", (e) => {
            e.preventDefault();
            e.stopPropagation();
            const paths = Drop.extractPathsFromDataTransfer(e.dataTransfer);
            if (paths.length) processDrop(paths);
            pendingDropFiles = null;
        });
    }

    function handlePanelDrop(e) {
        if (!Drop.hasFileDragPayload(e) && !Drop.hasInternalDragPath()) return;

        e.preventDefault();
        e.stopPropagation();

        dragDepth = 0;
        $("drop-overlay").classList.add("is-hidden");

        let paths = Drop.extractPathsFromDataTransfer(e.dataTransfer);
        if (!paths.length) {
            const internal = Drop.consumeInternalDragPath();
            if (internal) paths = [internal];
        } else {
            Drop.consumeInternalDragPath();
        }

        if (paths.length) {
            processDrop(paths);
        } else {
            showToast("No se pudo leer el archivo soltado", "error");
        }
        pendingDropFiles = null;
    }

    function bindPanelDrop() {
        const app = $("app");
        const overlay = $("drop-overlay");

        app.addEventListener("dragenter", (e) => {
            if (!Drop.hasFileDragPayload(e) && !Drop.hasInternalDragPath()) return;
            e.preventDefault();
            dragDepth++;
            showDropOverlay("mixed");
            clearTimeout(dragTimer);
        });

        app.addEventListener("dragover", (e) => {
            if (!Drop.hasFileDragPayload(e) && !Drop.hasInternalDragPath()) return;
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
            clearTimeout(dragTimer);
        });

        app.addEventListener("dragleave", (e) => {
            if (!Drop.hasFileDragPayload(e) && !Drop.hasInternalDragPath()) return;
            e.preventDefault();
            dragDepth = Math.max(0, dragDepth - 1);
            if (dragDepth === 0) hideDropOverlaySoon();
        });

        document.addEventListener("drop", handlePanelDrop, true);
        document.addEventListener(
            "dragover",
            function (e) {
                if (!Drop.hasFileDragPayload(e) && !Drop.hasInternalDragPath()) return;
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
            },
            true
        );

        if (overlay) {
            overlay.addEventListener("dragover", (e) => {
                if (!Drop.hasFileDragPayload(e) && !Drop.hasInternalDragPath()) return;
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
            });
            overlay.addEventListener("drop", handlePanelDrop);
        }
    }

    function renderSearchPins() {
        const list = $("settings-search-pins");
        if (!list) return;
        list.innerHTML = "";
        const pins = settings.searchPins || [];
        if (!pins.length) {
            const li = document.createElement("li");
            li.className = "folder-list-item";
            li.textContent = "Sin carpetas — busca en toda la biblioteca activa.";
            list.appendChild(li);
            return;
        }
        pins.forEach(function (pin, idx) {
            const li = document.createElement("li");
            li.className = "folder-list-item";
            li.innerHTML = "<span>🔍 " + escapeHtml(pin.label || searchPinLabel(pin.libId, pin.folderId)) + "</span>";
            const del = document.createElement("button");
            del.type = "button";
            del.className = "icon-btn";
            del.style.width = "24px";
            del.style.height = "24px";
            del.textContent = "✕";
            del.addEventListener("click", function () {
                settings.searchPins.splice(idx, 1);
                Lib.writeSettings(settings);
                renderSearchPins();
                if (searchQuery) renderAssets();
            });
            li.appendChild(del);
            list.appendChild(li);
        });
    }

    function renderSettingsFolders() {
        const list = $("settings-folders");
        list.innerHTML = "";
        (settings.folders || []).forEach((folder, idx) => {
            const li = document.createElement("li");
            li.className = "folder-list-item";
            li.innerHTML =
                '<span title="' +
                escapeHtml(folder.path) +
                '">🔗 ' +
                escapeHtml(folder.name || path.basename(folder.path)) +
                "</span>";
            const del = document.createElement("button");
            del.type = "button";
            del.className = "icon-btn";
            del.style.width = "24px";
            del.style.height = "24px";
            del.textContent = "✕";
            del.addEventListener("click", () => {
                const libId = folder.id;
                settings.folders.splice(idx, 1);
                if (libId && settings.hiddenFolders && settings.hiddenFolders[libId]) {
                    delete settings.hiddenFolders[libId];
                }
                Lib.writeSettings(settings);
                rescan();
                renderSettingsFolders();
            });
            li.appendChild(del);
            list.appendChild(li);
        });
    }

    function bindEvents() {
        bindDialog();

        $("folder-tree").addEventListener("contextmenu", function (e) {
            const folderEl = e.target.closest("[data-action='folder']");
            const libRootEl = e.target.closest("[data-action='libroot']");
            if (!folderEl && !libRootEl) return;
            e.preventDefault();
            if (folderEl) {
                showContextMenu(e.clientX, e.clientY, {
                    kind: "folder",
                    libId: folderEl.dataset.lib,
                    folderId: folderEl.dataset.node
                });
            } else {
                showContextMenu(e.clientX, e.clientY, {
                    kind: "library",
                    libId: libRootEl.dataset.lib
                });
            }
        });

        $("folder-tree").addEventListener("click", function (e) {
            const toggleEl = e.target.closest("[data-action='toggle']");
            if (toggleEl) {
                e.stopPropagation();
                toggleExpanded(toggleEl.dataset.lib, toggleEl.dataset.node);
                return;
            }

            const folderEl =
                e.target.closest("[data-action='folder'], [data-action='libroot']") ||
                (function () {
                    const row = e.target.closest(".mv-tree-row");
                    if (!row || row.classList.contains("mv-tree-cat")) return null;
                    return row.querySelector("[data-action='folder'], [data-action='libroot']");
                })();

            if (folderEl && folderEl.dataset.action === "folder") {
                if (activeLibraryId !== folderEl.dataset.lib) invalidateSearchState();
                activeLibraryId = folderEl.dataset.lib;
                activeFolderId = folderEl.dataset.node;
                ensureExpandedPath(activeLibraryId, activeFolderId);
                saveSettings();
                renderAll();
                return;
            }

            if (folderEl && folderEl.dataset.action === "libroot") {
                if (activeLibraryId !== folderEl.dataset.lib) invalidateSearchState();
                activeLibraryId = folderEl.dataset.lib;
                activeFolderId = null;
                ensureCategoryExpanded(activeLibraryId);
                expandedNodes.add(treeKey(activeLibraryId, "__lib__"));
                saveSettings();
                renderAll();
            }
        });

        $("btn-link-folder").addEventListener("click", openLinkModal);
        $("btn-link-welcome").addEventListener("click", openLinkModal);
        $("btn-settings-link").addEventListener("click", openLinkModal);
        $("btn-link-close").addEventListener("click", closeLinkModal);
        $("link-confirm").addEventListener("click", confirmLink);

        $("link-path-go").addEventListener("click", () => {
            const v = Drop.normalizePath($("link-path-input").value.trim());
            if (v) browseTo(v);
        });

        $("link-path-input").addEventListener("keydown", (e) => {
            if (e.key === "Enter") $("link-path-go").click();
        });

        bindDropTarget($("link-drop"), "dragover");
        bindDropTarget($("welcome-drop"), "dragover");
        bindPanelDrop();

        $("btn-settings").addEventListener("click", () => {
            renderSettingsFolders();
            renderSearchPins();
            $("settings-drawer").classList.remove("is-hidden");
        });
        $("btn-close-settings").addEventListener("click", () => {
            $("settings-drawer").classList.add("is-hidden");
        });

        $("search-input").addEventListener("input", (e) => {
            const next = e.target.value.trim();
            if (next === searchQuery) return;
            searchQuery = next;
            if (!searchQuery) invalidateSearchState();
            scheduleSearchRender();
        });

        $("search-input").addEventListener("keydown", (e) => {
            if (e.key === "Escape" && searchQuery) {
                e.preventDefault();
                $("search-input").value = "";
                searchQuery = "";
                invalidateSearchState();
                scheduleSearchRender();
            }
        });

        $("view-list").addEventListener("click", function () {
            viewMode = "list";
            saveSettings();
            renderAssets();
            syncViewUi();
        });

        $("view-grid").addEventListener("click", function () {
            setIconView(thumbSize || 180);
        });

        document.querySelectorAll(".size-btn").forEach(function (btn) {
            btn.addEventListener("click", function (e) {
                e.stopPropagation();
                setIconView(parseInt(btn.dataset.size, 10) || 180);
            });
        });

        $("btn-favorites").addEventListener("click", () => {
            showFavoritesOnly = !showFavoritesOnly;
            $("btn-favorites").classList.toggle("active", showFavoritesOnly);
            syncViewUi();
            renderAssets();
        });

        $("opt-add-timeline").addEventListener("change", (e) => {
            settings.addToTimeline = e.target.checked;
            Lib.writeSettings(settings);
        });

        $("opt-copy-footage").addEventListener("change", (e) => {
            settings.copyToProjectFootage = e.target.checked;
            Lib.writeSettings(settings);
        });

        $("opt-scan-subfolders").addEventListener("change", (e) => {
            settings.scanSubfolders = e.target.checked;
            Lib.writeSettings(settings);
        });

        $("opt-hover-preview").addEventListener("change", (e) => {
            settings.hoverPreview = e.target.checked;
            Lib.writeSettings(settings);
        });

        $("btn-rescan").addEventListener("click", () => {
            rescan();
            showToast("Biblioteca actualizada", "success");
        });

        $("btn-preview-use").addEventListener("click", () => {
            if (selectedAsset) useAsset(selectedAsset, true);
        });

        $("btn-preview-import").addEventListener("click", () => {
            if (selectedAsset) useAsset(selectedAsset, false);
        });

        $("btn-preview-close").addEventListener("click", dismissPreview);

        $("btn-toggle-sidebar").addEventListener("click", function () {
            toggleSidebar();
        });

        document.addEventListener("keydown", function (e) {
            if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "b" || e.key === "B")) {
                if (isDialogOpen()) return;
                e.preventDefault();
                toggleSidebar();
                return;
            }

            if (e.key !== "Escape") return;

            if (isDialogOpen()) {
                closeDialog(dialogMode === "prompt" ? null : false);
                return;
            }

            if (e.target.closest("input, textarea, select")) return;

            if (!$("ctx-menu").classList.contains("is-hidden")) {
                hideContextMenu();
                return;
            }
            if (!$("link-modal").classList.contains("is-hidden")) {
                closeLinkModal();
                return;
            }
            if (!$("settings-drawer").classList.contains("is-hidden")) {
                $("settings-drawer").classList.add("is-hidden");
                return;
            }

            dismissPreview();
        });

        Drop.bindAssetDrag($("preview-info"), function () {
            return selectedAsset && selectedAsset.path ? selectedAsset.path : "";
        }, function (e, filePath) {
            if (!shouldInsertOnDragEnd(e, filePath)) return;
            useAsset(fileFromPath(filePath), true);
        });

        $("ctx-menu").addEventListener("click", (e) => {
            const btn = e.target.closest("[data-action]");
            if (!btn || !ctxTarget) return;
            handleContextMenuAction(btn.dataset.action);
        });

        document.addEventListener("click", (e) => {
            if (!$("ctx-menu").contains(e.target)) hideContextMenu();
        });

        window.addEventListener("resize", () => {
            clearTimeout(window._mvResize);
            window._mvResize = setTimeout(function () {
                if (isIconView() && iconGridVirt) relayoutIconGrid(true);
                else if (isIconView()) renderAssets();
            }, 200);
        });
    }

    async function init() {
        bindEvents();
        mountToolbarIcons();
        syncSidebarUi();
        bindPreviewWaveResize();

        await ensureHostScript();
        hostInfo = await hostRun("getHostInfo", {});
        if (!hostInfo || hostInfo.error) {
            hostInfo = parseJson(await evalScript("mvGetHostInfo()"), hostInfo);
        }
        syncHostInfoFromEnv();
        if (hostInfo.isAE) {
            startAELayerIndexPoll();
            bindAEInsertLayerCapture();
        }
        $("host-label").textContent = hostInfo.isPPRO
            ? "Premiere Pro"
            : hostInfo.isAE
              ? "After Effects"
              : "Biblioteca";

        if (viewMode === "grid") viewMode = "icons-m";
        if (!isIconView()) thumbSize = settings.thumbSize || 140;
        else if (!settings.thumbSize) thumbSize = viewThumbSize(viewMode);

        $("opt-add-timeline").checked = settings.addToTimeline !== false;
        $("opt-copy-footage").checked = settings.copyToProjectFootage !== false;
        $("opt-scan-subfolders").checked = settings.scanSubfolders !== false;
        $("opt-hover-preview").checked = settings.hoverPreview !== false;

        activeFolderId = settings.lastFolder || null;

        if (settings.folders && settings.folders.length) {
            const stale = !cache.scannedAt || Date.now() - cache.scannedAt > 300000;
            if (stale || !Object.keys(cache.libraries).length) {
                cache = Lib.scanAllLibraries(settings);
            }
        }

        Object.keys(cache.libraries).forEach(function (id) {
            Lib.prepareLibrarySearchIndex(cache.libraries[id]);
        });

        expandedNodes.forEach(function (key) {
            const parts = key.split("::");
            if (parts.length === 2 && parts[1] === "__lib__" && parts[0] !== "__cat__" && cache.libraries[parts[0]]) {
                expandedNodes.add(treeKey("__cat__", libraryCategoryId(parts[0])));
            }
        });

        if (settings.lastLibraryId && cache.libraries[settings.lastLibraryId]) {
            activeLibraryId = settings.lastLibraryId;
        } else if (Object.keys(cache.libraries).length) {
            activeLibraryId = Object.keys(cache.libraries)[0];
        }

        if (activeLibraryId) {
            if (!expandedNodes.size) {
                ensureCategoryExpanded(activeLibraryId);
                expandedNodes.add(treeKey(activeLibraryId, "__lib__"));
            }
            if (activeFolderId) ensureExpandedPath(activeLibraryId, activeFolderId);
        }

        syncViewUi();
        renderAll();
        updateStatusHint();
    }

    function updateStatusHint() {
        const hint = $("status-hint");
        if (!hint) return;
        const dragHint =
            hostInfo.isPPRO || hostInfo.isAE
                ? "Arrastrar → suelta en timeline"
                : "Arrastrar → timeline";
        hint.textContent =
            dragHint +
            " · Doble clic → timeline · Ctrl+B → biblioteca · Esc → cerrar preview · Video: clic + mover ←→";
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
