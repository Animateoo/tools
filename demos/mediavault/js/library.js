/**
 * MediaVault by Animateoo — filesystem scanner, settings, file catalog
 */
const MediaVaultLibrary = (function () {
    const fs = window.require ? window.require("fs") : require("fs");
    const path = window.require ? window.require("path") : require("path");
    const os = window.require ? window.require("os") : require("os");

    const EXT = {
        video: [
            "mp4", "mov", "avi", "mkv", "webm", "mxf", "r3d", "mts", "m2ts",
            "mpg", "mpeg", "wmv", "flv", "m4v", "3gp", "prores"
        ],
        audio: [
            "wav", "mp3", "aiff", "aif", "aac", "m4a", "ogg", "flac", "wma", "caf"
        ],
        image: [
            "png", "jpg", "jpeg", "gif", "tiff", "tif", "psd", "exr", "dpx", "bmp",
            "webp", "svg", "heic"
        ],
        project: ["aep", "aepx", "prproj"],
        preset: ["ffx", "mogrt"]
    };

    const ALL_EXTS = [].concat(
        EXT.video,
        EXT.audio,
        EXT.image,
        EXT.project,
        EXT.preset
    );

    function settingsDir() {
        return path.join(os.homedir(), "AppData", "Roaming", "MediaVault");
    }

    function settingsPath() {
        return path.join(settingsDir(), "settings.json");
    }

    function cachePath() {
        return path.join(settingsDir(), "cache.json");
    }

    function ensureDir(dir) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    function defaultSettings() {
        return {
            folders: [],
            favorites: [],
            addToTimeline: true,
            copyToProjectFootage: true,
            scanSubfolders: true,
            showHidden: false,
            hoverPreview: true,
            viewMode: "icons-m",
            expandedTree: [],
            thumbSize: 130,
            previewVolume: 0.85,
            previewWaveHeight: 72,
            previewVideoHeight: 180,
            lastFolder: null,
            lastLibraryId: null,
            hiddenFolders: {},
            sidebarCollapsed: false,
            searchPins: []
        };
    }

    function readSettings() {
        ensureDir(settingsDir());
        const p = settingsPath();
        if (!fs.existsSync(p)) {
            const d = defaultSettings();
            fs.writeFileSync(p, JSON.stringify(d, null, 2), "utf8");
            return d;
        }
        try {
            return Object.assign(defaultSettings(), JSON.parse(fs.readFileSync(p, "utf8")));
        } catch (e) {
            return defaultSettings();
        }
    }

    function writeSettings(data) {
        ensureDir(settingsDir());
        fs.writeFileSync(settingsPath(), JSON.stringify(data, null, 2), "utf8");
    }

    function readCache() {
        const p = cachePath();
        if (!fs.existsSync(p)) return { libraries: {}, scannedAt: 0 };
        try {
            return JSON.parse(fs.readFileSync(p, "utf8"));
        } catch (e) {
            return { libraries: {}, scannedAt: 0 };
        }
    }

    function writeCache(data) {
        ensureDir(settingsDir());
        fs.writeFileSync(cachePath(), JSON.stringify(data, null, 2), "utf8");
    }

    function getExt(fileName) {
        const m = String(fileName).match(/\.([^.]+)$/);
        return m ? m[1].toLowerCase() : "";
    }

    function getFileType(ext) {
        if (EXT.video.indexOf(ext) >= 0) return "video";
        if (EXT.audio.indexOf(ext) >= 0) return "audio";
        if (EXT.image.indexOf(ext) >= 0) return "image";
        if (EXT.project.indexOf(ext) >= 0) return "project";
        if (EXT.preset.indexOf(ext) >= 0) return "preset";
        return "other";
    }

    function isSupportedFile(fileName) {
        return ALL_EXTS.indexOf(getExt(fileName)) >= 0;
    }

    function slugId(str) {
        return String(str).replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_|_$/g, "").toLowerCase();
    }

    function libraryId(folderPath) {
        return slugId(folderPath);
    }

    function isExcludedRel(rel, excludePaths) {
        if (!excludePaths || !excludePaths.length || rel == null) return false;
        const normalized = String(rel).replace(/\\/g, "/");
        for (let i = 0; i < excludePaths.length; i++) {
            const ex = String(excludePaths[i]).replace(/\\/g, "/");
            if (!ex) continue;
            if (normalized === ex || normalized.indexOf(ex + "/") === 0) return true;
        }
        return false;
    }

    function scanFolder(rootPath, options) {
        const opts = options || {};
        const recursive = opts.recursive !== false;
        const showHidden = !!opts.showHidden;
        const excludePaths = opts.excludePaths || [];
        const nodes = [];
        const files = [];

        function walk(dirPath, relParts) {
            if (!fs.existsSync(dirPath)) return;

            let entries;
            try {
                entries = fs.readdirSync(dirPath, { withFileTypes: true });
            } catch (e) {
                return;
            }

            entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

            for (const entry of entries) {
                if (!showHidden && entry.name.startsWith(".")) continue;

                const abs = path.join(dirPath, entry.name);
                const rel = (relParts || []).concat(entry.name).join("/");

                if (entry.isDirectory()) {
                    if (isExcludedRel(rel, excludePaths)) continue;

                    const node = {
                        id: rel,
                        name: entry.name,
                        path: abs,
                        type: "folder",
                        children: []
                    };
                    nodes.push(node);
                    if (recursive) {
                        node.children = scanFolderChildren(abs, relParts ? relParts.concat(entry.name) : [entry.name], opts);
                    }
                } else if (entry.isFile() && isSupportedFile(entry.name)) {
                    const ext = getExt(entry.name);
                    let stat;
                    try {
                        stat = fs.statSync(abs);
                    } catch (e2) {
                        continue;
                    }
                    files.push({
                        id: rel,
                        name: entry.name,
                        path: abs,
                        relPath: rel,
                        ext: ext,
                        type: getFileType(ext),
                        size: stat.size,
                        modified: stat.mtimeMs
                    });
                }
            }
        }

        function scanFolderChildren(dirPath, relParts, o) {
            const childNodes = [];
            let entries;
            try {
                entries = fs.readdirSync(dirPath, { withFileTypes: true });
            } catch (e) {
                return childNodes;
            }
            for (const entry of entries) {
                if (!o.showHidden && entry.name.startsWith(".")) continue;
                const abs = path.join(dirPath, entry.name);
                const rel = relParts.concat(entry.name).join("/");
                if (entry.isDirectory()) {
                    if (isExcludedRel(rel, o.excludePaths || [])) continue;

                    const node = {
                        id: rel,
                        name: entry.name,
                        path: abs,
                        type: "folder",
                        children: o.recursive !== false
                            ? scanFolderChildren(abs, relParts.concat(entry.name), o)
                            : []
                    };
                    childNodes.push(node);
                }
            }
            childNodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
            return childNodes;
        }

        walk(rootPath, []);

        let allFiles = files.slice();
        if (recursive) {
            allFiles = allFiles.concat(collectFilesRecursive(rootPath, [], opts));
        }

        const unique = {};
        allFiles.forEach((f) => {
            unique[f.path] = f;
        });

        return {
            root: rootPath,
            tree: nodes.filter((n) => n.type === "folder"),
            files: Object.keys(unique).map((k) => unique[k]).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
        };
    }

    function collectFilesRecursive(dirPath, relParts, opts) {
        const out = [];
        if (!fs.existsSync(dirPath)) return out;

        let entries;
        try {
            entries = fs.readdirSync(dirPath, { withFileTypes: true });
        } catch (e) {
            return out;
        }

        for (const entry of entries) {
            if (!opts.showHidden && entry.name.startsWith(".")) continue;
            const abs = path.join(dirPath, entry.name);
            const rel = relParts.concat(entry.name);

            if (entry.isDirectory()) {
                if (isExcludedRel(rel.join("/"), opts.excludePaths || [])) continue;
                if (opts.recursive !== false) {
                    out.push.apply(out, collectFilesRecursive(abs, rel, opts));
                }
            } else if (entry.isFile() && isSupportedFile(entry.name)) {
                const ext = getExt(entry.name);
                let stat;
                try {
                    stat = fs.statSync(abs);
                } catch (e2) {
                    continue;
                }
                out.push({
                    id: rel.join("/"),
                    name: entry.name,
                    path: abs,
                    relPath: rel.join("/"),
                    ext: ext,
                    type: getFileType(ext),
                    size: stat.size,
                    modified: stat.mtimeMs
                });
            }
        }
        return out;
    }

    function indexFileForSearch(file) {
        const base = file.name.replace(/\.[^.]+$/, "");
        file._base = base.toLowerCase();
        file._name = file.name.toLowerCase();
        file._q = (base + " " + file.ext + " " + file.relPath.replace(/\//g, " ")).toLowerCase();
        return file;
    }

    function buildFolderFileMap(files) {
        const map = Object.create(null);
        map.__root__ = [];

        (files || []).forEach(function (f) {
            indexFileForSearch(f);
            if (f.relPath.indexOf("/") === -1) map.__root__.push(f);

            const parts = f.relPath.split("/");
            parts.pop();
            let accum = "";
            for (let i = 0; i < parts.length; i++) {
                accum = accum ? accum + "/" + parts[i] : parts[i];
                if (!map[accum]) map[accum] = [];
                map[accum].push(f);
            }
        });

        return map;
    }

    function prepareLibrarySearchIndex(lib) {
        if (!lib || lib._searchReady) return lib;
        lib.folderIndex = buildFolderFileMap(lib.files || []);
        lib._searchReady = true;
        return lib;
    }

    function scanAllLibraries(settings) {
        const cache = { libraries: {}, scannedAt: Date.now() };
        const folders = settings.folders || [];

        folders.forEach((lib) => {
            if (!lib.path || !fs.existsSync(lib.path)) return;
            const id = lib.id || libraryId(lib.path);
            const excludePaths =
                (settings.hiddenFolders && settings.hiddenFolders[id]) || [];
            const result = scanFolder(lib.path, {
                recursive: settings.scanSubfolders !== false,
                showHidden: !!settings.showHidden,
                excludePaths: excludePaths
            });
            cache.libraries[id] = prepareLibrarySearchIndex({
                id: id,
                name: lib.name || path.basename(lib.path),
                path: lib.path,
                tree: result.tree,
                files: result.files
            });
        });

        writeCache(cache);
        return cache;
    }

    function formatSize(bytes) {
        if (!bytes || bytes < 1024) return bytes + " B";
        if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
        return (bytes / 1073741824).toFixed(1) + " GB";
    }

    function formatDuration(sec) {
        if (!sec || isNaN(sec)) return "";
        if (sec < 60) return sec.toFixed(1) + "s";
        const m = Math.floor(sec / 60);
        const s = Math.round(sec % 60);
        return m + ":" + String(s).padStart(2, "0");
    }

    function typeIcon(type) {
        const map = {
            video: "▶",
            audio: "♫",
            image: "◻",
            project: "📦",
            preset: "✦",
            other: "?"
        };
        return map[type] || "?";
    }

    function typeColor(type) {
        return "#717171";
    }

    function videoMimeType(ext) {
        const map = {
            mp4: "video/mp4",
            m4v: "video/mp4",
            mov: "video/quicktime",
            webm: "video/webm",
            avi: "video/x-msvideo",
            mkv: "video/x-matroska",
            wmv: "video/x-ms-wmv",
            mpg: "video/mpeg",
            mpeg: "video/mpeg",
            mxf: "application/mxf",
            flv: "video/x-flv",
            "3gp": "video/3gpp"
        };
        return map[String(ext || "").toLowerCase()] || "video/mp4";
    }

    function mediaFileUrl(absPath) {
        if (!absPath) return "";
        const normalized = String(absPath).replace(/\\/g, "/");
        const parts = normalized.split("/");
        const encoded = parts.map(function (part, index) {
            if (!part) return part;
            if (index === 0 && /^[a-zA-Z]:$/.test(part)) return part;
            return encodeURIComponent(part);
        });
        return "file:///" + encoded.join("/").replace(/^\/+/, "");
    }

    return {
        EXT,
        ALL_EXTS,
        readSettings,
        writeSettings,
        readCache,
        writeCache,
        prepareLibrarySearchIndex,
        buildFolderFileMap,
        scanAllLibraries,
        scanFolder,
        getExt,
        getFileType,
        isSupportedFile,
        libraryId,
        formatSize,
        formatDuration,
        typeIcon,
        typeColor,
        videoMimeType,
        mediaFileUrl,
        path,
        fs,
        os
    };
})();

if (typeof module !== "undefined") module.exports = MediaVaultLibrary;
