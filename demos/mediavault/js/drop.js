/**
 * MediaVault by Animateoo — drag & drop helpers (CEP / Windows)
 */
const MediaVaultDrop = (function () {
    const path = window.require ? window.require("path") : require("path");
    const fs = window.require ? window.require("fs") : require("fs");

    function uriToLocalPath(uri) {
        if (!uri || typeof uri !== "string") return "";
        let s = uri.trim();
        if (!s || s.startsWith("#")) return "";
        if (/^file:/i.test(s)) {
            try {
                s = decodeURIComponent(s.replace(/^file:\/\//i, ""));
                if (/^\/[A-Za-z]:/.test(s)) s = s.slice(1);
            } catch (e) {}
        }
        return s.replace(/\//g, path.sep);
    }

    function pathFromFileLike(fileLike) {
        if (!fileLike) return "";
        const raw = fileLike.path || fileLike.fsName || fileLike.fullPath || fileLike.name || "";
        if (!raw || typeof raw !== "string") return "";
        const trimmed = raw.trim();
        if (/^[A-Za-z]:[\\/]/.test(trimmed) || trimmed.startsWith("\\\\")) {
            return path.resolve(trimmed);
        }
        if (trimmed.includes(path.sep) || trimmed.includes("/") || trimmed.includes("\\")) {
            try {
                const resolved = path.resolve(trimmed);
                if (fs.existsSync(resolved)) return resolved;
            } catch (e) {}
        }
        return "";
    }

    function normalizePath(p) {
        if (!p || typeof p !== "string") return "";
        let s = p.trim();
        if (/^file:/i.test(s)) s = uriToLocalPath(s);
        if (/^\/[A-Za-z]:/.test(s)) s = s.slice(1);
        try {
            return path.resolve(s.replace(/\//g, path.sep));
        } catch (e) {
            return "";
        }
    }

    let internalDragPath = null;

    function hasFileDragPayload(ev) {
        const dt = ev && ev.dataTransfer;
        if (!dt || !dt.types || dt.types.length === 0) return internalDragPath !== null;
        const types = Array.prototype.slice.call(dt.types);
        return types.some(function (t) {
            const s = String(t).toLowerCase();
            return s === "files" || s.indexOf("file") >= 0;
        });
    }

    function setInternalDragPath(p) {
        internalDragPath = p || null;
    }

    function hasInternalDragPath() {
        return !!internalDragPath;
    }

    function consumeInternalDragPath() {
        const p = internalDragPath;
        internalDragPath = null;
        return p;
    }

    function extractPathsFromDataTransfer(dt) {
        if (!dt) return [];
        const out = [];
        const seen = {};

        function push(raw) {
            const abs = normalizePath(typeof raw === "string" && /^file:/i.test(raw) ? uriToLocalPath(raw) : raw);
            if (!abs || !fs.existsSync(abs)) return;
            const key = abs.toLowerCase();
            if (seen[key]) return;
            seen[key] = true;
            out.push(abs);
        }

        if (typeof dt.getData === "function") {
            for (var ci = 0; ci < 16; ci++) {
                try {
                    var cepPath = dt.getData("com.adobe.cep.dnd.file." + ci);
                    if (cepPath) push(cepPath);
                    else if (ci > 0) break;
                } catch (e1) {
                    break;
                }
            }

            ["text/uri-list", "text/plain", "text"].forEach(function (mime) {
                let blob;
                try {
                    blob = dt.getData(mime);
                } catch (e) {
                    blob = "";
                }
                if (typeof blob !== "string" || !blob.trim()) return;
                blob.split(/\r?\n/).forEach(function (line) {
                    if (line && !line.startsWith("#")) push(line);
                });
            });
        }

        const fileList = dt.files ? Array.from(dt.files) : [];
        fileList.forEach(function (f) {
            push(pathFromFileLike(f));
        });

        const items = dt.items ? Array.from(dt.items) : [];
        items.forEach(function (item) {
            if (item.kind !== "file" || typeof item.getAsFile !== "function") return;
            push(pathFromFileLike(item.getAsFile()));
        });

        return out;
    }

    function classifyPaths(paths) {
        const folders = [];
        const files = [];
        paths.forEach(function (p) {
            try {
                const st = fs.lstatSync(p);
                if (st.isDirectory()) folders.push(p);
                else if (st.isFile()) files.push(p);
            } catch (e) {}
        });
        return { folders: folders, files: files };
    }

    function toNativeDragPath(absPath) {
        const abs = normalizePath(absPath);
        if (!abs) return "";
        if (path.sep === "\\") return abs.replace(/\//g, "\\");
        return abs;
    }

    function setAdobeFileDrag(ev, filePaths) {
        const dt = ev && ev.dataTransfer;
        if (!dt) return false;

        const list = Array.isArray(filePaths) ? filePaths : [filePaths];
        const native = list.map(toNativeDragPath).filter(Boolean);
        if (!native.length) return false;

        native.forEach(function (p, i) {
            dt.setData("com.adobe.cep.dnd.file." + i, p);
        });
        dt.setData("text/plain", native[0]);
        dt.setData(
            "text/uri-list",
            "file:///" + encodeURI(native[0].replace(/\\/g, "/")).replace(/^file:\/\/\//, "file:///")
        );
        try {
            dt.setData("Files", native[0]);
        } catch (eFiles) {}
        dt.effectAllowed = "copyMove";
        return true;
    }

    function bindAssetDrag(el, getPath, onDragEnd) {
        if (!el) return;
        el.draggable = true;
        el.classList.add("asset-draggable");

        el.addEventListener("dragstart", function (e) {
            if (e.target.closest(".fav-btn")) {
                e.preventDefault();
                return;
            }
            const filePath = typeof getPath === "function" ? getPath() : getPath;
            if (!filePath || !setAdobeFileDrag(e, filePath)) {
                e.preventDefault();
                return;
            }
            setInternalDragPath(filePath);
            el.classList.add("is-dragging");
        });

        el.addEventListener("dragend", function (e) {
            el.classList.remove("is-dragging");
            const filePath = internalDragPath;
            setInternalDragPath(null);
            if (typeof onDragEnd === "function") onDragEnd(e, filePath);
        });
    }

    return {
        hasFileDragPayload: hasFileDragPayload,
        extractPathsFromDataTransfer: extractPathsFromDataTransfer,
        classifyPaths: classifyPaths,
        normalizePath: normalizePath,
        setAdobeFileDrag: setAdobeFileDrag,
        bindAssetDrag: bindAssetDrag,
        hasInternalDragPath: hasInternalDragPath,
        consumeInternalDragPath: consumeInternalDragPath
    };
})();
