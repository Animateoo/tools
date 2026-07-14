/**
 * CompVault — demo web interactivo (réplica del panel AE vinculado vacío)
 */
(function () {
    "use strict";

    var Icons = CompVaultIcons;
    var $ = function (id) { return document.getElementById(id); };

    var state = {
        linked: true,
        libraryName: "Archivos de Ediciones",
        libraryPath: "D:\\Comps\\Archivos de Ediciones",
        viewMode: "list",
        gridSize: 180,
        activeCategory: "ALL",
        categories: ["General"],
        favoritesOnly: false,
        multiSelect: false,
        sidebarCollapsed: true,
        assets: [],
        selectedId: null
    };

    var TYPE_LABELS = { comp: "Comp", layers: "Capas", preset: "Preset" };

    function showToast(msg, kind) {
        var t = $("toast");
        if (!t) return;
        t.textContent = msg;
        t.className = "toast " + (kind === "error" ? "error" : kind === "success" ? "success" : "");
        t.classList.remove("is-hidden");
        clearTimeout(showToast._timer);
        showToast._timer = setTimeout(function () { t.classList.add("is-hidden"); }, 2200);
    }

    function mountIcons() {
        var linkSlot = $("btn-link-icon");
        if (linkSlot) linkSlot.innerHTML = Icons.html("link");
        var saveBtn = $("btn-save-open");
        if (saveBtn) saveBtn.innerHTML = Icons.html("save");
        var settingsBtn = $("btn-settings");
        if (settingsBtn) settingsBtn.innerHTML = Icons.html("settings");
        $("btn-toggle-sidebar").innerHTML = Icons.html("sidebar");
        $("view-list").innerHTML = Icons.html("list");
        $("view-grid").innerHTML = Icons.html("grid");
        $("btn-favorites").innerHTML = Icons.starHtml(state.favoritesOnly);
        $("btn-multi-select").innerHTML = Icons.html("multiSelect");
        $("btn-export-pack").innerHTML = Icons.html("packExport");
        $("btn-import-pack").innerHTML = Icons.html("packImport");
    }

    function syncViewUi() {
        $("view-list").classList.toggle("active", state.viewMode === "list");
        $("view-grid").classList.toggle("active", state.viewMode === "grid");
        document.querySelectorAll(".size-btn").forEach(function (btn) {
            btn.classList.toggle("active", parseInt(btn.dataset.size, 10) === state.gridSize);
        });
        $("size-toggle").classList.toggle("is-hidden", state.viewMode === "list");
        $("btn-multi-select").classList.toggle("active", state.multiSelect);
        $("btn-favorites").innerHTML = Icons.starHtml(state.favoritesOnly);
        $("workspace").classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
        $("btn-toggle-sidebar").classList.toggle("is-active", !state.sidebarCollapsed);
    }

    function filteredAssets() {
        var list = state.assets.slice();
        if (state.activeCategory !== "ALL") {
            list = list.filter(function (a) { return a.category === state.activeCategory; });
        }
        if (state.favoritesOnly) {
            list = list.filter(function (a) { return a.favorite; });
        }
        return list;
    }

    function renderCategoryTabs() {
        var tabs = $("category-tabs");
        if (!tabs) return;
        if (!state.linked) {
            tabs.classList.add("is-hidden");
            tabs.innerHTML = "";
            return;
        }
        tabs.classList.remove("is-hidden");
        var counts = { ALL: state.assets.length };
        state.categories.forEach(function (c) {
            counts[c] = state.assets.filter(function (a) { return a.category === c; }).length;
        });
        var html = '<button type="button" class="category-tab' + (state.activeCategory === "ALL" ? " active" : "") + '" data-cat="ALL">ALL (' + counts.ALL + ")</button>";
        state.categories.forEach(function (c) {
            html += '<button type="button" class="category-tab' + (state.activeCategory === c ? " active" : "") + '" data-cat="' + c + '">' + c + " (" + (counts[c] || 0) + ")</button>";
        });
        tabs.innerHTML = html;
        tabs.querySelectorAll(".category-tab").forEach(function (btn) {
            btn.addEventListener("click", function () {
                state.activeCategory = btn.dataset.cat;
                renderCategoryTabs();
                renderAssets();
            });
        });
    }

    function renderSidebar() {
        var tree = $("sidebar-tree");
        if (!tree) return;
        if (!state.linked) {
            tree.innerHTML = '<div class="cv-tree-empty">Vincula una carpeta para empezar.</div>';
            return;
        }
        tree.innerHTML =
            '<div class="cv-tree-row active"><span class="cv-folder">' + Icons.html("link") + '</span><span class="cv-tree-label">' + state.libraryName + "</span></div>";
    }

    function renderList(assets) {
        var list = $("asset-list");
        list.innerHTML =
            '<div class="list-head"><span></span><span>Nombre</span><span>Tipo</span><span>Detalle</span></div>';
        assets.forEach(function (asset) {
            var row = document.createElement("div");
            row.className = "asset-row" + (state.selectedId === asset.id ? " selected" : "");
            row.innerHTML =
                '<div class="row-thumb">' + Icons.assetTypeHtml(asset.type, "sm") + "</div>" +
                '<span class="col-name-text">' + asset.name + "</span>" +
                '<span class="col-type">' + (TYPE_LABELS[asset.type] || asset.type) + "</span>" +
                '<span class="col-meta">' + asset.detail + "</span>";
            row.addEventListener("click", function () {
                state.selectedId = asset.id;
                renderAssets();
            });
            row.addEventListener("dblclick", function () {
                showToast("Aplicado: " + asset.name, "success");
            });
            list.appendChild(row);
        });
    }

    function renderGrid(assets) {
        var grid = $("asset-grid");
        grid.innerHTML = "";
        document.documentElement.style.setProperty("--grid-size", state.gridSize + "px");
        assets.forEach(function (asset) {
            var card = document.createElement("article");
            card.className = "asset-card" + (state.selectedId === asset.id ? " selected" : "");
            card.innerHTML =
                '<div class="card-thumb">' + Icons.assetTypeHtml(asset.type, "lg") + "</div>" +
                '<div class="asset-foot"><span class="card-title">' + asset.name + "</span></div>";
            card.addEventListener("click", function () {
                state.selectedId = asset.id;
                renderAssets();
            });
            card.addEventListener("dblclick", function () {
                showToast("Aplicado: " + asset.name, "success");
            });
            grid.appendChild(card);
        });
    }

    function renderAssets() {
        $("host-label").textContent = "After Effects";
        renderSidebar();
        renderCategoryTabs();

        if (!state.linked) {
            $("welcome-state").classList.remove("is-hidden");
            $("empty-state").classList.add("is-hidden");
            $("asset-grid").innerHTML = "";
            $("asset-list").innerHTML = "";
            $("breadcrumb").textContent = "—";
            $("status-count").textContent = "Sin carpeta vinculada";
            return;
        }

        $("welcome-state").classList.add("is-hidden");
        $("breadcrumb").textContent = state.libraryName;
        var assets = filteredAssets();
        $("status-count").textContent = assets.length + (assets.length === 1 ? " elemento" : " elementos");
        $("empty-state").classList.toggle("is-hidden", assets.length > 0);

        if (state.viewMode === "list") {
            $("asset-grid").classList.add("is-hidden");
            $("asset-list").classList.remove("is-hidden");
            renderList(assets);
        } else {
            $("asset-list").classList.add("is-hidden");
            $("asset-grid").classList.remove("is-hidden");
            renderGrid(assets);
        }
    }

    function openLinkModal() {
        $("link-path-input").value = state.libraryPath || "";
        $("link-selected-path").textContent = state.libraryPath || "—";
        $("link-modal").classList.remove("is-hidden");
    }

    function closeLinkModal() {
        $("link-modal").classList.add("is-hidden");
    }

    function confirmLink() {
        var path = ($("link-path-input").value || "").trim();
        if (!path) {
            showToast("Elige una carpeta", "error");
            return;
        }
        state.linked = true;
        state.libraryPath = path;
        var parts = path.replace(/\\/g, "/").split("/");
        state.libraryName = parts[parts.length - 1] || "Mi biblioteca";
        closeLinkModal();
        renderAssets();
        showToast("Biblioteca vinculada", "success");
    }

    function openSaveModal() {
        if (!state.linked) {
            showToast("Vincula una carpeta primero", "error");
            return;
        }
        var sel = $("save-category");
        sel.innerHTML = state.categories.map(function (c) {
            return '<option value="' + c + '">' + c + "</option>";
        }).join("");
        $("save-name").value = "";
        $("save-context").textContent = "Demo: simula guardar comp / capas / preset desde AE.";
        $("save-dest").textContent = state.libraryPath + "\\CompVault\\Comps\\";
        $("save-modal").classList.remove("is-hidden");
    }

    function closeSaveModal() {
        $("save-modal").classList.add("is-hidden");
    }

    function saveAsset(type) {
        var name = ($("save-name").value || "").trim();
        if (!name) {
            showToast("Escribe un nombre", "error");
            return;
        }
        var cat = $("save-category").value || "General";
        if (state.categories.indexOf(cat) < 0) state.categories.push(cat);
        state.assets.push({
            id: "a" + Date.now(),
            name: name,
            type: type,
            category: cat,
            detail: type === "comp" ? "1920×1080" : type === "layers" ? "3 capas" : ".ffx",
            favorite: false
        });
        closeSaveModal();
        state.activeCategory = "ALL";
        renderAssets();
        showToast("Guardado en " + cat, "success");
    }

    function bindEvents() {
        $("btn-link-folder").addEventListener("click", openLinkModal);
        $("btn-link-welcome").addEventListener("click", openLinkModal);
        $("btn-link-close").addEventListener("click", closeLinkModal);
        $("link-confirm").addEventListener("click", confirmLink);
        $("link-modal").addEventListener("click", function (e) {
            if (e.target === $("link-modal")) closeLinkModal();
        });

        $("btn-save-open").addEventListener("click", openSaveModal);
        $("btn-save-close").addEventListener("click", closeSaveModal);
        document.querySelectorAll(".save-type-card").forEach(function (card) {
            card.addEventListener("click", function () {
                saveAsset(card.dataset.save || "comp");
            });
        });

        $("btn-settings").addEventListener("click", function () {
            $("settings-linked-path").textContent = state.linked ? state.libraryPath : "—";
            $("settings-drawer").classList.remove("is-hidden");
        });
        $("btn-close-settings").addEventListener("click", function () {
            $("settings-drawer").classList.add("is-hidden");
        });
        $("btn-settings-link").addEventListener("click", function () {
            $("settings-drawer").classList.add("is-hidden");
            openLinkModal();
        });

        $("view-list").addEventListener("click", function () {
            state.viewMode = "list";
            syncViewUi();
            renderAssets();
        });
        $("view-grid").addEventListener("click", function () {
            state.viewMode = "grid";
            syncViewUi();
            renderAssets();
        });
        document.querySelectorAll(".size-btn").forEach(function (btn) {
            btn.addEventListener("click", function () {
                state.gridSize = parseInt(btn.dataset.size, 10) || 180;
                syncViewUi();
                renderAssets();
            });
        });

        $("btn-toggle-sidebar").addEventListener("click", function () {
            state.sidebarCollapsed = !state.sidebarCollapsed;
            syncViewUi();
        });

        $("btn-favorites").addEventListener("click", function () {
            state.favoritesOnly = !state.favoritesOnly;
            syncViewUi();
            renderAssets();
        });

        $("btn-multi-select").addEventListener("click", function () {
            state.multiSelect = !state.multiSelect;
            syncViewUi();
            showToast(state.multiSelect ? "Multiselección activa" : "Multiselección desactivada");
        });

        $("btn-export-pack").addEventListener("click", function () {
            showToast("Exportar categoría (.cvpack)", "info");
        });
        $("btn-import-pack").addEventListener("click", function () {
            showToast("Importar pack (.cvpack / .flexpack)", "info");
        });

        $("btn-save-add-category").addEventListener("click", function () {
            var name = ($("save-new-category").value || "").trim();
            if (!name || state.categories.indexOf(name) >= 0) return;
            state.categories.push(name);
            openSaveModal();
            $("save-category").value = name;
        });
    }

    function init() {
        mountIcons();
        syncViewUi();
        bindEvents();
        renderAssets();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
