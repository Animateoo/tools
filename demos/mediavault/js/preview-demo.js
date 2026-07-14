/**
 * MediaVault — demo web interactivo (réplica del panel AE con biblioteca vinculada)
 */
(function () {
    "use strict";

    var Icons = MediaVaultIcons;
    var $ = function (id) { return document.getElementById(id); };

    var TREE = {
        id: "audios",
        label: "AUDIOS",
        children: [
            {
                id: "sounds-fx",
                label: "Sounds FX",
                children: [
                    {
                        id: "movement",
                        label: "Movement",
                        children: [
                            { id: "climbing-ladder", label: "Climbing Ladder" },
                            { id: "climbing-stairs", label: "Climbing Stairs" },
                            { id: "falling", label: "Falling Sounds" },
                            { id: "footsteps", label: "Footsteps" },
                            { id: "jumping", label: "Jumping and Landing" },
                            { id: "opening-doors", label: "Opening Doors" },
                            { id: "portals", label: "Portals and Transitions" },
                            { id: "vehicles", label: "Vehicles" }
                        ]
                    },
                    {
                        id: "essential",
                        label: "Essential Sounds Effects",
                        children: [
                            { id: "approach", label: "Approach" },
                            { id: "bass", label: "Bass" },
                            { id: "beep", label: "Beep" },
                            { id: "bleep", label: "Bleep" }
                        ]
                    },
                    { id: "transitions", label: "Transitions" }
                ]
            }
        ]
    };

    var state = {
        linked: true,
        libraryName: "Sounds FX",
        activeFolderId: "movement",
        expanded: { audios: true, "sounds-fx": true, movement: true },
        viewMode: "grid",
        thumbSize: 120,
        favoritesOnly: false,
        showFavorites: false,
        selectedId: null,
        search: "",
        sidebarCollapsed: false
    };

    var gridVirt = null;

    function folderPath(folderId) {
        if (folderId === "movement") return "Sounds FX / Movement";
        if (folderId === "essential") return "Sounds FX / Essential S…";
        if (folderId === "sounds-fx") return "Sounds FX";
        if (folderId === "audios") return "AUDIOS";
        if (folderId === "opening-doors") return "Sounds FX / Movement / Opening Doors";
        if (folderId === "footsteps") return "Sounds FX / Movement / Footsteps";
        var node = findNode(folderId);
        return node ? "Sounds FX / Movement / " + node.label : "Sounds FX";
    }

    function findNode(id, node) {
        node = node || TREE;
        if (node.id === id) return node;
        if (!node.children) return null;
        for (var i = 0; i < node.children.length; i++) {
            var found = findNode(id, node.children[i]);
            if (found) return found;
        }
        return null;
    }

    function filesForFolder(folderId) {
        var seeds = {
            movement: 105,
            essential: 20,
            "opening-doors": 14,
            footsteps: 18,
            transitions: 52,
            "sounds-fx": 8
        };
        var count = seeds[folderId] || 12;
        var prefix = {
            movement: "sfx_move_",
            essential: "DIGI.Transition.",
            "opening-doors": "Door_Open_",
            footsteps: "Footstep_",
            transitions: "DIGI.Transition.",
            "sounds-fx": "SFX_"
        }[folderId] || "Audio_";

        var list = [];
        var i;
        for (i = 1; i <= count; i++) {
            list.push({
                id: folderId + "-" + i,
                name: prefix + i,
                folderId: folderId,
                type: "audio",
                favorite: i % 7 === 0
            });
        }
        return list;
    }

    function showToast(msg) {
        var t = $("toast");
        if (!t) return;
        t.textContent = msg;
        t.classList.remove("is-hidden");
        clearTimeout(showToast._t);
        showToast._t = setTimeout(function () { t.classList.add("is-hidden"); }, 2000);
    }

    function mountIcons() {
        $("btn-toggle-sidebar").innerHTML = Icons.html("sidebar");
        $("view-list").innerHTML = Icons.html("list");
        $("view-grid").innerHTML = Icons.html("grid");
        $("btn-favorites").innerHTML = Icons.starHtml(state.showFavorites);
    }

    function thumbWaveHeight(size) {
        return Math.max(30, Math.round(size * 0.36));
    }

    function readGridLayoutVars(grid) {
        var styles = window.getComputedStyle(grid);
        return {
            padX: parseFloat(styles.getPropertyValue("--grid-pad-x")) || 12,
            padY: parseFloat(styles.getPropertyValue("--grid-pad-y")) || 10,
            gap: parseFloat(styles.getPropertyValue("--grid-gap")) || 10
        };
    }

    function applyGridLayout() {
        var grid = $("asset-grid");
        if (!grid) return;
        var waveH = thumbWaveHeight(state.thumbSize);
        grid.classList.add("mv-demo-grid");
        grid.style.setProperty("--thumb-size", state.thumbSize + "px");
        grid.style.setProperty("--card-wave-h", waveH + "px");
    }

    function syncViewUi() {
        $("view-list").classList.toggle("active", state.viewMode === "list");
        $("view-grid").classList.toggle("active", state.viewMode === "grid");
        $("asset-grid").classList.toggle("is-hidden", state.viewMode !== "grid");
        $("asset-list").classList.toggle("is-hidden", state.viewMode !== "list");
        $("size-toggle").classList.toggle("is-hidden", state.viewMode !== "grid");
        document.querySelectorAll("#size-toggle .size-btn").forEach(function (btn) {
            var sz = parseInt(btn.dataset.size, 10);
            btn.classList.toggle("active", sz === state.thumbSize);
        });
        $("workspace").classList.toggle("sidebar-collapsed", state.sidebarCollapsed);
        $("btn-toggle-sidebar").classList.toggle("is-active", !state.sidebarCollapsed);
        $("btn-favorites").innerHTML = Icons.starHtml(state.showFavorites);
        $("btn-favorites").classList.toggle("active", state.showFavorites);
        if (state.viewMode === "grid") applyGridLayout();
    }

    function genPeaks(n, seed) {
        var p = [], i, t, v;
        for (i = 0; i < n; i++) {
            t = i / (n - 1);
            v = Math.exp(-Math.max(0, t - 0.05) * (2.5 + (seed % 4))) * (0.7 + 0.3 * Math.sin(seed * 0.7 + i * 0.2));
            if (folderIsMovement(state.activeFolderId)) {
                v *= 0.6 + 0.4 * Math.abs(Math.sin(i * 0.35 + seed));
            }
            p.push(Math.max(0.06, Math.min(1, v)));
        }
        return p;
    }

    function folderIsMovement(id) {
        return id === "movement" || ["climbing-ladder", "climbing-stairs", "falling", "footsteps", "jumping", "opening-doors", "portals", "vehicles"].indexOf(id) >= 0;
    }

    function maxPeakValue(data) {
        var m = 0, i;
        for (i = 0; i < data.length; i++) m = Math.max(m, data[i] || 0);
        return m || 1;
    }

    function drawBarWaveform(ctx, w, h, peaks, style) {
        var padX = style.padX != null ? style.padX : 3;
        var padY = style.padY != null ? style.padY : 2;
        var amplitude = style.amplitude != null ? style.amplitude : 0.9;
        var barW = style.barWidth != null ? style.barWidth : (w < 100 ? 1 : 1.5);
        var barGap = style.barGap != null ? style.barGap : (w < 120 ? 1 : 2);
        var yCenter = h / 2;
        var halfH = Math.max(3, (h - padY * 2) / 2);
        var innerW = Math.max(1, w - padX * 2);
        var step = barW + barGap;
        var barCount = Math.max(6, Math.floor(innerW / step));
        var maxP = maxPeakValue(peaks);
        var scale = (halfH * amplitude) / maxP;
        var i, peakIdx, barH, x;

        ctx.fillStyle = style.bg || "#141414";
        ctx.fillRect(0, 0, w, h);

        ctx.strokeStyle = style.centerLineColor || "rgba(255,255,255,0.14)";
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(padX, yCenter + 0.5);
        ctx.lineTo(w - padX, yCenter + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = style.barColor || "rgba(255,255,255,0.78)";
        for (i = 0; i < barCount; i++) {
            peakIdx = Math.min(peaks.length - 1, Math.floor((i / barCount) * peaks.length));
            barH = Math.max(0.5, (peaks[peakIdx] || 0) * scale);
            x = padX + i * step;
            ctx.fillRect(x, yCenter - barH, barW, barH * 2);
        }

        ctx.strokeStyle = "rgba(255,255,255,0.42)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padX + 0.5, 1);
        ctx.lineTo(padX + 0.5, h - 1);
        ctx.stroke();
    }

    function drawCardWave(canvas, seed, cellW) {
        var waveH = thumbWaveHeight(state.thumbSize);
        var w = Math.max(48, Math.floor(cellW || state.thumbSize));
        var h = waveH;
        var dpr = window.devicePixelRatio || 1;

        canvas.width = Math.max(1, Math.floor(w * dpr));
        canvas.height = Math.max(1, Math.floor(h * dpr));
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";

        var wrap = canvas.parentElement;
        if (wrap) {
            wrap.style.height = h + "px";
            wrap.style.minHeight = h + "px";
            wrap.style.maxHeight = h + "px";
        }

        var ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawBarWaveform(ctx, w, h, genPeaks(120, seed), {
            bg: "#141414",
            barColor: "rgba(255,255,255,0.78)",
            padX: 3,
            padY: 2,
            amplitude: 0.9,
            barWidth: w < 100 ? 1 : 1.5,
            barGap: w < 120 ? 1 : 2
        });
    }

    function destroyGridVirt() {
        if (!gridVirt) return;
        var grid = gridVirt.grid;
        if (gridVirt.onScroll) grid.removeEventListener("scroll", gridVirt.onScroll);
        if (gridVirt.ro) gridVirt.ro.disconnect();
        if (gridVirt.scrollRaf) cancelAnimationFrame(gridVirt.scrollRaf);
        gridVirt = null;
    }

    function gridMetrics(virt) {
        var layout = readGridLayoutVars(virt.grid);
        virt.padX = layout.padX;
        virt.padY = layout.padY;
        virt.gap = layout.gap;

        var gridW = Math.max(1, virt.grid.clientWidth);
        var innerW = Math.max(1, gridW - virt.padX * 2);
        var cols = Math.max(1, Math.floor((innerW + virt.gap) / (state.thumbSize + virt.gap)));
        var cellW = (innerW - (cols - 1) * virt.gap) / cols;
        var rowH = virt.cardH + virt.gap;
        var rows = Math.max(1, Math.ceil(virt.files.length / cols));

        virt.cols = cols;
        virt.cellW = cellW;
        virt.rowH = rowH;
        virt.spacer.style.height = (rows * rowH - virt.gap + virt.padY * 2) + "px";
    }

    function buildGridCard(file, cellW, index) {
        var card = document.createElement("article");
        card.className = "asset-card mv-grid-card" + (state.selectedId === file.id ? " selected" : "");
        card.dataset.id = file.id;

        var wave = document.createElement("div");
        wave.className = "card-wave-wrap type-audio";
        var canvas = document.createElement("canvas");
        canvas.className = "card-wave";
        wave.appendChild(canvas);

        var foot = document.createElement("div");
        foot.className = "asset-foot mv-card-foot";
        foot.innerHTML =
            '<span class="card-type-icon type-audio">' + Icons.typeHtml("audio") + "</span>" +
            '<span class="card-title">' + file.name + "</span>" +
            '<button type="button" class="fav-btn" title="Favorito">' + (file.favorite ? "★" : "☆") + "</button>";

        card.appendChild(wave);
        card.appendChild(foot);

        card.addEventListener("click", function () {
            state.selectedId = file.id;
            renderFiles();
        });
        card.addEventListener("dblclick", function () {
            showToast("Añadido al timeline: " + file.name);
        });
        foot.querySelector(".fav-btn").addEventListener("click", function (e) {
            e.stopPropagation();
            file.favorite = !file.favorite;
            renderFiles();
        });

        drawCardWave(canvas, index * 2.1 + 1.3, cellW);
        return card;
    }

    function renderGridWindow(force) {
        if (!gridVirt) return;
        var virt = gridVirt;
        gridMetrics(virt);

        var cols = virt.cols;
        var padX = virt.padX;
        var padY = virt.padY;
        var gap = virt.gap;
        var rowH = virt.rowH;
        var cellW = virt.cellW;
        var files = virt.files;
        var scrollTop = virt.grid.scrollTop;
        var viewH = virt.grid.clientHeight;

        var startRow = Math.max(0, Math.floor((scrollTop - padY) / rowH) - 2);
        var endRow = Math.min(
            Math.ceil(files.length / cols),
            Math.ceil((scrollTop + viewH - padY) / rowH) + 3
        );
        var start = startRow * cols;
        var end = Math.min(files.length, endRow * cols);

        if (!force && start === virt.start && end === virt.end && cols === virt.lastCols && cellW === virt.lastCellW) {
            return;
        }

        virt.start = start;
        virt.end = end;
        virt.lastCols = cols;
        virt.lastCellW = cellW;

        var savedScroll = virt.grid.scrollTop;
        virt.window.innerHTML = "";

        var i, file, col, row, card;
        for (i = start; i < end; i++) {
            file = files[i];
            col = i % cols;
            row = Math.floor(i / cols);
            card = buildGridCard(file, cellW, i);
            card.style.position = "absolute";
            card.style.width = cellW + "px";
            card.style.left = padX + col * (cellW + gap) + "px";
            card.style.top = padY + row * rowH + "px";
            virt.window.appendChild(card);
        }

        virt.grid.scrollTop = savedScroll;
    }

    function relayoutGrid(preserveScroll) {
        if (!gridVirt) return;
        var scroll = preserveScroll !== false ? gridVirt.grid.scrollTop : 0;
        gridVirt.start = -1;
        renderGridWindow(true);
        if (preserveScroll !== false) gridVirt.grid.scrollTop = scroll;
    }

    function initGridVirtual(files, scrollTop) {
        destroyGridVirt();
        var grid = $("asset-grid");
        applyGridLayout();

        var waveH = thumbWaveHeight(state.thumbSize);
        var footH = 24;
        var layout = readGridLayoutVars(grid);

        grid.innerHTML = "";

        var spacer = document.createElement("div");
        spacer.className = "grid-virtual-spacer";

        var windowEl = document.createElement("div");
        windowEl.className = "grid-virtual-window";

        grid.appendChild(spacer);
        grid.appendChild(windowEl);

        gridVirt = {
            grid: grid,
            spacer: spacer,
            window: windowEl,
            files: files,
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

        gridVirt.onScroll = function () {
            if (gridVirt.scrollRaf) return;
            gridVirt.scrollRaf = requestAnimationFrame(function () {
                gridVirt.scrollRaf = 0;
                renderGridWindow(false);
            });
        };

        grid.addEventListener("scroll", gridVirt.onScroll, { passive: true });

        if (typeof ResizeObserver !== "undefined") {
            gridVirt.ro = new ResizeObserver(function () {
                relayoutGrid(true);
            });
            gridVirt.ro.observe(grid);
        }

        renderGridWindow(true);
        grid.scrollTop = scrollTop || 0;
    }

    function renderGrid(files) {
        if (!files.length) {
            destroyGridVirt();
            $("asset-grid").innerHTML = "";
            return;
        }
        var prevScroll = gridVirt && gridVirt.grid ? gridVirt.grid.scrollTop : 0;
        initGridVirtual(files, prevScroll);
    }

    function renderTree(node, depth) {
        depth = depth || 0;
        var html = "";
        var hasKids = node.children && node.children.length;
        var expanded = state.expanded[node.id];
        var active = state.activeFolderId === node.id;
        var pad = 8 + depth * 12;
        html += '<div class="mv-tree-row' + (active ? " active" : "") + (depth ? " mv-tree-sub" : "") + '" data-id="' + node.id + '" style="padding-left:' + pad + 'px">';
        if (hasKids) {
            html += '<span class="mv-tgl" data-toggle="' + node.id + '">' + (expanded ? "▾" : "▸") + "</span>";
        } else {
            html += '<span class="mv-tgl mv-tgl-spacer"></span>';
        }
        html += "<span>" + node.label + (hasKids && !expanded ? " (+)" : "") + "</span></div>";
        if (hasKids && expanded) {
            node.children.forEach(function (child) {
                html += renderTree(child, depth + 1);
            });
        }
        return html;
    }

    function renderFolderTree() {
        var panel = $("folder-tree");
        panel.innerHTML = renderTree(TREE);
        panel.classList.add("has-active");
        panel.querySelectorAll(".mv-tree-row").forEach(function (row) {
            row.addEventListener("click", function (e) {
                var toggle = e.target.closest("[data-toggle]");
                if (toggle) {
                    e.stopPropagation();
                    var id = toggle.dataset.toggle;
                    state.expanded[id] = !state.expanded[id];
                    renderFolderTree();
                    return;
                }
                var id = row.dataset.id;
                if (!id) return;
                state.activeFolderId = id;
                state.selectedId = null;
                renderFolderTree();
                renderFiles();
            });
        });
    }

    function filteredFiles() {
        var files = filesForFolder(state.activeFolderId);
        if (state.search) {
            var q = state.search.toLowerCase();
            files = files.filter(function (f) { return f.name.toLowerCase().indexOf(q) >= 0; });
        }
        if (state.showFavorites) {
            files = files.filter(function (f) { return f.favorite; });
        }
        return files;
    }

    function renderList(files) {
        var list = $("asset-list");
        list.innerHTML =
            '<div class="list-head list-head-details"><span></span><span>Nombre</span><span>Tipo</span><span>Dur.</span><span>Detalle</span><span></span></div>';
        files.forEach(function (file, i) {
            var row = document.createElement("div");
            row.className = "asset-row asset-row-details" + (state.selectedId === file.id ? " selected" : "");
            row.innerHTML =
                '<span class="col-icon">' + Icons.typeHtml("audio") + "</span>" +
                '<span class="col-name">' + file.name + "</span>" +
                '<span class="col-type">Audio</span>' +
                '<span class="col-dur">0:' + String((i % 9) + 1).padStart(2, "0") + "</span>" +
                '<span class="col-meta">.wav</span>' +
                '<button type="button" class="fav-btn">' + (file.favorite ? "★" : "☆") + "</button>";
            row.addEventListener("click", function () {
                state.selectedId = file.id;
                renderFiles();
            });
            row.addEventListener("dblclick", function () {
                showToast("Añadido al timeline: " + file.name);
            });
            list.appendChild(row);
        });
    }

    function renderFiles() {
        $("host-label").textContent = "After Effects";
        $("welcome-state").classList.add("is-hidden");
        $("empty-state").classList.add("is-hidden");
        $("breadcrumb").textContent = folderPath(state.activeFolderId);
        var files = filteredFiles();
        $("status-count").textContent = files.length + " archivos";
        $("status-hint").textContent =
            "Arrastrar → suelta en timeline · Doble clic → timeline · Ctrl+B → biblioteca · Esc → cerrar preview · Video: clic + mover";

        if (state.viewMode === "grid") {
            renderGrid(files);
        } else {
            destroyGridVirt();
            renderList(files);
        }
        syncViewUi();
    }

    function openLinkModal() {
        $("link-path-input").value = "D:\\Media\\Sounds FX";
        $("link-selected-path").textContent = "D:\\Media\\Sounds FX";
        $("link-confirm").disabled = false;
        $("link-modal").classList.remove("is-hidden");
    }

    function closeLinkModal() {
        $("link-modal").classList.add("is-hidden");
    }

    function bindEvents() {
        $("btn-link-folder").addEventListener("click", openLinkModal);
        $("btn-link-welcome").addEventListener("click", openLinkModal);
        $("btn-link-close").addEventListener("click", closeLinkModal);
        $("link-confirm").addEventListener("click", function () {
            state.linked = true;
            closeLinkModal();
            renderFiles();
            showToast("Biblioteca vinculada");
        });
        $("link-modal").addEventListener("click", function (e) {
            if (e.target === $("link-modal")) closeLinkModal();
        });

        $("search-input").addEventListener("input", function () {
            state.search = $("search-input").value.trim();
            renderFiles();
        });

        $("view-toggle").addEventListener("click", function (e) {
            var btn = e.target.closest(".view-btn");
            if (!btn) return;
            state.viewMode = btn.id === "view-list" ? "list" : "grid";
            syncViewUi();
            renderFiles();
        });

        $("size-toggle").addEventListener("click", function (e) {
            var btn = e.target.closest(".size-btn");
            if (!btn || state.viewMode !== "grid") return;
            state.thumbSize = parseInt(btn.dataset.size, 10) || 120;
            syncViewUi();
            renderFiles();
        });

        $("btn-toggle-sidebar").addEventListener("click", function () {
            state.sidebarCollapsed = !state.sidebarCollapsed;
            syncViewUi();
            if (state.viewMode === "grid") relayoutGrid(true);
        });

        $("btn-favorites").addEventListener("click", function () {
            state.showFavorites = !state.showFavorites;
            syncViewUi();
            renderFiles();
        });

        $("btn-settings").addEventListener("click", function () {
            $("settings-drawer").classList.remove("is-hidden");
        });
        $("btn-close-settings").addEventListener("click", function () {
            $("settings-drawer").classList.add("is-hidden");
        });
    }

    function init() {
        mountIcons();
        syncViewUi();
        bindEvents();
        renderFolderTree();
        renderFiles();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
