/**
 * AssetPack — demo web interactivo (réplica de la barra del panel AE)
 */
(function () {
    "use strict";

    var $ = function (id) { return document.getElementById(id); };

    var state = {
        configOpen: false,
        consoleOpen: false,
        progressTimer: null
    };

    function log(msg, cls) {
        var logs = $("logs");
        if (!logs) return;
        var line = document.createElement("div");
        line.className = cls || "log-info";
        line.textContent = msg;
        logs.appendChild(line);
        logs.scrollTop = logs.scrollHeight;
    }

    function flash(btn) {
        if (!btn) return;
        btn.classList.add("active");
        setTimeout(function () { btn.classList.remove("active"); }, 220);
    }

    function syncPanels() {
        $("config-bar").classList.toggle("is-hidden", !state.configOpen);
        $("log-wrapper").classList.toggle("is-hidden", !state.consoleOpen);
        $("btn-toggle-path").classList.toggle("active", state.configOpen);
        $("btn-toggle-console").classList.toggle("active", state.consoleOpen);
    }

    function showProgress(label, onDone) {
        var wrap = $("transfer-progress");
        var bar = $("transfer-progress-bar");
        var lbl = $("transfer-progress-label");
        if (!wrap || !bar) return;

        clearInterval(state.progressTimer);
        wrap.classList.remove("is-hidden");
        lbl.textContent = label;
        bar.style.width = "0%";

        var pct = 0;
        state.progressTimer = setInterval(function () {
            pct += 8 + Math.random() * 12;
            if (pct >= 100) {
                pct = 100;
                bar.style.width = "100%";
                clearInterval(state.progressTimer);
                state.progressTimer = null;
                setTimeout(function () {
                    wrap.classList.add("is-hidden");
                    bar.style.width = "0%";
                    if (onDone) onDone();
                }, 350);
                return;
            }
            bar.style.width = pct + "%";
        }, 120);
    }

    function cancelProgress() {
        clearInterval(state.progressTimer);
        state.progressTimer = null;
        $("transfer-progress").classList.add("is-hidden");
        $("transfer-progress-bar").style.width = "0%";
        log("Operación cancelada.", "log-warn");
    }

    function bindEvents() {
        $("btn-toggle-path").addEventListener("click", function () {
            state.configOpen = !state.configOpen;
            syncPanels();
        });

        $("btn-toggle-console").addEventListener("click", function () {
            state.consoleOpen = !state.consoleOpen;
            syncPanels();
            if (state.consoleOpen) log("Consola abierta.", "log-info");
        });

        $("btn-root-all").addEventListener("click", function () {
            flash(this);
            showProgress("Root All…", function () {
                log("12 assets movidos a (Footage).", "log-success");
                $("badge-ok").textContent = "15";
                $("badge-warn").textContent = "0";
                $("badge-warn-container").style.display = "none";
            });
        });

        $("btn-batch-export").addEventListener("click", function () {
            flash(this);
            showProgress("Collect nativo + ZIP…", function () {
                log("Collect completado → proyecto.zip", "log-success");
            });
        });

        $("btn-collect").addEventListener("click", function () {
            flash(this);
            showProgress("Timeline → ZIP…", function () {
                log("8 capas exportadas a timeline_collect.zip", "log-success");
            });
        });

        $("btn-find").addEventListener("click", function () {
            flash(this);
            log("Buscando missing en biblioteca del proyecto…", "log-info");
            setTimeout(function () {
                $("badge-err").textContent = "0";
                $("badge-err-container").style.display = "none";
                log("1 archivo recuperado y revinculado.", "log-success");
            }, 700);
        });

        $("btn-select-folder").addEventListener("click", function () {
            flash(this);
            $("root-path-input").value = "D:\\Proyectos\\Mi_AE\\(Footage)";
            log("Carpeta root actualizada.", "log-info");
        });

        $("btn-cancel-transfer").addEventListener("click", cancelProgress);
    }

    function init() {
        syncPanels();
        bindEvents();
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
    else init();
})();
