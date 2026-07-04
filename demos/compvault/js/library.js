/**
 * CompVault — filesystem + catalog
 */
const CompVaultLibrary = (function () {
    const fs = window.require ? window.require("fs") : require("fs");
    const path = window.require ? window.require("path") : require("path");
    const os = window.require ? window.require("os") : require("os");

    const VAULT_FOLDER = "CompVault";
    const DEFAULT_CATEGORY = "General";
    const CATEGORIES_FILE = "categories.json";

    const TYPE_FOLDERS = {
        comp: "Comps",
        layers: "Capas",
        preset: "Presets"
    };

    const TYPE_FILTERS = [
        { id: "all", label: "Todos" },
        { id: "comp", label: "Comps" },
        { id: "layers", label: "Capas" },
        { id: "preset", label: "Presets" }
    ];

    function settingsDir() {
        return path.join(os.homedir(), "AppData", "Roaming", "CompVault");
    }

    function settingsPath() {
        return path.join(settingsDir(), "settings.json");
    }

    function ensureDir(dir) {
        if (!dir) return;
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    }

    function defaultSettings() {
        return {
            libraryRoot: "",
            linkedPath: "",
            libraryName: "",
            viewMode: "grid",
            gridSize: 180,
            addToTimeline: true,
            organizeProject: true,
            sidebarCollapsed: false,
            typeFilterExpanded: true,
            favorites: [],
            categoryOrder: [],
            lastCategory: DEFAULT_CATEGORY,
            previewMode: "still",
            previewMaxSec: 3,
            previewWidth: 200,
            collectFiles: true
        };
    }

    function readSettings() {
        ensureDir(settingsDir());
        const p = settingsPath();
        if (!fs.existsSync(p)) {
            const defaults = defaultSettings();
            fs.writeFileSync(p, JSON.stringify(defaults, null, 2), "utf8");
            return defaults;
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

    function isLinked(settings) {
        const root = settings && settings.libraryRoot;
        return !!(root && fs.existsSync(root));
    }

    function vaultRootFromParent(parentPath) {
        const parent = path.resolve(parentPath);
        if (path.basename(parent).toLowerCase() === VAULT_FOLDER.toLowerCase()) {
            return parent;
        }
        return path.join(parent, VAULT_FOLDER);
    }

    function parentFromVaultRoot(vaultRoot) {
        if (!vaultRoot) return "";
        const base = path.basename(vaultRoot);
        if (base.toLowerCase() === VAULT_FOLDER.toLowerCase()) {
            return path.dirname(vaultRoot);
        }
        return vaultRoot;
    }

    function linkPreviewPath(parentPath) {
        return vaultRootFromParent(parentPath);
    }

    function getLibraryRoot(settings) {
        const s = settings || readSettings();
        if (!s.libraryRoot) return "";
        ensureDir(s.libraryRoot);
        ensureTypeFolders(s.libraryRoot);
        return s.libraryRoot;
    }

    function typeFolderName(type) {
        return TYPE_FOLDERS[type] || "Comps";
    }

    function getTypeFolder(libraryRoot, type) {
        return path.join(libraryRoot, typeFolderName(type));
    }

    function ensureTypeFolders(libraryRoot) {
        if (!libraryRoot) return;
        ensureDir(libraryRoot);
        Object.keys(TYPE_FOLDERS).forEach((t) => ensureDir(getTypeFolder(libraryRoot, t)));
    }

    function linkFolder(folderPath, customName) {
        const parent = path.resolve(folderPath);
        const vaultRoot = vaultRootFromParent(parent);
        ensureTypeFolders(vaultRoot);
        const settings = readSettings();
        settings.linkedPath = parentFromVaultRoot(vaultRoot);
        settings.libraryRoot = vaultRoot;
        settings.libraryName = customName || path.basename(settings.linkedPath);
        writeSettings(settings);
        return settings;
    }

    function unlinkLibrary() {
        const settings = readSettings();
        settings.libraryRoot = "";
        settings.linkedPath = "";
        settings.libraryName = "";
        writeSettings(settings);
        return settings;
    }

    function metaPath(assetDir) {
        return path.join(assetDir, "asset.json");
    }

    function categoriesPath(libraryRoot) {
        return path.join(libraryRoot, CATEGORIES_FILE);
    }

    function readCategoriesFile(libraryRoot) {
        const p = categoriesPath(libraryRoot);
        if (!libraryRoot || !fs.existsSync(p)) return [];
        try {
            const data = JSON.parse(fs.readFileSync(p, "utf8"));
            return Array.isArray(data) ? data.filter(Boolean) : [];
        } catch (e) {
            return [];
        }
    }

    function writeCategoriesFile(libraryRoot, categories) {
        if (!libraryRoot) return;
        ensureDir(libraryRoot);
        const unique = [];
        categories.forEach((c) => {
            const name = sanitizeName(String(c || "").trim());
            if (name && unique.indexOf(name) === -1) unique.push(name);
        });
        if (unique.indexOf(DEFAULT_CATEGORY) === -1) unique.unshift(DEFAULT_CATEGORY);
        fs.writeFileSync(categoriesPath(libraryRoot), JSON.stringify(unique, null, 2), "utf8");
        return unique;
    }

    function ensureCategory(libraryRoot, categoryName) {
        const name = sanitizeName(categoryName || DEFAULT_CATEGORY) || DEFAULT_CATEGORY;
        const list = readCategoriesFile(libraryRoot);
        if (list.indexOf(name) === -1) {
            list.push(name);
            writeCategoriesFile(libraryRoot, list);
        }
        return name;
    }

    function listCategories(libraryRoot, assets) {
        const fromFile = readCategoriesFile(libraryRoot);
        const fromAssets = (assets || listAllAssets(libraryRoot)).map((a) => a.category || DEFAULT_CATEGORY);
        const merged = fromFile.slice();
        fromAssets.forEach((c) => {
            if (c && merged.indexOf(c) === -1) merged.push(c);
        });
        if (merged.indexOf(DEFAULT_CATEGORY) === -1) merged.unshift(DEFAULT_CATEGORY);
        return merged;
    }

    function uniqueIdFromDir(assetDir) {
        return path.basename(assetDir);
    }

    function vaultKeyForPath(filePath) {
        return String(filePath || "").replace(/\\/g, "/").toLowerCase();
    }

    function enrichMeta(meta, assetDir) {
        if (!meta) return null;
        const folderId = uniqueIdFromDir(assetDir);
        if (!meta.uniqueId) meta.uniqueId = folderId;
        if (!meta.category) meta.category = DEFAULT_CATEGORY;
        if (!meta.vaultKey && meta.filePath) meta.vaultKey = vaultKeyForPath(meta.filePath);
        return meta;
    }

    function readMeta(assetDir) {
        const p = metaPath(assetDir);
        if (!fs.existsSync(p)) return null;
        try {
            return enrichMeta(JSON.parse(fs.readFileSync(p, "utf8")), assetDir);
        } catch (e) {
            return null;
        }
    }

    function writeMeta(assetDir, meta) {
        ensureDir(assetDir);
        enrichMeta(meta, assetDir);
        fs.writeFileSync(metaPath(assetDir), JSON.stringify(meta, null, 2), "utf8");
    }

    /** Flex Comp Saver — scanPostComps() compatible entry */
    function toFlexCompatAsset(asset) {
        const aepPath = asset.filePath || path.join(asset.folder, asset.fileName || "");
        return {
            uniqueId: asset.uniqueId || uniqueIdFromDir(asset.folder),
            category: asset.category || DEFAULT_CATEGORY,
            name: asset.displayName || asset.name || "Sin nombre",
            aepPath: aepPath,
            thumbPath: asset.preview || previewPath(asset.folder, asset),
            type: asset.type === "layers" ? "layers" : asset.type === "preset" ? "preset" : "comp",
            label: asset.label || 0,
            vaultKey: asset.vaultKey || vaultKeyForPath(aepPath),
            width: asset.width || 0,
            height: asset.height || 0,
            duration: asset.duration || 0,
            frameRate: asset.frameRate || 0
        };
    }

    function scanCatalog(libraryRoot) {
        const missing = !libraryRoot || !fs.existsSync(libraryRoot);
        if (missing) {
            return {
                path: libraryRoot || "",
                pathMissing: true,
                categories: [],
                comps: [],
                presets: []
            };
        }
        const assets = listAllAssets(libraryRoot);
        const categories = listCategories(libraryRoot, assets);
        const flexComps = assets.filter((a) => a.type !== "preset").map(toFlexCompatAsset);
        const presets = assets.filter((a) => a.type === "preset").map(toFlexCompatAsset);
        return {
            path: libraryRoot,
            pathMissing: false,
            categories: categories,
            comps: flexComps,
            presets: presets,
            assetCount: assets.length
        };
    }

    function sanitizeName(name) {
        return String(name).replace(/[\\/:*?"<>|]/g, "_").trim() || "Untitled";
    }

    function uniqueAssetDir(parentPath, baseName) {
        let name = sanitizeName(baseName);
        let dir = path.join(parentPath, name);
        let n = 1;
        while (fs.existsSync(dir)) {
            name = sanitizeName(baseName) + "_" + n;
            dir = path.join(parentPath, name);
            n++;
        }
        return { name, dir };
    }

    function pushAssetFromDir(assets, assetDir, id) {
        const meta = readMeta(assetDir);
        if (!meta) return;
        assets.push({
            ...meta,
            id: id,
            folder: assetDir,
            preview: previewPath(assetDir, meta)
        });
    }

    function listAllAssets(libraryRoot) {
        if (!libraryRoot || !fs.existsSync(libraryRoot)) return [];
        const assets = [];

        function scanParent(parent, prefix) {
            if (!fs.existsSync(parent)) return;
            for (const entry of fs.readdirSync(parent, { withFileTypes: true })) {
                if (!entry.isDirectory()) continue;
                const dir = path.join(parent, entry.name);
                if (fs.existsSync(metaPath(dir))) {
                    pushAssetFromDir(assets, dir, prefix ? prefix + "/" + entry.name : entry.name);
                }
            }
        }

        Object.keys(TYPE_FOLDERS).forEach((type) => {
            scanParent(getTypeFolder(libraryRoot, type), TYPE_FOLDERS[type]);
        });

        for (const entry of fs.readdirSync(libraryRoot, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            if (Object.keys(TYPE_FOLDERS).some((t) => entry.name === TYPE_FOLDERS[t])) continue;
            const dir = path.join(libraryRoot, entry.name);
            if (fs.existsSync(metaPath(dir))) {
                pushAssetFromDir(assets, dir, entry.name);
            }
        }

        assets.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        return assets;
    }

    function previewPath(assetDir, meta) {
        const png = path.join(assetDir, "preview.png");
        if (fs.existsSync(png) && fs.statSync(png).size > 800) return png;

        const gif = path.join(assetDir, "preview.gif");
        if (fs.existsSync(gif) && fs.statSync(gif).size > 800) return gif;

        try {
            let best = "";
            let bestSize = 0;
            for (const name of fs.readdirSync(assetDir)) {
                if (!/^preview.*\.(png|gif)$/i.test(name)) continue;
                const candidate = path.join(assetDir, name);
                const size = fs.statSync(candidate).size;
                if (size > bestSize) {
                    bestSize = size;
                    best = candidate;
                }
            }
            if (best && bestSize > 800) return best;
        } catch (e) {}

        if (meta.type === "preset") return "builtin:preset";
        return "";
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

    const thumbCache = {};

    function imageDataUrl(absPath) {
        if (!absPath || absPath.startsWith("builtin:")) return "";
        if (thumbCache[absPath] && fs.existsSync(absPath)) return thumbCache[absPath];
        if (!fs.existsSync(absPath)) return "";
        try {
            const buf = fs.readFileSync(absPath);
            const ext = path.extname(absPath).toLowerCase();
            const mime = ext === ".gif" ? "image/gif" : "image/png";
            const url = "data:" + mime + ";base64," + buf.toString("base64");
            thumbCache[absPath] = url;
            return url;
        } catch (e) {
            return mediaFileUrl(absPath);
        }
    }

    function clearThumbCache() {
        Object.keys(thumbCache).forEach((k) => delete thumbCache[k]);
    }

    function deleteAsset(assetFolder) {
        if (!assetFolder || !fs.existsSync(assetFolder)) return;
        fs.rmSync(assetFolder, { recursive: true, force: true });
        clearThumbCache();
    }

    function deleteTypeFolderContents(libraryRoot, filterId) {
        const folderPath = getTypeFolder(libraryRoot, filterId);
        if (!folderPath || !fs.existsSync(folderPath)) return 0;
        let count = 0;
        for (const entry of fs.readdirSync(folderPath, { withFileTypes: true })) {
            if (!entry.isDirectory()) continue;
            const dir = path.join(folderPath, entry.name);
            if (fs.existsSync(metaPath(dir))) {
                deleteAsset(dir);
                count++;
            }
        }
        return count;
    }

    function formatDuration(sec) {
        if (!sec || isNaN(sec)) return "—";
        if (sec < 60) return sec.toFixed(1) + "s";
        const m = Math.floor(sec / 60);
        const s = Math.round(sec % 60);
        return m + "m " + s + "s";
    }

    function typeLabel(type) {
        if (type === "preset") return "Preset";
        if (type === "layers") return "Capas";
        return "Comp";
    }

    function renameAsset(assetFolder, newDisplayName) {
        const meta = readMeta(assetFolder);
        if (!meta) return false;
        meta.displayName = sanitizeName(newDisplayName);
        writeMeta(assetFolder, meta);
        return true;
    }

    function filterAssets(assets, filterType, searchQuery, categoryFilter) {
        let list = assets.slice();
        if (filterType && filterType !== "all") {
            list = list.filter((a) => a.type === filterType);
        }
        if (categoryFilter && categoryFilter !== "__ALL__") {
            list = list.filter((a) => (a.category || DEFAULT_CATEGORY) === categoryFilter);
        }
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            list = list.filter(
                (a) =>
                    (a.displayName || a.name || "").toLowerCase().includes(q) ||
                    (a.category || "").toLowerCase().includes(q) ||
                    typeLabel(a.type).toLowerCase().includes(q)
            );
        }
        return list;
    }

    function moveAssetCategory(assetFolder, newCategory, libraryRoot) {
        const meta = readMeta(assetFolder);
        if (!meta) return false;
        meta.category = ensureCategory(libraryRoot, newCategory);
        writeMeta(assetFolder, meta);
        return true;
    }

    function copyDirRecursive(src, dest) {
        ensureDir(dest);
        for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
            const from = path.join(src, entry.name);
            const to = path.join(dest, entry.name);
            if (entry.isDirectory()) copyDirRecursive(from, to);
            else fs.copyFileSync(from, to);
        }
    }

    function deleteDirRecursive(dir) {
        if (!dir || !fs.existsSync(dir)) return;
        fs.rmSync(dir, { recursive: true, force: true });
    }

    function assetsInCategory(libraryRoot, categoryName) {
        const cat = categoryName || DEFAULT_CATEGORY;
        return listAllAssets(libraryRoot).filter((a) => (a.category || DEFAULT_CATEGORY) === cat);
    }

    function exportCategoryPack(libraryRoot, categoryName, destZipPath) {
        const cp = require("child_process");
        const os = require("os");
        const assets = assetsInCategory(libraryRoot, categoryName);
        if (!assets.length) return { ok: false, error: "empty_category" };

        const staging = path.join(os.tmpdir(), "cvpack_" + Date.now());
        const packRoot = path.join(staging, sanitizeName(categoryName));
        ensureDir(packRoot);

        assets.forEach((asset) => {
            const destFolder = path.join(packRoot, asset.uniqueId || uniqueIdFromDir(asset.folder));
            copyDirRecursive(asset.folder, destFolder);
        });

        fs.writeFileSync(
            path.join(packRoot, "_compvault_pack.json"),
            JSON.stringify(
                {
                    format: "compvault-pack",
                    version: 1,
                    category: categoryName,
                    exportedAt: Date.now(),
                    items: assets.map(toFlexCompatAsset)
                },
                null,
                2
            ),
            "utf8"
        );

        if (fs.existsSync(destZipPath)) {
            try {
                fs.unlinkSync(destZipPath);
            } catch (e) {}
        }

        const isWin = os.platform() === "win32";
        let cmd;
        if (isWin) {
            const srcEsc = packRoot.replace(/'/g, "''");
            const dstEsc = destZipPath.replace(/'/g, "''");
            cmd =
                'powershell.exe -NoProfile -Command "Compress-Archive -Path \'' +
                srcEsc +
                "\\*' -DestinationPath '" +
                dstEsc +
                "' -Force\"";
        } else {
            cmd = 'cd "' + packRoot.replace(/"/g, '\\"') + '" && zip -r "' + destZipPath.replace(/"/g, '\\"') + '" .';
        }

        return new Promise((resolve) => {
            cp.exec(cmd, { windowsHide: true }, (err) => {
                deleteDirRecursive(staging);
                if (err) resolve({ ok: false, error: String(err.message || err) });
                else resolve({ ok: true, count: assets.length });
            });
        });
    }

    function detectAssetTypeFromAep(aepPath, folderName) {
        const base = (folderName || path.basename(path.dirname(aepPath)) || "").toLowerCase();
        if (base.indexOf("layer") >= 0 || base.indexOf("capas") >= 0 || /^cv_layers_/.test(base)) {
            return "layers";
        }
        return "comp";
    }

    function importAssetFromFolder(sourceDir, libraryRoot, categoryName, displayNameHint) {
        const files = fs.readdirSync(sourceDir);
        const aepFile = files.find((f) => f.toLowerCase().endsWith(".aep"));
        const ffxFile = files.find((f) => f.toLowerCase().endsWith(".ffx"));
        const packMeta = path.join(sourceDir, "asset.json");
        if (fs.existsSync(packMeta)) {
            const existingMeta = readMeta(sourceDir);
            const type = existingMeta.type || "comp";
            const typeDir = getTypeFolder(libraryRoot, type);
            const baseName = existingMeta.displayName || existingMeta.name || path.basename(sourceDir);
            const { name, dir } = uniqueAssetDir(typeDir, baseName);
            copyDirRecursive(sourceDir, dir);
            const meta = readMeta(dir) || existingMeta;
            meta.category = ensureCategory(libraryRoot, categoryName);
            meta.displayName = meta.displayName || baseName;
            meta.name = name;
            if (meta.fileName) meta.filePath = path.join(dir, meta.fileName);
            if (meta.filePath) meta.vaultKey = vaultKeyForPath(meta.filePath);
            writeMeta(dir, meta);
            return { ok: true, asset: meta };
        }

        if (ffxFile && !aepFile) {
            const typeDir = getTypeFolder(libraryRoot, "preset");
            const baseName = displayNameHint || path.basename(ffxFile, ".ffx");
            const { name, dir } = uniqueAssetDir(typeDir, baseName);
            ensureDir(dir);
            fs.copyFileSync(path.join(sourceDir, ffxFile), path.join(dir, name + ".ffx"));
            const filePath = path.join(dir, name + ".ffx");
            const meta = {
                displayName: baseName,
                name: name,
                type: "preset",
                fileName: name + ".ffx",
                filePath: filePath,
                vaultKey: vaultKeyForPath(filePath),
                category: ensureCategory(libraryRoot, categoryName),
                createdAt: Date.now()
            };
            writeMeta(dir, meta);
            return { ok: true, asset: meta };
        }

        if (!aepFile) return { ok: false, error: "no_aep" };

        const type = detectAssetTypeFromAep(path.join(sourceDir, aepFile), sourceDir);
        const typeDir = getTypeFolder(libraryRoot, type);
        const baseName = displayNameHint || path.basename(aepFile, ".aep");
        const { name, dir } = uniqueAssetDir(typeDir, baseName);
        ensureDir(dir);
        fs.copyFileSync(path.join(sourceDir, aepFile), path.join(dir, name + ".aep"));

        const previewNames = files.filter((f) => /^preview.*\.(png|gif)$/i.test(f));
        previewNames.forEach((f) => {
            fs.copyFileSync(path.join(sourceDir, f), path.join(dir, f));
        });
        if (!previewNames.length) {
            const png = files.find((f) => f.toLowerCase().endsWith(".png"));
            if (png) fs.copyFileSync(path.join(sourceDir, png), path.join(dir, "preview.png"));
        }

        const filePath = path.join(dir, name + ".aep");
        const meta = {
            displayName: baseName,
            name: name,
            type: type,
            fileName: name + ".aep",
            filePath: filePath,
            vaultKey: vaultKeyForPath(filePath),
            uniqueId: path.basename(sourceDir),
            category: ensureCategory(libraryRoot, categoryName),
            createdAt: Date.now()
        };
        writeMeta(dir, meta);
        return { ok: true, asset: meta };
    }

    function dirHasDirectAsset(dir) {
        try {
            const files = fs.readdirSync(dir);
            return (
                files.some((f) => /\.(aep|ffx)$/i.test(f)) || fs.existsSync(metaPath(dir))
            );
        } catch (e) {
            return false;
        }
    }

    function isLeafAssetDir(dir) {
        if (!dirHasDirectAsset(dir)) return false;
        try {
            for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                if (!entry.isDirectory()) continue;
                if (dirHasDirectAsset(path.join(dir, entry.name))) return false;
            }
        } catch (e) {
            return false;
        }
        return true;
    }

    function importCategoryPack(libraryRoot, zipPath, categoryOverride) {
        const cp = require("child_process");
        const os = require("os");
        const tmpExtract = path.join(os.tmpdir(), "cvpack_import_" + Date.now());
        ensureDir(tmpExtract);

        const isWin = os.platform() === "win32";
        const zipEsc = zipPath.replace(/'/g, "''");
        const tmpEsc = tmpExtract.replace(/'/g, "''");
        const cmd = isWin
            ? 'powershell.exe -NoProfile -Command "Expand-Archive -Path \'' +
              zipEsc +
              "' -DestinationPath '" +
              tmpEsc +
              "' -Force\""
            : 'unzip -o "' + zipPath.replace(/"/g, '\\"') + '" -d "' + tmpExtract.replace(/"/g, '\\"') + '"';

        return new Promise((resolve) => {
            cp.exec(cmd, { windowsHide: true }, (err) => {
                if (err) {
                    deleteDirRecursive(tmpExtract);
                    resolve({ ok: false, error: String(err.message || err) });
                    return;
                }

                try {
                    const baseName = path.basename(zipPath).replace(/\.(flexpack|cvpack|zip)$/i, "");
                    let categoryName = categoryOverride || baseName || DEFAULT_CATEGORY;
                    let importRoot = tmpExtract;
                    const top = fs.readdirSync(tmpExtract);
                    if (top.length === 1) {
                        const only = path.join(tmpExtract, top[0]);
                        if (fs.statSync(only).isDirectory()) importRoot = only;
                    }

                    const packManifest = path.join(importRoot, "_compvault_pack.json");
                    if (fs.existsSync(packManifest)) {
                        try {
                            const manifest = JSON.parse(fs.readFileSync(packManifest, "utf8"));
                            if (manifest.category) categoryName = manifest.category;
                        } catch (e) {}
                    }

                    categoryName = ensureCategory(libraryRoot, categoryName);
                    let imported = 0;
                    const leafDirs = [];

                    function collectLeafDirs(dir) {
                        if (!fs.existsSync(dir)) return;
                        if (isLeafAssetDir(dir)) {
                            leafDirs.push(dir);
                            return;
                        }
                        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
                            if (entry.isDirectory()) collectLeafDirs(path.join(dir, entry.name));
                        }
                    }

                    collectLeafDirs(importRoot);

                    leafDirs.forEach((dir) => {
                        const res = importAssetFromFolder(dir, libraryRoot, categoryName);
                        if (res.ok) imported++;
                    });

                    const rootFiles = fs.readdirSync(importRoot);
                    rootFiles
                        .filter((f) => f.toLowerCase().endsWith(".aep"))
                        .forEach((f) => {
                            const oneShot = path.join(tmpExtract, "_cv_one_" + imported + "_" + f);
                            ensureDir(oneShot);
                            fs.copyFileSync(path.join(importRoot, f), path.join(oneShot, f));
                            const png = f.replace(/\.aep$/i, ".png");
                            if (rootFiles.indexOf(png) >= 0) {
                                fs.copyFileSync(path.join(importRoot, png), path.join(oneShot, "preview.png"));
                            }
                            const res = importAssetFromFolder(
                                oneShot,
                                libraryRoot,
                                categoryName,
                                path.basename(f, ".aep")
                            );
                            if (res.ok) imported++;
                        });

                    deleteDirRecursive(tmpExtract);
                    resolve({ ok: imported > 0, count: imported, category: categoryName, error: imported ? "" : "empty_pack" });
                } catch (e2) {
                    deleteDirRecursive(tmpExtract);
                    resolve({ ok: false, error: String(e2.message || e2) });
                }
            });
        });
    }

    function shortenPath(p) {
        if (!p) return "—";
        return p.replace(os.homedir(), "~").replace(/\\/g, "/");
    }

    return {
        VAULT_FOLDER,
        DEFAULT_CATEGORY,
        TYPE_FOLDERS,
        TYPE_FILTERS,
        scanCatalog,
        toFlexCompatAsset,
        listCategories,
        ensureCategory,
        moveAssetCategory,
        assetsInCategory,
        exportCategoryPack,
        importCategoryPack,
        vaultKeyForPath,
        readSettings,
        writeSettings,
        getLibraryRoot,
        getTypeFolder,
        ensureTypeFolders,
        linkFolder,
        unlinkLibrary,
        linkPreviewPath,
        parentFromVaultRoot,
        isLinked,
        listAllAssets,
        uniqueAssetDir,
        writeMeta,
        readMeta,
        deleteAsset,
        deleteTypeFolderContents,
        renameAsset,
        sanitizeName,
        formatDuration,
        typeLabel,
        filterAssets,
        mediaFileUrl,
        imageDataUrl,
        clearThumbCache,
        shortenPath,
        ensureDir,
        path,
        fs
    };
})();

if (typeof module !== "undefined") module.exports = CompVaultLibrary;
