/**
 * MediaVault by Animateoo — copy media into project (Footage) folder
 */
const MediaVaultProject = (function () {
    const fs = window.require ? window.require("fs") : require("fs");
    const path = window.require ? window.require("path") : require("path");

    const AUDIO_EXT = [".mp3", ".wav", ".aac", ".m4a", ".aif", ".aiff", ".ogg", ".flac", ".wma", ".caf"];
    const IMAGE_EXT = [
        ".jpg", ".jpeg", ".png", ".gif", ".tif", ".tiff", ".bmp", ".ai", ".psd", ".eps", ".svg",
        ".webp", ".exr", ".dpx", ".heic"
    ];
    const VIDEO_EXT = [
        ".mp4", ".mov", ".avi", ".mkv", ".mxf", ".r3d", ".braw", ".mpeg", ".mpg", ".wmv", ".webm",
        ".mts", ".m2ts", ".flv", ".m4v", ".3gp"
    ];

    function pathsEqual(p1, p2) {
        try {
            return path.resolve(p1).toLowerCase() === path.resolve(p2).toLowerCase();
        } catch (e) {
            return false;
        }
    }

    function isPathUnderRoot(filePath, rootPath) {
        try {
            const root = path.resolve(rootPath);
            const file = path.resolve(filePath);
            const rel = path.relative(root, file);
            return rel !== "" && !rel.startsWith("..") && !path.isAbsolute(rel);
        } catch (e) {
            return false;
        }
    }

    function getFootageSubfolder(fileName) {
        const ext = path.extname(fileName).toLowerCase();
        if (AUDIO_EXT.indexOf(ext) >= 0) return "Audio";
        if (IMAGE_EXT.indexOf(ext) >= 0) return "Images";
        if (VIDEO_EXT.indexOf(ext) >= 0) return "Footage";
        return "Other";
    }

    function uniqueDestPath(dir, baseName) {
        const ext = path.extname(baseName);
        const stem = path.basename(baseName, ext);
        let candidate = path.join(dir, baseName);
        let n = 1;
        while (fs.existsSync(candidate)) {
            candidate = path.join(dir, stem + "_" + n + ext);
            n++;
        }
        return candidate;
    }

    function copyFileSyncSafe(src, dest) {
        const destDir = path.dirname(dest);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(src, dest);
    }

    /**
     * Copy source file into projectRoot/(Footage)/{Audio|Footage|Images|Other}/
     * Returns { ok, path, copied, subfolder, message }
     */
    function copyToProjectFootage(srcPath, projectRoot) {
        if (!srcPath || !fs.existsSync(srcPath)) {
            return { ok: false, error: "file_not_found" };
        }
        if (!projectRoot || !fs.existsSync(projectRoot)) {
            return { ok: false, error: "save_project_first" };
        }

        const fileName = path.basename(srcPath);
        const subfolder = getFootageSubfolder(fileName);
        const targetDir = path.join(projectRoot, "(Footage)", subfolder);
        let destPath = path.join(targetDir, fileName);

        if (pathsEqual(srcPath, destPath)) {
            return {
                ok: true,
                path: destPath,
                copied: false,
                subfolder: subfolder,
                message: "already_in_project"
            };
        }

        if (isPathUnderRoot(srcPath, projectRoot)) {
            return {
                ok: true,
                path: path.resolve(srcPath),
                copied: false,
                subfolder: subfolder,
                message: "already_under_project"
            };
        }

        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

        if (fs.existsSync(destPath) && !pathsEqual(srcPath, destPath)) {
            try {
                const stSrc = fs.statSync(srcPath);
                const stDest = fs.statSync(destPath);
                if (stSrc.size === stDest.size) {
                    return {
                        ok: true,
                        path: destPath,
                        copied: false,
                        subfolder: subfolder,
                        message: "already_in_footage"
                    };
                }
            } catch (e) {}
            destPath = uniqueDestPath(targetDir, fileName);
        }

        try {
            copyFileSyncSafe(srcPath, destPath);
            return {
                ok: true,
                path: destPath,
                copied: true,
                subfolder: subfolder,
                message: "copied"
            };
        } catch (e) {
            return { ok: false, error: String(e.message || e) };
        }
    }

    function formatFootagePath(projectRoot, subfolder, fileName) {
        return "(Footage)/" + subfolder + "/" + path.basename(fileName);
    }

    return {
        getFootageSubfolder: getFootageSubfolder,
        copyToProjectFootage: copyToProjectFootage,
        formatFootagePath: formatFootagePath,
        pathsEqual: pathsEqual,
        isPathUnderRoot: isPathUnderRoot
    };
})();
