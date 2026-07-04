/**
 * CompVault — UI estilo MediaVault
 */
(function () {
    const cs = new CSInterface();
    const Lib = CompVaultLibrary;
    const Icons = CompVaultIcons;
    const path = Lib.path;
    const fs = Lib.fs;
    const os = require("os");

    let settings = Lib.readSettings();
    let libraryRoot = "";
    let searchQuery = "";
    let activeFilter = "all";
    let activeCategory = "__ALL__";
    let multiSelectMode = false;
    let multiSelected = [];
    let viewMode = settings.viewMode || "grid";
    let gridSize = settings.gridSize || 180;
    let showFavoritesOnly = false;
    let selectionCache = null;
    let selectedAsset = null;
    let renameTarget = null;
    let ctxTarget = null;
    let typeFilterExpanded = settings.typeFilterExpanded !== false;
    let linkBrowsePath = os.homedir();
    const thumbRegenAttempted = new Set();
    let dialogMode = null;
    let dialogResolve = null;

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
        return evalScript(fnName + "(" + args.map((a) => JSON.stringify(String(a))).join(",") + ")");
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

    function escapeHtml(s) {
        return String(s)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function vaultKeyFor(filePath) {
        return Lib.vaultKeyForPath(filePath);
    }

    function currentSaveCategory() {
        const sel = $("save-category");
        const val = sel ? sel.value : "";
        return val || settings.lastCategory || Lib.DEFAULT_CATEGORY;
    }

    function populateSaveCategories() {
        const sel = $("save-category");
        if (!sel || !libraryRoot) return;
        const cats = Lib.listCategories(libraryRoot, Lib.listAllAssets(libraryRoot));
        const active = settings.lastCategory || Lib.DEFAULT_CATEGORY;
        sel.innerHTML = cats
            .map((c) => '<option value="' + escapeHtml(c) + '">' + escapeHtml(c) + "</option>")
            .join("");
        if (cats.indexOf(active) >= 0) sel.value = active;
        else sel.value = cats[0] || Lib.DEFAULT_CATEGORY;
    }

    function renderCategoryTabs() {
        const bar = $("category-tabs");
        if (!bar) return;
        if (!Lib.isLinked(settings)) {
            bar.classList.add("is-hidden");
            bar.innerHTML = "";
            return;
        }
        const assets = Lib.filterAssets(Lib.listAllAssets(libraryRoot), activeFilter, "");
        const cats = Lib.listCategories(libraryRoot, assets);
        const order = settings.categoryOrder || [];
        cats.sort((a, b) => {
            const ia = order.indexOf(a);
            const ib = order.indexOf(b);
            return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
        });

        bar.classList.remove("is-hidden");
        const allCount = assets.length;
        let html =
            '<button type="button" class="category-tab' +
            (activeCategory === "__ALL__" ? " active" : "") +
            '" data-cat="__ALL__">ALL (' +
            allCount +
            ")</button>";
        cats.forEach((c) => {
            const count = assets.filter((a) => (a.category || Lib.DEFAULT_CATEGORY) === c).length;
            html +=
                '<button type="button" class="category-tab' +
                (activeCategory === c ? " active" : "") +
                '" data-cat="' +
                escapeHtml(c) +
                '">' +
                escapeHtml(c) +
                " (" +
                count +
                ")</button>";
        });
        bar.innerHTML = html;
        bar.querySelectorAll(".category-tab").forEach((btn) => {
            btn.addEventListener("click", () => {
                activeCategory = btn.dataset.cat;
                renderCategoryTabs();
                renderAssets();
            });
        });
    }

    function thumbSrc(asset) {
        if (!asset.preview || asset.preview.startsWith("builtin:")) return "";
        return Lib.imageDataUrl(asset.preview);
    }

    function isUglyInternalName(name) {
        return /^CV_Layers_\d+$/.test(name || "");
    }

    function displayNameFor(asset) {
        const d = asset.displayName || asset.name || "Sin nombre";
        return isUglyInternalName(d) ? asset.sourceCompName || "Capas guardadas" : d;
    }

    function defaultSaveName(type) {
        if (!selectionCache || !selectionCache.ok) return "";
        const cn = selectionCache.comp.name;
        if (type === "comp") return cn;
        if (type === "layers") return cn + " — capas";
        if (type === "preset") return selectionCache.effectName || "Preset";
        return cn;
    }

    function assetMetaLine(asset) {
        if (asset.type === "preset") return "Preset FFX";
        const parts = [];
        if (asset.width) parts.push(asset.width + "×" + asset.height);
        if (asset.duration) parts.push(Lib.formatDuration(asset.duration));
        if (asset.frameRate) parts.push(Math.round(asset.frameRate) + " fps");
        return parts.join(" · ") || "—";
    }

    function refreshLibraryRoot() {
        libraryRoot = Lib.isLinked(settings) ? Lib.getLibraryRoot(settings) : "";
    }

    function saveSettingsPatch(patch) {
        settings = Object.assign(settings, patch);
        Lib.writeSettings(settings);
    }

    function mountToolbarIcons() {
        const linkSlot = $("btn-link-icon");
        if (linkSlot) linkSlot.innerHTML = Icons.html("link");
        const saveBtn = $("btn-save-open");
        if (saveBtn) saveBtn.innerHTML = Icons.html("save");
        const settingsBtn = $("btn-settings");
        if (settingsBtn) settingsBtn.innerHTML = Icons.html("settings");
        $("btn-toggle-sidebar").innerHTML = Icons.html("sidebar");
        $("view-list").innerHTML = Icons.html("list");
        $("view-grid").innerHTML = Icons.html("grid");
        const favBtn = $("btn-favorites");
        if (favBtn) favBtn.innerHTML = Icons.starHtml(showFavoritesOnly);
        const applyBtn = $("btn-preview-apply");
        if (applyBtn) applyBtn.innerHTML = Icons.html("timeline");
        const reimportBtn = $("btn-preview-reimport");
        if (reimportBtn) reimportBtn.innerHTML = Icons.html("importIn");
        const multiBtn = $("btn-multi-select");
        if (multiBtn) multiBtn.innerHTML = Icons.html("multiSelect");
        const exportBtn = $("btn-export-pack");
        if (exportBtn) exportBtn.innerHTML = Icons.html("packExport");
        const importBtn = $("btn-import-pack");
        if (importBtn) importBtn.innerHTML = Icons.html("packImport");
    }

    function isMultiSelected(asset) {
        return multiSelected.some((a) => a.folder === asset.folder);
    }

    function toggleMultiSelected(asset) {
        const idx = multiSelected.findIndex((a) => a.folder === asset.folder);
        if (idx === -1) multiSelected.push(asset);
        else multiSelected.splice(idx, 1);
        syncMultiSelectUi();
        renderAssets();
    }

    function syncMultiSelectUi() {
        const btn = $("btn-multi-select");
        if (btn) btn.classList.toggle("active", multiSelectMode);
        $("status-hint").textContent = multiSelectMode
            ? "Multiselección: clic = marcar · IMPORT (" + multiSelected.length + ")"
            : "Clic = seleccionar · Doble clic = aplicar · Ctrl+B = biblioteca";
    }

    function toggleMultiSelectMode() {
        multiSelectMode = !multiSelectMode;
        if (!multiSelectMode) multiSelected = [];
        syncMultiSelectUi();
        renderAssets();
    }

    async function applySelectedBatch() {
        if (!multiSelected.length) {
            showToast("No hay elementos seleccionados", "error");
            return;
        }
        setLoading(true, "Importando lote…");
        let ok = 0;
        for (const asset of multiSelected) {
            const filePath = asset.filePath || path.join(asset.folder, asset.fileName || "");
            if (!fs.existsSync(filePath)) continue;
            const fn = settings.addToTimeline !== false ? "cvApplyToTimeline" : "cvApplyLibraryItem";
            const res = parseJson(
                await jsxCall(fn, [
                    filePath,
                    asset.vaultKey || vaultKeyFor(filePath),
                    "false",
                    displayNameFor(asset),
                    asset.type || "comp",
                    settings.organizeProject !== false ? "true" : "false"
                ]),
                {}
            );
            if (res.ok) ok++;
        }
        setLoading(false);
        showToast("Importados " + ok + " / " + multiSelected.length, ok ? "success" : "error");
        multiSelectMode = false;
        multiSelected = [];
        syncMultiSelectUi();
        renderAssets();
    }

    function pickSaveDialog(defaultName) {
        return new Promise((resolve) => {
            if (window.cep && window.cep.fs && window.cep.fs.showSaveDialogEx) {
                const r = window.cep.fs.showSaveDialogEx("", defaultName, ["cvpack", "flexpack", "zip"]);
                if (r.err === 0 && r.data) resolve(r.data);
                else resolve("");
            } else if (window.cep && window.cep.fs && window.cep.fs.showSaveDialog) {
                const r = window.cep.fs.showSaveDialog(defaultName, "");
                if (r.err === 0 && r.data) resolve(r.data);
                else resolve("");
            } else {
                showPrompt({
                    title: "Exportar pack",
                    message: "Ruta completa del archivo .cvpack",
                    value: path.join(libraryRoot, defaultName + ".cvpack"),
                    confirmLabel: "Exportar"
                }).then(resolve);
            }
        });
    }

    function pickOpenPackDialog() {
        return new Promise((resolve) => {
            if (window.cep && window.cep.fs && window.cep.fs.showOpenDialogEx) {
                const r = window.cep.fs.showOpenDialogEx(false, false, "Importar pack", "", ["cvpack", "flexpack", "zip"], false);
                if (r.err === 0 && r.data && r.data.length) resolve(r.data[0]);
                else resolve("");
            } else if (window.cep && window.cep.fs && window.cep.fs.showOpenDialog) {
                const r = window.cep.fs.showOpenDialog(false, false);
                if (r.err === 0 && r.data && r.data.length) resolve(r.data[0]);
                else resolve("");
            } else {
                showPrompt({
                    title: "Importar pack",
                    message: "Ruta del archivo .flexpack / .cvpack",
                    value: "",
                    confirmLabel: "Importar"
                }).then(resolve);
            }
        });
    }

    async function exportCurrentCategoryPack() {
        if (!Lib.isLinked(settings)) {
            showToast("Vincula una carpeta primero", "error");
            return;
        }
        if (activeCategory === "__ALL__") {
            showToast("Elige una categoría concreta (no ALL)", "error");
            return;
        }
        const dest = await pickSaveDialog(activeCategory);
        if (!dest) return;
        const outPath = /\.(cvpack|flexpack|zip)$/i.test(dest) ? dest : dest + ".cvpack";
        setLoading(true, "Exportando pack…");
        const res = await Lib.exportCategoryPack(libraryRoot, activeCategory, outPath);
        setLoading(false);
        if (res.ok) showToast("Pack exportado (" + res.count + " items)", "success");
        else showToast(res.error || "Error al exportar", "error");
    }

    async function importCategoryPackFlow() {
        if (!Lib.isLinked(settings)) {
            showToast("Vincula una carpeta primero", "error");
            return;
        }
        const filePath = await pickOpenPackDialog();
        if (!filePath) return;
        setLoading(true, "Importando pack…");
        const res = await Lib.importCategoryPack(libraryRoot, filePath);
        setLoading(false);
        if (res.ok) {
            activeCategory = res.category || activeCategory;
            saveSettingsPatch({ lastCategory: res.category });
            renderAssets();
            showToast("Importados " + res.count + " en «" + res.category + "»", "success");
        } else {
            showToast(res.error || "Pack vacío o inválido", "error");
        }
    }

    function handleAssetPrimaryClick(asset, e) {
        if (multiSelectMode) {
            e.preventDefault();
            toggleMultiSelected(asset);
            return;
        }
        selectAsset(asset);
        if (e.ctrlKey || e.metaKey) applyAsset(asset, true);
    }

    function syncViewUi() {
        const listBtn = $("view-list");
        const gridBtn = $("view-grid");
        const sizeToggle = $("size-toggle");
        const isGrid = viewMode !== "list";

        if (listBtn) listBtn.classList.toggle("active", !isGrid);
        if (gridBtn) gridBtn.classList.toggle("active", isGrid);
        if (sizeToggle) sizeToggle.classList.toggle("is-hidden", !isGrid);

        const favBtn = $("btn-favorites");
        if (favBtn) {
            favBtn.innerHTML = Icons.starHtml(showFavoritesOnly);
            favBtn.classList.toggle("active", showFavoritesOnly);
        }

        document.querySelectorAll(".size-btn").forEach((btn) => {
            btn.classList.toggle("active", parseInt(btn.dataset.size, 10) === gridSize);
        });
    }

    function syncSidebarUi() {
        const collapsed = settings.sidebarCollapsed === true;
        $("workspace").classList.toggle("sidebar-collapsed", collapsed);
        const btn = $("btn-toggle-sidebar");
        btn.classList.toggle("is-active", !collapsed);
        btn.title = collapsed ? "Mostrar biblioteca (Ctrl+B)" : "Ocultar biblioteca (Ctrl+B)";
    }

    function toggleSidebar(force) {
        if (typeof force === "boolean") settings.sidebarCollapsed = force;
        else settings.sidebarCollapsed = !settings.sidebarCollapsed;
        saveSettingsPatch({ sidebarCollapsed: settings.sidebarCollapsed });
        syncSidebarUi();
    }

    function renderSidebar() {
        const tree = $("sidebar-tree");
        if (!Lib.isLinked(settings)) {
            tree.innerHTML =
                '<div class="cv-tree-empty">Sin carpeta vinculada.<br>Usa <strong>Vincular carpeta</strong>.</div>';
            return;
        }

        const libName = settings.libraryName || path.basename(libraryRoot);
        let html = "";

        html += '<div class="cv-tree-row cv-tree-cat">';
        html +=
            '<span class="cv-tgl' +
            (typeFilterExpanded ? " expanded" : "") +
            '" data-action="toggle-type" aria-label="' +
            (typeFilterExpanded ? "Contraer" : "Expandir") +
            '">' +
            (typeFilterExpanded ? "−" : "+") +
            "</span>";
        html += '<span class="cv-cat-label">Tipo</span></div>';

        if (typeFilterExpanded) {
            html += '<div class="cv-tree-cat-group">';
            html += '<div class="cv-tree-row cv-tree-item' + (activeFilter === "all" ? " active" : "") + '">';
            html += '<span class="cv-tgl-spacer"></span>';
            html +=
                '<span class="cv-folder root" data-filter="all" data-ctx="library">' +
                escapeHtml(libName) +
                "</span></div>";

            Lib.TYPE_FILTERS.forEach((f) => {
                if (f.id === "all") return;
                html +=
                    '<div class="cv-tree-row cv-tree-item cv-tree-sub' +
                    (activeFilter === f.id ? " active" : "") +
                    '">';
                html += '<span class="cv-tgl-spacer"></span>';
                html +=
                    '<span class="cv-folder" data-filter="' +
                    f.id +
                    '" data-ctx="folder">' +
                    escapeHtml(f.label) +
                    "</span></div>";
            });
            html += "</div>";
        }

        tree.innerHTML = html;
        tree.classList.toggle("has-active", Lib.isLinked(settings));

        tree.querySelector('[data-action="toggle-type"]')?.addEventListener("click", () => {
            typeFilterExpanded = !typeFilterExpanded;
            saveSettingsPatch({ typeFilterExpanded: typeFilterExpanded });
            renderSidebar();
        });

        tree.querySelectorAll("[data-filter]").forEach((el) => {
            el.addEventListener("click", () => {
                activeFilter = el.dataset.filter;
                renderSidebar();
                renderAssets();
            });
        });
    }

    function getFilteredAssets() {
        let list = Lib.filterAssets(
            Lib.listAllAssets(libraryRoot),
            activeFilter,
            searchQuery,
            activeCategory
        );
        if (showFavoritesOnly) {
            const favs = settings.favorites || [];
            list = list.filter((a) => favs.indexOf(a.folder) >= 0);
        }
        return list;
    }

    function updateHostLabel() {
        if (!Lib.isLinked(settings)) {
            $("host-label").textContent = "Biblioteca de comps";
            return;
        }
        $("host-label").textContent = "After Effects";
    }

    function breadcrumbText() {
        const libName = settings.libraryName || "CompVault";
        const filterLabel =
            Lib.TYPE_FILTERS.find((f) => f.id === activeFilter)?.label || "Todos";
        let text = libName;
        if (activeFilter !== "all") text += " / " + filterLabel;
        if (activeCategory !== "__ALL__") text += " / " + activeCategory;
        return text;
    }

    function hidePreviewBar() {
        $("preview-bar").classList.add("is-hidden");
    }

    function selectAsset(asset, showPreview) {
        selectedAsset = asset;
        document.querySelectorAll(".asset-card.selected, .asset-row.selected").forEach((el) => {
            el.classList.remove("selected");
        });
        if (asset) {
            document.querySelectorAll('[data-asset-id="' + asset.id + '"]').forEach((el) => {
                el.classList.add("selected");
            });
            if (showPreview) showPreviewBar(asset);
        } else {
            hidePreviewBar();
        }
    }

    function openPreview(asset) {
        if (!asset) return;
        selectAsset(asset, true);
    }

    function previewFileFor(asset) {
        return path.join(asset.folder, "preview.png");
    }

    function hasValidPreview(asset) {
        if (asset.type === "preset") return false;
        const p = previewFileFor(asset);
        try {
            return fs.existsSync(p) && fs.statSync(p).size > 800;
        } catch (e) {
            return false;
        }
    }

    function isThumbMostlyBlack(img) {
        try {
            const w = Math.min(img.naturalWidth || img.width || 0, 48);
            const h = Math.min(img.naturalHeight || img.height || 0, 48);
            if (!w || !h) return false;
            const canvas = document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            const data = ctx.getImageData(0, 0, w, h).data;
            let sum = 0;
            let maxL = 0;
            const pixels = data.length / 4;
            for (let i = 0; i < data.length; i += 4) {
                const l = (data[i] + data[i + 1] + data[i + 2]) / 3;
                sum += l;
                if (l > maxL) maxL = l;
            }
            const avg = sum / pixels;
            return pixels > 0 && avg < 12 && maxL < 30;
        } catch (e) {
            return false;
        }
    }

    function mountThumbImage(container, asset, src, size) {
        container.innerHTML = "";
        const img = document.createElement("img");
        img.src = src;
        img.alt = "";
        img.draggable = false;
        img.onload = () => {
            const isGif = src.indexOf("image/gif") >= 0;
            if (!isGif && isThumbMostlyBlack(img)) {
                container.innerHTML = "";
                appendTypePlaceholder(container, asset.type, size);
                tryRegeneratePreview(asset);
            }
        };
        img.onerror = () => {
            container.innerHTML = "";
            appendTypePlaceholder(container, asset.type, size);
            tryRegeneratePreview(asset);
        };
        container.appendChild(img);
    }

    function appendTypePlaceholder(container, type, size) {
        const wrap = document.createElement("div");
        wrap.className = "thumb-type-placeholder";
        wrap.innerHTML = Icons.assetTypeHtml(type, size || "md");
        container.appendChild(wrap);
        if (type === "preset") container.classList.add("preset");
    }

    async function ensureAssetPreview(asset, force) {
        if (!asset || asset.type === "preset" || !asset.fileName) return false;
        const previewFile = previewFileFor(asset);
        if (!force && hasValidPreview(asset)) return true;
        const aepFile = path.join(asset.folder, asset.fileName);
        if (!fs.existsSync(aepFile)) return false;
        if (force) {
            try {
                if (fs.existsSync(previewFile)) fs.unlinkSync(previewFile);
            } catch (e) {}
            Lib.clearThumbCache();
        }
        const res = parseJson(
            await jsxCall("cvRegenerateThumbnailFromAep", [aepFile, previewFile, saveOptionsJson()]),
            { ok: false }
        );
        if (res.ok) Lib.clearThumbCache();
        return !!res.ok;
    }

    async function tryRegeneratePreview(asset, force) {
        if (!asset) return;
        if (!force && thumbRegenAttempted.has(asset.folder)) return;
        if (!force) thumbRegenAttempted.add(asset.folder);
        const ok = await ensureAssetPreview(asset, force);
        if (!ok) {
            if (!force) thumbRegenAttempted.delete(asset.folder);
            return;
        }
        renderAssets();
        if (
            selectedAsset &&
            selectedAsset.id === asset.id &&
            !$("preview-bar").classList.contains("is-hidden")
        ) {
            showPreviewBar(asset);
        }
    }

    function showPreviewBar(asset) {
        const thumb = $("preview-thumb");
        thumb.innerHTML = "";
        thumb.className = "preview-thumb";

        const src = thumbSrc(asset);
        if (src) {
            mountThumbImage(thumb, asset, src, "lg");
        } else {
            appendTypePlaceholder(thumb, asset.type, "lg");
            if (asset.type !== "preset") tryRegeneratePreview(asset);
        }

        $("preview-name").textContent = displayNameFor(asset);
        $("preview-meta").textContent = Lib.typeLabel(asset.type) + " · " + assetMetaLine(asset);
        $("preview-bar").classList.remove("is-hidden");
    }

    function appendThumbTo(container, asset, isPresetClass) {
        const src = thumbSrc(asset);
        const size = isPresetClass ? "md" : "sm";
        if (src) {
            mountThumbImage(container, asset, src, size);
            return;
        }
        appendTypePlaceholder(container, asset.type, size);
        if (asset.type !== "preset") tryRegeneratePreview(asset);
    }

    function cardThumbLayout(asset) {
        const w = Number(asset.width) || 0;
        const h = Number(asset.height) || 0;
        if (w <= 0 || h <= 0) {
            return { aspect: "1 / 1", hMult: 1.1 };
        }
        const ratio = w / h;
        let hMult;
        if (ratio >= 0.9 && ratio <= 1.1) {
            hMult = 1.05;
        } else if (ratio > 1) {
            hMult = Math.max(0.55, Math.min(1.2, h / w + 0.12));
        } else {
            hMult = Math.min(3, Math.max(1.05, (h / w) * 0.92));
        }
        return {
            aspect: Math.round(w) + " / " + Math.round(h),
            hMult: Math.round(hMult * 100) / 100
        };
    }

    function applyCardThumbLayout(thumbEl, asset) {
        const layout = cardThumbLayout(asset);
        thumbEl.style.setProperty("--card-aspect", layout.aspect);
        thumbEl.style.setProperty("--card-h-mult", String(layout.hMult));
    }

    function renderGrid(assets) {
        const grid = $("asset-grid");
        grid.innerHTML = "";
        document.documentElement.style.setProperty("--grid-size", gridSize + "px");

        assets.forEach((asset) => {
            const card = document.createElement("article");
            card.className =
                "asset-card" +
                (selectedAsset && selectedAsset.id === asset.id ? " selected" : "") +
                (isMultiSelected(asset) ? " multi-selected" : "");
            card.dataset.assetId = asset.id;

            const thumbWrap = document.createElement("div");
            thumbWrap.className = "card-thumb";
            applyCardThumbLayout(thumbWrap, asset);
            const badge = document.createElement("span");
            badge.className = "card-type-badge";
            badge.textContent = Lib.typeLabel(asset.type);
            thumbWrap.appendChild(badge);
            if (asset.category && asset.category !== Lib.DEFAULT_CATEGORY) {
                const catBadge = document.createElement("span");
                catBadge.className = "category-badge";
                catBadge.textContent = asset.category;
                catBadge.title = asset.category;
                thumbWrap.appendChild(catBadge);
            }
            appendThumbTo(thumbWrap, asset, true);

            const body = document.createElement("div");
            body.className = "card-body";
            const nameEl = document.createElement("div");
            nameEl.className = "card-name";
            nameEl.textContent = displayNameFor(asset);
            const metaEl = document.createElement("div");
            metaEl.className = "card-meta";
            metaEl.textContent = assetMetaLine(asset);
            body.appendChild(nameEl);
            body.appendChild(metaEl);

            card.appendChild(thumbWrap);
            card.appendChild(body);

            card.addEventListener("click", (e) => handleAssetPrimaryClick(asset, e));
            card.addEventListener("dblclick", (e) => {
                if (multiSelectMode) return;
                e.preventDefault();
                applyAsset(asset, false);
            });
            card.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectAsset(asset);
                showContextMenu(e.clientX, e.clientY, { kind: "asset", asset: asset });
            });

            grid.appendChild(card);
        });
    }

    function renderList(assets) {
        const list = $("asset-list");
        list.innerHTML =
            '<div class="list-head"><span></span><span>Nombre</span><span>Tipo</span><span>Detalle</span></div>';

        assets.forEach((asset) => {
            const row = document.createElement("div");
            row.className =
                "asset-row" +
                (selectedAsset && selectedAsset.id === asset.id ? " selected" : "") +
                (isMultiSelected(asset) ? " multi-selected" : "");
            row.dataset.assetId = asset.id;

            const thumb = document.createElement("div");
            thumb.className = "row-thumb";
            appendThumbTo(thumb, asset, false);

            const nameCol = document.createElement("span");
            nameCol.className = "col-name-text";
            nameCol.textContent = displayNameFor(asset);
            const typeCol = document.createElement("span");
            typeCol.className = "col-type";
            typeCol.textContent = Lib.typeLabel(asset.type);
            const metaCol = document.createElement("span");
            metaCol.className = "col-meta";
            metaCol.textContent = assetMetaLine(asset);

            row.appendChild(thumb);
            row.appendChild(nameCol);
            row.appendChild(typeCol);
            row.appendChild(metaCol);

            row.addEventListener("click", (e) => handleAssetPrimaryClick(asset, e));
            row.addEventListener("dblclick", (e) => {
                if (multiSelectMode) return;
                e.preventDefault();
                applyAsset(asset, false);
            });
            row.addEventListener("contextmenu", (e) => {
                e.preventDefault();
                e.stopPropagation();
                selectAsset(asset);
                showContextMenu(e.clientX, e.clientY, { kind: "asset", asset: asset });
            });

            list.appendChild(row);
        });
    }

    function renderAssets() {
        refreshLibraryRoot();
        updateHostLabel();
        renderSidebar();
        renderCategoryTabs();

        const linked = Lib.isLinked(settings);
        $("welcome-state").classList.toggle("is-hidden", linked);

        if (!linked) {
            $("asset-grid").innerHTML = "";
            $("asset-list").innerHTML = "";
            $("empty-state").classList.add("is-hidden");
            $("category-tabs")?.classList.add("is-hidden");
            $("status-count").textContent = "Sin carpeta vinculada";
            $("breadcrumb").textContent = "—";
            return;
        }

        const assets = getFilteredAssets();
        $("breadcrumb").textContent = breadcrumbText();
        $("status-count").textContent = assets.length + (assets.length === 1 ? " elemento" : " elementos");
        $("empty-state").classList.toggle("is-hidden", assets.length > 0);

        if (viewMode === "list") {
            $("asset-grid").classList.add("is-hidden");
            $("asset-list").classList.remove("is-hidden");
            renderList(assets);
        } else {
            $("asset-list").classList.add("is-hidden");
            $("asset-grid").classList.remove("is-hidden");
            renderGrid(assets);
        }

        if (selectedAsset && !assets.find((a) => a.id === selectedAsset.id)) selectAsset(null);
        else if (selectedAsset && !$("preview-bar").classList.contains("is-hidden")) {
            showPreviewBar(selectedAsset);
        }
    }

    async function ensureHost() {
        const ping = parseJson(await evalScript("cvPing()"), {});
        if (!ping.ok) {
            const ext = cs.getSystemPath(SystemPath.EXTENSION);
            await evalScript("$.evalFile(" + JSON.stringify(ext.replace(/\\/g, "/") + "/jsx/host.jsx") + ")");
        }
    }

    async function applyAsset(asset, forceReimport) {
        const filePath = asset.filePath || path.join(asset.folder, asset.fileName || "");
        if (!fs.existsSync(filePath)) {
            showToast("Archivo no encontrado", "error");
            return;
        }

        setLoading(true, forceReimport ? "Reimportando…" : "Aplicando…");
        const fn = settings.addToTimeline !== false ? "cvApplyToTimeline" : "cvApplyLibraryItem";
        const res = parseJson(
            await jsxCall(fn, [
                filePath,
                asset.vaultKey || vaultKeyFor(filePath),
                forceReimport ? "true" : "false",
                displayNameFor(asset),
                asset.type || "comp",
                settings.organizeProject !== false ? "true" : "false"
            ]),
            {}
        );
        setLoading(false);

        if (!res.ok) {
            showToast(errorMessage(res.error), "error");
            return;
        }
        showToast((forceReimport ? "Reimportado: " : "Aplicado: ") + (res.name || displayNameFor(asset)), "success");
    }

    function errorMessage(code) {
        const map = {
            save_project_first: "Guarda el proyecto (.aep) con Ctrl+S",
            no_active_comp: "Abre una composición",
            no_layers_selected: "Selecciona capas",
            select_an_effect: "Selecciona un efecto",
            open_comp_for_preset: "Abre una comp para el preset",
            select_layer_for_preset: "Selecciona una capa",
            file_not_found: "Archivo no encontrado",
            script_error: "Reinicia el panel CompVault",
            invalid_aep: ".aep no válido",
            no_comp_in_aep: "No hay comp en el .aep",
            reopen_failed: "No se pudo reabrir el proyecto",
            no_project: "No hay proyecto abierto",
            rendering_in_progress: "Espera a que termine el render en cola",
            copy_to_library_failed: "No se pudo copiar el .aep a la biblioteca",
        };
        return map[code] || code || "Error";
    }

    async function refreshSelectionStatus() {
        selectionCache = parseJson(await evalScript("cvGetSelectionSummary()"), { ok: false });
        updateSaveModalState();
    }

    function updateSaveModalState() {
        document.querySelectorAll(".save-type-card").forEach((btn) => {
            const t = btn.dataset.save;
            if (!selectionCache || !selectionCache.ok) {
                btn.disabled = true;
                return;
            }
            if (t === "comp") btn.disabled = false;
            else if (t === "layers") btn.disabled = selectionCache.selectedLayers === 0;
            else btn.disabled = !selectionCache.hasEffectSelection;
        });
    }

    function openSaveModal() {
        if (!Lib.isLinked(settings)) {
            showToast("Vincula una carpeta primero", "error");
            openLinkModal();
            return;
        }
        refreshSelectionStatus();
        populateSaveCategories();
        const nameInput = $("save-name");
        if (!nameInput.value.trim()) nameInput.value = defaultSaveName("comp");
        $("save-context").textContent = selectionCache?.ok
            ? selectionCache.comp.name +
              " · " +
              selectionCache.selectedLayers +
              " capa(s) sel."
            : "Abre una composición en AE";
        $("save-dest").textContent =
            "Destino: " + Lib.shortenPath(libraryRoot) + " · categoría «" + currentSaveCategory() + "»";
        $("save-modal").classList.remove("is-hidden");
        nameInput.focus();
        nameInput.select();
    }

    function saveOptionsJson() {
        return JSON.stringify({
            previewMode: settings.previewMode || "still",
            previewMaxSec: settings.previewMaxSec != null ? settings.previewMaxSec : 3,
            previewWidth: settings.previewWidth != null ? settings.previewWidth : 200,
            collectFiles: settings.collectFiles !== false
        });
    }

    function syncSettingsUi() {
        if (settings.addToTimeline === false) $("opt-add-to-timeline").checked = false;
        if (settings.organizeProject === false) $("opt-organize-project").checked = false;
        if (settings.collectFiles === false) $("opt-collect-files").checked = false;

        const mode = settings.previewMode || "still";
        const modeEl = document.querySelector('input[name="preview-mode"][value="' + mode + '"]');
        if (modeEl) modeEl.checked = true;

        if ($("preview-max-sec")) {
            $("preview-max-sec").value = settings.previewMaxSec != null ? settings.previewMaxSec : 3;
        }
        if ($("preview-width")) {
            $("preview-width").value = settings.previewWidth != null ? settings.previewWidth : 200;
        }
    }

    function readPreviewSettingsFromUi() {
        const checked = document.querySelector('input[name="preview-mode"]:checked');
        const patch = {
            previewMode: checked ? checked.value : "still",
            previewMaxSec: parseFloat($("preview-max-sec")?.value) || 3,
            previewWidth: parseInt($("preview-width")?.value, 10) || 200,
            collectFiles: $("opt-collect-files")?.checked !== false
        };
        if (patch.previewMaxSec > 9) patch.previewMaxSec = 9;
        if (patch.previewMaxSec < 1) patch.previewMaxSec = 1;
        if (patch.previewWidth > 600) patch.previewWidth = 600;
        if (patch.previewWidth < 80) patch.previewWidth = 80;
        saveSettingsPatch(patch);
    }

    async function saveAsset(type) {
        if (!Lib.isLinked(settings)) {
            showToast("Vincula una carpeta primero", "error");
            return;
        }

        const customName = ($("save-name").value || "").trim();
        if (!customName) {
            showToast("Escribe un nombre", "error");
            return;
        }

        closeSaveModal();
        setLoading(true, "Guardando…");

        const typeDir = Lib.getTypeFolder(libraryRoot, type);
        Lib.ensureDir(typeDir);
        const { name, dir } = Lib.uniqueAssetDir(typeDir, customName);
        Lib.ensureDir(dir);
        const abs = (p) => path.join(dir, p);

        let result;
        let fileName;
        const saveOpts = saveOptionsJson();

        if (type === "comp") {
            fileName = name + ".aep";
            result = parseJson(
                await jsxCall("cvSaveReducedCompAep", [abs(fileName), abs("preview.png"), saveOpts]),
                { ok: false }
            );
        } else if (type === "layers") {
            fileName = name + ".aep";
            result = parseJson(
                await jsxCall("cvSaveSelectedLayersAep", [abs(fileName), abs("preview.png"), saveOpts]),
                { ok: false }
            );
        } else {
            fileName = name + ".ffx";
            result = parseJson(await jsxCall("cvSaveEffectPreset", [abs(fileName)]), { ok: false });
        }

        if (!result || !result.ok) {
            setLoading(false);
            Lib.deleteAsset(dir);
            showToast(errorMessage(result && result.error), "error");
            return;
        }

        const filePath = abs(fileName);
        const category = Lib.ensureCategory(libraryRoot, currentSaveCategory());
        saveSettingsPatch({ lastCategory: category });
        Lib.writeMeta(dir, {
            displayName: customName,
            name: name,
            uniqueId: name,
            type: type,
            category: category,
            fileName: fileName,
            filePath: filePath,
            vaultKey: vaultKeyFor(filePath),
            sourceCompName: selectionCache?.comp?.name || "",
            width: result.width,
            height: result.height,
            duration: result.duration,
            frameRate: result.frameRate,
            createdAt: Date.now()
        });

        Lib.clearThumbCache();
        setLoading(false);
        $("save-name").value = "";
        renderAssets();
        showToast("Guardado en " + Lib.typeLabel(type) + "s: " + customName, "success");
    }

    /* ─── Vincular carpeta ─── */

    function browseTo(p) {
        linkBrowsePath = p;
        $("link-path-input").value = p;
        $("link-selected-path").textContent =
            "Se creará/usará: " + Lib.shortenPath(Lib.linkPreviewPath(p));
        renderLinkBrowser();
    }

    function renderLinkBrowser() {
        $("link-crumb").textContent = Lib.shortenPath(linkBrowsePath);
        const list = $("link-list");
        list.innerHTML = "";

        const parent = path.dirname(linkBrowsePath);
        if (parent && parent !== linkBrowsePath) {
            const li = document.createElement("li");
            const btn = document.createElement("button");
            btn.textContent = "⬆ ..";
            btn.addEventListener("click", () => browseTo(parent));
            li.appendChild(btn);
            list.appendChild(li);
        }

        try {
            fs.readdirSync(linkBrowsePath, { withFileTypes: true })
                .filter((e) => e.isDirectory() && !e.name.startsWith("."))
                .sort((a, b) => a.name.localeCompare(b.name))
                .forEach((entry) => {
                    const li = document.createElement("li");
                    const btn = document.createElement("button");
                    btn.textContent = "📁 " + entry.name;
                    const full = path.join(linkBrowsePath, entry.name);
                    btn.addEventListener("click", () => browseTo(full));
                    btn.addEventListener("dblclick", (e) => {
                        e.preventDefault();
                        browseTo(full);
                    });
                    li.appendChild(btn);
                    list.appendChild(li);
                });
        } catch (e) {
            list.innerHTML = "<li><span style='padding:8px;color:#888'>No se puede leer la ruta</span></li>";
        }
    }

    function openLinkModal() {
        linkBrowsePath =
            settings.linkedPath ||
            Lib.parentFromVaultRoot(libraryRoot) ||
            os.homedir();
        $("link-path-input").value = linkBrowsePath;
        $("link-selected-path").textContent =
            "Se creará/usará: " + Lib.shortenPath(Lib.linkPreviewPath(linkBrowsePath));
        renderLinkBrowser();
        $("link-modal").classList.remove("is-hidden");
    }

    function closeLinkModal() {
        $("link-modal").classList.add("is-hidden");
    }

    function confirmLink() {
        const p = ($("link-path-input").value || linkBrowsePath || "").trim();
        if (!p || !fs.existsSync(p)) {
            showToast("Ruta no válida", "error");
            return;
        }
        settings = Lib.linkFolder(p);
        refreshLibraryRoot();
        Lib.clearThumbCache();
        closeLinkModal();
        renderAssets();
        showToast("Carpeta vinculada", "success");
    }

    function closeSaveModal() {
        $("save-modal").classList.add("is-hidden");
    }

    function revealInExplorer(absPath, selectFile) {
        if (!absPath) return;
        const cp = require("child_process");
        const p = absPath.replace(/"/g, "");
        if (selectFile) cp.exec('explorer /select,"' + p + '"', { windowsHide: true });
        else cp.exec('explorer "' + p + '"', { windowsHide: true });
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

    function toggleFavorite(folderPath) {
        const favs = (settings.favorites || []).slice();
        const idx = favs.indexOf(folderPath);
        if (idx >= 0) favs.splice(idx, 1);
        else favs.push(folderPath);
        saveSettingsPatch({ favorites: favs });
        renderAssets();
        showToast(idx >= 0 ? "Quitado de favoritos" : "Añadido a favoritos", "success");
    }

    function rescanLibrary() {
        Lib.clearThumbCache();
        renderAssets();
        showToast("Biblioteca actualizada", "success");
    }

    function unlinkLibrary() {
        settings = Lib.unlinkLibrary();
        libraryRoot = "";
        activeFilter = "all";
        selectedAsset = null;
        $("preview-bar").classList.add("is-hidden");
        renderSidebar();
        renderAssets();
        updateHostLabel();
        showToast("Biblioteca desvinculada", "success");
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
        if (target.kind === "asset") {
            const asset = target.asset;
            const favs = settings.favorites || [];
            const isFav = favs.indexOf(asset.folder) >= 0;
            html += ctxMenuItem("preview", "Previsualizar");
            html += ctxMenuItem("apply", "Añadir a timeline");
            html += ctxMenuItem("reimport", "Reimportar");
            html += ctxMenuSep();
            html += ctxMenuItem("reveal", "Mostrar en Explorer");
            html += ctxMenuItem("favorite", isFav ? "Quitar favorito" : "Marcar favorito");
            html += ctxMenuItem("copy-path", "Copiar ruta");
            html += ctxMenuItem("regen-thumb", "Regenerar miniatura");
            html += ctxMenuSep();
            html += ctxMenuItem("rename", "Renombrar…");
            html += ctxMenuItem("delete", "Eliminar…", { danger: true });
        } else if (target.kind === "folder" || target.kind === "library") {
            html += ctxMenuItem("reveal", "Mostrar en Explorer");
            html += ctxMenuItem("rename", "Renombrar en panel…");
            html += ctxMenuItem("rescan", "Reescanear biblioteca");
            html += ctxMenuSep();
            html += ctxMenuItem("unlink", "Desvincular");
            if (target.kind === "folder") {
                html += ctxMenuSep();
                html += ctxMenuItem("delete", "Eliminar carpeta…", { danger: true });
            }
        }
        return html;
    }

    function showContextMenu(x, y, target) {
        if (!target) return;
        ctxTarget = target;
        const menu = $("ctx-menu");
        menu.innerHTML = buildContextMenuHtml(target);
        menu.classList.remove("is-hidden");
        menu.style.width = "";
        menu.style.minWidth = "";
        menu.style.left = Math.min(x, window.innerWidth - 200) + "px";
        menu.style.top = Math.min(y, window.innerHeight - 260) + "px";
        const menuW = menu.offsetWidth;
        if (x + menuW > window.innerWidth - 8) {
            menu.style.left = Math.max(8, window.innerWidth - menuW - 8) + "px";
        }
    }

    function hideContextMenu() {
        $("ctx-menu").classList.add("is-hidden");
        ctxTarget = null;
    }

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
        return new Promise((resolve) => {
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
        return new Promise((resolve) => {
            dialogResolve = resolve;
            dialogMode = "prompt";
            $("dialog-title").textContent = opts.title || "Nombre";
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
            setTimeout(() => {
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
        $("dialog-cancel").addEventListener("click", () => {
            closeDialog(dialogMode === "prompt" ? null : false);
        });
        $("dialog-confirm").addEventListener("click", submitDialog);
        $("dialog-input").addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                submitDialog();
            }
        });
        $("dialog-modal").addEventListener("click", (e) => {
            if (e.target === $("dialog-modal")) {
                closeDialog(dialogMode === "prompt" ? null : false);
            }
        });
    }

    function handleContextMenuAction(action) {
        const target = ctxTarget;
        hideContextMenu();
        if (!target || !action) return;

        if (target.kind === "asset") {
            const asset = target.asset;
            if (action === "preview") openPreview(asset);
            else if (action === "apply") applyAsset(asset, false);
            else if (action === "reimport") applyAsset(asset, true);
            else if (action === "reveal") revealInExplorer(asset.folder, true);
            else if (action === "favorite") toggleFavorite(asset.folder);
            else if (action === "copy-path") copyTextToClipboard(asset.folder);
            else if (action === "regen-thumb") {
                thumbRegenAttempted.delete(asset.folder);
                setLoading(true, "Regenerando miniatura…");
                ensureAssetPreview(asset, true).then((ok) => {
                    setLoading(false);
                    if (ok) {
                        renderAssets();
                        showToast("Miniatura actualizada", "success");
                    } else showToast("No se pudo generar miniatura", "error");
                });
            }
            else if (action === "rename") openRenameModal({ kind: "asset", asset: asset });
            else if (action === "delete") {
                showConfirm({
                    title: "Eliminar",
                    message:
                        "¿Eliminar «" +
                        displayNameFor(asset) +
                        "»?\n\nLos archivos se borrarán del disco.",
                    confirmLabel: "Eliminar",
                    danger: true
                }).then((ok) => {
                    if (!ok) return;
                    Lib.deleteAsset(asset.folder);
                    if (selectedAsset && selectedAsset.id === asset.id) selectAsset(null);
                    renderAssets();
                    showToast("Eliminado", "success");
                });
            }
            return;
        }

        if (target.kind === "folder" || target.kind === "library") {
            const folderPath =
                target.kind === "library"
                    ? libraryRoot
                    : Lib.getTypeFolder(libraryRoot, target.filterId);
            const folderLabel =
                target.kind === "library"
                    ? settings.libraryName || path.basename(libraryRoot)
                    : Lib.TYPE_FILTERS.find((f) => f.id === target.filterId)?.label || target.filterId;

            if (action === "reveal" && folderPath) revealInExplorer(folderPath, false);
            else if (action === "rename") openRenameModal({ kind: "library" });
            else if (action === "rescan") rescanLibrary();
            else if (action === "unlink") {
                showConfirm({
                    title: "Desvincular biblioteca",
                    message: "¿Desvincular biblioteca?\n\nLos archivos en disco no se borran.",
                    confirmLabel: "Desvincular",
                    danger: true
                }).then((ok) => {
                    if (ok) unlinkLibrary();
                });
            } else if (action === "delete" && target.kind === "folder") {
                showConfirm({
                    title: "Eliminar carpeta",
                    message:
                        "¿Eliminar todos los assets en «" +
                        folderLabel +
                        "»?\n\nLos archivos se borrarán del disco.",
                    confirmLabel: "Eliminar",
                    danger: true
                }).then((ok) => {
                    if (!ok) return;
                    const n = Lib.deleteTypeFolderContents(libraryRoot, target.filterId);
                    selectAsset(null);
                    renderAssets();
                    showToast(n ? n + " eliminado(s)" : "Carpeta vacía", "success");
                });
            }
            return;
        }
    }

    function openRenameModal(target) {
        renameTarget = target;
        const titleEl = $("rename-modal").querySelector("h2");
        if (target.kind === "library") {
            titleEl.textContent = "Renombrar en panel";
            $("rename-input").value = settings.libraryName || path.basename(libraryRoot);
        } else {
            titleEl.textContent = "Renombrar";
            $("rename-input").value = displayNameFor(target.asset);
        }
        $("rename-modal").classList.remove("is-hidden");
        $("rename-input").focus();
        $("rename-input").select();
    }

    function confirmRename() {
        if (!renameTarget) return;
        const val = ($("rename-input").value || "").trim();
        if (!val) return;
        if (renameTarget.kind === "library") {
            saveSettingsPatch({ libraryName: val });
            renderSidebar();
            updateHostLabel();
            showToast("Nombre actualizado", "success");
        } else {
            Lib.renameAsset(renameTarget.asset.folder, val);
            renderAssets();
            showToast("Renombrado", "success");
        }
        $("rename-modal").classList.add("is-hidden");
        renameTarget = null;
    }

    function bindEvents() {
        mountToolbarIcons();
        syncSidebarUi();
        syncViewUi();
        bindDialog();

        $("btn-link-folder").addEventListener("click", openLinkModal);
        $("btn-link-welcome").addEventListener("click", openLinkModal);
        $("btn-settings-link").addEventListener("click", () => {
            $("settings-drawer").classList.add("is-hidden");
            openLinkModal();
        });
        $("btn-link-close").addEventListener("click", closeLinkModal);
        $("link-confirm").addEventListener("click", confirmLink);
        $("link-path-go").addEventListener("click", () => {
            const p = ($("link-path-input").value || "").trim();
            if (p && fs.existsSync(p)) browseTo(p);
            else showToast("Ruta no encontrada", "error");
        });
        $("link-path-input").addEventListener("keydown", (e) => {
            if (e.key === "Enter") $("link-path-go").click();
        });

        $("link-drop").addEventListener("dragover", (e) => {
            e.preventDefault();
        });
        $("link-drop").addEventListener("drop", (e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (files && files[0] && files[0].path) browseTo(files[0].path);
        });

        $("btn-save-open").addEventListener("click", openSaveModal);
        $("btn-save-close").addEventListener("click", closeSaveModal);
        document.querySelectorAll(".save-type-card").forEach((btn) => {
            btn.addEventListener("click", () => {
                if (!($("save-name").value || "").trim()) $("save-name").value = defaultSaveName(btn.dataset.save);
                saveAsset(btn.dataset.save);
            });
        });

        $("btn-toggle-sidebar").addEventListener("click", () => toggleSidebar());
        $("search-input").addEventListener("input", (e) => {
            searchQuery = e.target.value.trim();
            renderAssets();
        });

        $("view-grid").addEventListener("click", () => {
            viewMode = "grid";
            saveSettingsPatch({ viewMode: "grid" });
            syncViewUi();
            renderAssets();
        });
        $("view-list").addEventListener("click", () => {
            viewMode = "list";
            saveSettingsPatch({ viewMode: "list" });
            syncViewUi();
            renderAssets();
        });
        document.querySelectorAll(".size-btn").forEach((btn) => {
            btn.addEventListener("click", () => {
                gridSize = parseInt(btn.dataset.size, 10);
                saveSettingsPatch({ gridSize: gridSize });
                syncViewUi();
                renderAssets();
            });
        });

        $("btn-favorites").addEventListener("click", () => {
            showFavoritesOnly = !showFavoritesOnly;
            syncViewUi();
            renderAssets();
        });

        $("btn-multi-select").addEventListener("click", () => {
            if (multiSelectMode && multiSelected.length > 0) applySelectedBatch();
            else toggleMultiSelectMode();
        });
        $("btn-export-pack").addEventListener("click", () => exportCurrentCategoryPack());
        $("btn-import-pack").addEventListener("click", () => importCategoryPackFlow());

        $("btn-save-add-category").addEventListener("click", () => {
            const val = ($("save-new-category").value || "").trim();
            if (!val) return;
            Lib.ensureCategory(libraryRoot, val);
            $("save-new-category").value = "";
            populateSaveCategories();
            const sel = $("save-category");
            if (sel) sel.value = val;
            saveSettingsPatch({ lastCategory: val });
        });
        $("save-category")?.addEventListener("change", (e) => {
            saveSettingsPatch({ lastCategory: e.target.value });
        });

        $("btn-preview-close").addEventListener("click", () => hidePreviewBar());
        $("btn-preview-apply").addEventListener("click", () => selectedAsset && applyAsset(selectedAsset, false));
        $("btn-preview-reimport").addEventListener("click", () => selectedAsset && applyAsset(selectedAsset, true));

        $("btn-settings").addEventListener("click", () => {
            syncSettingsUi();
            $("settings-linked-path").textContent = Lib.isLinked(settings)
                ? Lib.shortenPath(libraryRoot)
                : "Sin vincular";
            $("settings-drawer").classList.remove("is-hidden");
        });
        $("btn-close-settings").addEventListener("click", () => $("settings-drawer").classList.add("is-hidden"));

        $("opt-add-to-timeline").addEventListener("change", (e) => saveSettingsPatch({ addToTimeline: e.target.checked }));
        $("opt-organize-project").addEventListener("change", (e) => saveSettingsPatch({ organizeProject: e.target.checked }));
        $("opt-collect-files").addEventListener("change", (e) => saveSettingsPatch({ collectFiles: e.target.checked }));

        document.querySelectorAll('input[name="preview-mode"]').forEach((el) => {
            el.addEventListener("change", readPreviewSettingsFromUi);
        });
        $("preview-max-sec")?.addEventListener("change", readPreviewSettingsFromUi);
        $("preview-width")?.addEventListener("change", readPreviewSettingsFromUi);

        $("btn-open-library-folder").addEventListener("click", () => {
            if (!libraryRoot) return;
            require("child_process").exec('explorer "' + libraryRoot.replace(/"/g, "") + '"', { windowsHide: true });
        });

        $("btn-rename-confirm").addEventListener("click", confirmRename);
        $("btn-rename-cancel").addEventListener("click", () => $("rename-modal").classList.add("is-hidden"));
        $("btn-rename-close").addEventListener("click", () => $("rename-modal").classList.add("is-hidden"));

        $("sidebar-tree").addEventListener("contextmenu", (e) => {
            const libEl = e.target.closest('[data-ctx="library"]');
            const folderEl = e.target.closest('[data-ctx="folder"]');
            if (!libEl && !folderEl) return;
            e.preventDefault();
            e.stopPropagation();
            if (libEl) {
                showContextMenu(e.clientX, e.clientY, { kind: "library" });
            } else {
                showContextMenu(e.clientX, e.clientY, {
                    kind: "folder",
                    filterId: folderEl.dataset.filter
                });
            }
        });

        $("ctx-menu").addEventListener("click", (e) => {
            const btn = e.target.closest("[data-action]");
            if (!btn) return;
            handleContextMenuAction(btn.dataset.action);
        });

        document.addEventListener("click", (e) => {
            if (!$("ctx-menu").contains(e.target)) hideContextMenu();
        });

        $("app").addEventListener("contextmenu", (e) => {
            e.preventDefault();
        });

        document.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "b" || e.key === "B")) {
                if (!$("save-modal").classList.contains("is-hidden")) return;
                if (!$("link-modal").classList.contains("is-hidden")) return;
                e.preventDefault();
                toggleSidebar();
            }
            if (e.key === "Escape") {
                if (isDialogOpen()) closeDialog(dialogMode === "prompt" ? null : false);
                else if (!$("rename-modal").classList.contains("is-hidden")) $("rename-modal").classList.add("is-hidden");
                else if (!$("save-modal").classList.contains("is-hidden")) closeSaveModal();
                else if (!$("link-modal").classList.contains("is-hidden")) closeLinkModal();
                else if (!$("settings-drawer").classList.contains("is-hidden")) $("settings-drawer").classList.add("is-hidden");
                else if (!$("preview-bar").classList.contains("is-hidden")) hidePreviewBar();
                else selectAsset(null);
            }
        });

        $("app").addEventListener("dragover", (e) => e.preventDefault());
        $("app").addEventListener("drop", async (e) => {
            e.preventDefault();
            const files = e.dataTransfer.files;
            if (!files?.length) return;
            const p = files[0].path || files[0].name;
            if (/\.(flexpack|cvpack|zip)$/i.test(p || "")) {
                if (!Lib.isLinked(settings)) {
                    openLinkModal();
                    return;
                }
                setLoading(true, "Importando pack…");
                const res = await Lib.importCategoryPack(libraryRoot, p);
                setLoading(false);
                if (res.ok) {
                    activeCategory = res.category || activeCategory;
                    saveSettingsPatch({ lastCategory: res.category });
                    renderAssets();
                    showToast("Importados " + res.count + " en «" + res.category + "»", "success");
                } else showToast(res.error || "Pack inválido", "error");
                return;
            }
            if (p?.toLowerCase().endsWith(".ffx")) {
                if (!Lib.isLinked(settings)) {
                    openLinkModal();
                    return;
                }
                const name = await showPrompt({
                    title: "Guardar preset",
                    value: path.basename(p, ".ffx"),
                    confirmLabel: "Guardar"
                });
                if (!name?.trim()) return;
                const typeDir = Lib.getTypeFolder(libraryRoot, "preset");
                const { name: folderName, dir } = Lib.uniqueAssetDir(typeDir, name.trim());
                const dest = path.join(dir, folderName + ".ffx");
                fs.copyFileSync(p, dest);
                Lib.writeMeta(dir, {
                    displayName: name.trim(),
                    name: folderName,
                    uniqueId: folderName,
                    type: "preset",
                    category: Lib.ensureCategory(libraryRoot, currentSaveCategory()),
                    fileName: folderName + ".ffx",
                    filePath: dest,
                    vaultKey: vaultKeyFor(dest),
                    createdAt: Date.now()
                });
                renderAssets();
                showToast("Preset guardado", "success");
            }
        });
    }

    async function init() {
        bindEvents();
        await ensureHost();
        refreshLibraryRoot();

        syncSettingsUi();
        syncViewUi();

        renderAssets();
        refreshSelectionStatus();
        setInterval(refreshSelectionStatus, 5000);
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
