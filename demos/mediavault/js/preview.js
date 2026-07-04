/**
 * MediaVault by Animateoo — audio preview with scrubbing + mini waveforms
 */
const MediaVaultPreview = (function () {
    const Icons = window.MediaVaultIcons || {
        html: function (name) {
            return name === "pause" ? "II" : name === "play" ? ">" : "";
        },
        setPlayState: function (btn, playing) {
            if (btn) btn.textContent = playing ? "II" : ">";
        },
        typeHtml: function () {
            return "";
        }
    };

    const peakCache = new Map();
    const cardQueue = [];
    let cardLoading = 0;
    const CARD_MAX = 4;
    let decodeCtx = null;
    let previewLoading = false;

    let currentAsset = null;
    let audioEl = null;
    let videoEl = null;
    let scrubState = null;
    let rafId = null;
    let playBtnRef = null;

    function fileUrl(absPath) {
        if (typeof MediaVaultLibrary !== "undefined" && MediaVaultLibrary.mediaFileUrl) {
            return MediaVaultLibrary.mediaFileUrl(absPath);
        }
        if (!absPath) return "";
        const normalized = absPath.replace(/\\/g, "/");
        const parts = normalized.split("/");
        const encoded = parts.map(function (part, index) {
            if (!part) return part;
            if (index === 0 && /^[a-zA-Z]:$/.test(part)) return part;
            return encodeURIComponent(part);
        });
        return "file:///" + encoded.join("/").replace(/^\/+/, "");
    }

    function formatTime(sec) {
        if (!sec || isNaN(sec)) return "0:00";
        const m = Math.floor(sec / 60);
        const s = Math.floor(sec % 60);
        return m + ":" + String(s).padStart(2, "0");
    }

    const VOL_KEY = "mv_preview_volume";
    let previewVolumeLevel = 0.85;

    function loadVolumeSetting() {
        try {
            if (typeof MediaVaultLibrary !== "undefined" && MediaVaultLibrary.readSettings) {
                const s = MediaVaultLibrary.readSettings();
                if (typeof s.previewVolume === "number" && !isNaN(s.previewVolume)) {
                    return Math.max(0, Math.min(1, s.previewVolume));
                }
            }
        } catch (e) {}
        try {
            const v = parseFloat(localStorage.getItem(VOL_KEY));
            if (!isNaN(v)) return Math.max(0, Math.min(1, v));
        } catch (e2) {}
        return 0.85;
    }

    function persistVolumeSetting(v) {
        try {
            localStorage.setItem(VOL_KEY, String(v));
        } catch (e) {}
        try {
            if (typeof MediaVaultLibrary !== "undefined" && MediaVaultLibrary.readSettings) {
                const s = MediaVaultLibrary.readSettings();
                s.previewVolume = v;
                MediaVaultLibrary.writeSettings(s);
            }
        } catch (e2) {}
    }

    previewVolumeLevel = loadVolumeSetting();

    function applyPreviewVolume() {
        if (audioEl) audioEl.volume = previewVolumeLevel;
    }

    function bindPreviewVolume(audio) {
        if (!audio) return;
        audio.volume = previewVolumeLevel;
        ["loadedmetadata", "loadeddata", "canplay", "play"].forEach(function (ev) {
            audio.addEventListener(ev, applyPreviewVolume);
        });
    }

    function getPreviewVolume() {
        return previewVolumeLevel;
    }

    function setPreviewVolume(level) {
        previewVolumeLevel = Math.max(0, Math.min(1, level));
        persistVolumeSetting(previewVolumeLevel);
        applyPreviewVolume();
    }

    function stopAll() {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        scrubState = null;
        playBtnRef = null;
        if (audioEl) {
            audioEl.pause();
            audioEl.removeAttribute("src");
            audioEl.load();
            audioEl = null;
        }
        if (videoEl) {
            videoEl.pause();
            videoEl.removeAttribute("src");
            videoEl = null;
        }
    }

    function getDecodeContext() {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return null;
        if (!decodeCtx || decodeCtx.state === "closed") {
            decodeCtx = new AudioCtx();
        }
        if (decodeCtx.state === "suspended") {
            decodeCtx.resume().catch(function () {});
        }
        return decodeCtx;
    }

    function loadPeaks(filePath, bucketCount, priority) {
        const buckets = bucketCount || 400;
        const cacheKey = filePath + "::" + buckets;
        if (peakCache.has(cacheKey)) return peakCache.get(cacheKey);

        const promise = new Promise(function (resolve, reject) {
            try {
                const fs = window.require("fs");
                const ac = getDecodeContext();
                if (!ac) {
                    reject(new Error("no_audio_context"));
                    return;
                }

                function runDecode(buf) {
                    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
                    const copy = ab.slice(0);
                    ac.decodeAudioData(
                        copy,
                        function (audioBuffer) {
                            const ch0 = audioBuffer.getChannelData(0);
                            const ch1 =
                                audioBuffer.numberOfChannels > 1
                                    ? audioBuffer.getChannelData(1)
                                    : ch0;
                            const block = Math.max(1, Math.floor(ch0.length / buckets));
                            const peaks0 = [];
                            const peaks1 = [];
                            let i, j, max0, max1;

                            for (i = 0; i < buckets; i++) {
                                max0 = 0;
                                max1 = 0;
                                for (j = 0; j < block; j++) {
                                    max0 = Math.max(max0, Math.abs(ch0[i * block + j] || 0));
                                    max1 = Math.max(max1, Math.abs(ch1[i * block + j] || 0));
                                }
                                peaks0.push(max0);
                                peaks1.push(max1);
                            }

                            resolve({
                                peaks0: peaks0,
                                peaks1: peaks1,
                                duration: audioBuffer.duration,
                                buckets: buckets
                            });
                        },
                        function () {
                            reject(new Error("decode_failed"));
                        }
                    );
                }

                if (priority) {
                    previewLoading = true;
                }

                fs.readFile(filePath, function (err, buf) {
                    if (err) {
                        if (priority) previewLoading = false;
                        reject(err);
                        return;
                    }
                    runDecode(buf);
                });
            } catch (e) {
                if (priority) previewLoading = false;
                reject(e);
            }
        });

        promise.finally(function () {
            if (priority) previewLoading = false;
            drainCardQueue();
        });

        peakCache.set(cacheKey, promise);
        return promise;
    }

    function mergePeaks(peaks) {
        const out = [];
        const n = peaks.peaks0.length;
        let i;
        for (i = 0; i < n; i++) {
            out.push(Math.max(peaks.peaks0[i] || 0, peaks.peaks1[i] || 0));
        }
        return out;
    }

    function maxPeakValue(data) {
        let m = 0;
        let i;
        for (i = 0; i < data.length; i++) {
            m = Math.max(m, data[i] || 0);
        }
        return m || 1;
    }

    /* BadFX-style: barras verticales con gap + línea central punteada */
    const WAVE_THEME = {
        bgCard: "#141414",
        bgPreview: "#161616",
        bar: "rgba(255,255,255,0.78)",
        barPlayed: "rgba(255,255,255,0.9)",
        barUnplayed: "rgba(255,255,255,0.26)",
        centerLine: "rgba(255,255,255,0.14)",
        playhead: "#ffffff",
        playheadStart: "rgba(255,255,255,0.42)"
    };

    function drawBarWaveform(ctx, w, h, peaks, progress, style) {
        const bg = style.bg || WAVE_THEME.bgCard;
        const padX = style.padX != null ? style.padX : 3;
        const padY = style.padY != null ? style.padY : 3;
        const amplitude = style.amplitude != null ? style.amplitude : 0.88;
        const fit = style.fit !== false;
        const barW = style.barWidth != null ? style.barWidth : w < 100 ? 1 : 1.5;
        const barGap = style.barGap != null ? style.barGap : w < 100 ? 1 : 2;
        const merged = mergePeaks(peaks);
        progress = progress || 0;

        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        const yCenter = h / 2;
        const halfH = Math.max(3, (h - padY * 2) / 2);

        if (style.centerLine !== false) {
            ctx.save();
            ctx.strokeStyle = style.centerLineColor || WAVE_THEME.centerLine;
            ctx.lineWidth = 1;
            ctx.setLineDash([2, 3]);
            ctx.beginPath();
            ctx.moveTo(padX, yCenter + 0.5);
            ctx.lineTo(w - padX, yCenter + 0.5);
            ctx.stroke();
            ctx.restore();
        }

        const innerW = Math.max(1, w - padX * 2);
        const step = barW + barGap;
        const barCount = Math.max(6, Math.floor(innerW / step));
        const maxPeak = fit ? maxPeakValue(merged) : 1;
        const scale = (halfH * amplitude) / maxPeak;
        const hasProgress = progress > 0.001;
        const progressX = progress * w;

        let i, peakIdx, amp, x, barH, cx;
        for (i = 0; i < barCount; i++) {
            peakIdx = Math.min(merged.length - 1, Math.floor((i / barCount) * merged.length));
            amp = (merged[peakIdx] || 0) * scale;
            barH = Math.max(0.5, amp);
            x = padX + i * step;
            cx = x + barW / 2;

            if (hasProgress) {
                ctx.fillStyle = cx <= progressX ? WAVE_THEME.barPlayed : WAVE_THEME.barUnplayed;
            } else {
                ctx.fillStyle = style.barColor || WAVE_THEME.bar;
            }

            ctx.fillRect(x, yCenter - barH, barW, barH * 2);
        }

        if (style.showStartLine) {
            ctx.strokeStyle = style.playheadStartColor || WAVE_THEME.playheadStart;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padX + 0.5, 1);
            ctx.lineTo(padX + 0.5, h - 1);
            ctx.stroke();
        }

        if (style.playhead && hasProgress) {
            ctx.strokeStyle = style.playheadColor || WAVE_THEME.playhead;
            ctx.lineWidth = style.playheadWidth || 1;
            ctx.beginPath();
            ctx.moveTo(progressX + 0.5, 0);
            ctx.lineTo(progressX + 0.5, h);
            ctx.stroke();
        }
    }

    function drawPeaks(ctx, w, h, peaks, progress, style) {
        if (style.mode === "bars") {
            drawBarWaveform(ctx, w, h, peaks, progress, style);
            return;
        }
        const gap = style.gap || 4;
        const singleBelow = style.singleBelow != null ? style.singleBelow : 68;
        const useSingle = style.singleLane || h <= singleBelow;
        const buckets = peaks.peaks0.length;
        const step = w / buckets;
        const unplayed = style.unplayed || "#2a2a32";
        const played = style.played || "#e84545";
        const bg = style.bg || "#0d0d10";
        const playhead = style.playhead !== false;
        const fit = style.fit !== false;
        const padY = style.padY != null ? style.padY : 8;
        const amplitude = style.amplitude != null ? style.amplitude : 0.88;
        const heightFactor = Math.min(1, Math.max(0.5, h / 64));
        progress = progress || 0;

        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        function ampScaleFor(data, halfH) {
            const maxPeak = fit ? maxPeakValue(data) : 1;
            return (halfH * amplitude * heightFactor) / maxPeak;
        }

        function drawLane(data, yCenter, halfH, fillColor, scale) {
            const ampScale = scale != null ? scale : ampScaleFor(data, halfH);
            ctx.beginPath();
            ctx.moveTo(0, yCenter);
            let i, x, amp;
            for (i = 0; i < buckets; i++) {
                x = i * step;
                amp = (data[i] || 0) * ampScale;
                ctx.lineTo(x, yCenter - amp);
            }
            for (i = buckets - 1; i >= 0; i--) {
                x = i * step;
                amp = (data[i] || 0) * ampScale;
                ctx.lineTo(x, yCenter + amp);
            }
            ctx.closePath();
            ctx.fillStyle = fillColor;
            ctx.fill();
        }

        if (useSingle) {
            const merged = mergePeaks(peaks);
            const halfH = Math.max(4, (h - padY) / 2);
            const yCenter = h / 2;
            const scale = ampScaleFor(merged, halfH);
            drawLane(merged, yCenter, halfH, unplayed, scale);
            if (progress > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, w * progress, h);
                ctx.clip();
                drawLane(merged, yCenter, halfH, played, scale);
                ctx.restore();
            }
        } else {
            const mid = h / 2;
            const laneH = (h - gap) / 2;
            const laneHalf = laneH / 2;
            const maxPeak = fit
                ? Math.max(maxPeakValue(peaks.peaks0), maxPeakValue(peaks.peaks1))
                : 1;
            const scale = fit ? (laneHalf * amplitude * heightFactor) / maxPeak : null;
            drawLane(peaks.peaks0, mid - laneH / 2 - 1, laneHalf, unplayed, scale);
            drawLane(peaks.peaks1, mid + laneH / 2 + 1, laneHalf, unplayed, scale);

            if (progress > 0) {
                ctx.save();
                ctx.beginPath();
                ctx.rect(0, 0, w * progress, h);
                ctx.clip();
                drawLane(peaks.peaks0, mid - laneH / 2 - 1, laneHalf, played, scale);
                drawLane(peaks.peaks1, mid + laneH / 2 + 1, laneHalf, played, scale);
                ctx.restore();
            }
        }

        if (playhead && progress > 0) {
            const px = progress * w;
            ctx.strokeStyle = style.playheadColor || "#ff5c5c";
            ctx.lineWidth = style.playheadWidth || 2;
            ctx.beginPath();
            ctx.moveTo(px, 0);
            ctx.lineTo(px, h);
            ctx.stroke();
        }
    }

    function cardWaveSize(thumbSize) {
        const size = thumbSize || 120;
        return {
            w: Math.max(72, Math.floor(size - 6)),
            h: Math.max(30, Math.floor(size * 0.36))
        };
    }

    function drawMiniCardWaveform(canvas, peaks, thumbSize) {
        const dims = cardWaveSize(thumbSize);
        let w = dims.w;
        const h = dims.h;

        if (canvas.parentElement) {
            const rect = canvas.parentElement.getBoundingClientRect();
            if (rect.width >= 20) w = Math.floor(rect.width);
        }

        const dpr = window.devicePixelRatio || 1;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawBarWaveform(ctx, w, h, peaks, 0, {
            bg: WAVE_THEME.bgCard,
            barColor: WAVE_THEME.bar,
            centerLine: true,
            showStartLine: true,
            padX: 3,
            padY: 2,
            amplitude: 0.9,
            fit: true,
            barWidth: w < 100 ? 1 : 1.5,
            barGap: w < 120 ? 1 : 2
        });
    }

    function drawCardPlaceholder(canvas, thumbSize) {
        const dims = cardWaveSize(thumbSize);
        let w = dims.w;
        const h = dims.h;
        if (canvas.parentElement) {
            const rect = canvas.parentElement.getBoundingClientRect();
            if (rect.width >= 20) w = Math.floor(rect.width);
        }
        const dpr = window.devicePixelRatio || 1;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + "px";
        canvas.style.height = h + "px";
        const ctx = canvas.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        ctx.fillStyle = WAVE_THEME.bgCard;
        ctx.fillRect(0, 0, w, h);

        const yCenter = h / 2;
        ctx.strokeStyle = WAVE_THEME.centerLine;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(3, yCenter + 0.5);
        ctx.lineTo(w - 3, yCenter + 0.5);
        ctx.stroke();
        ctx.setLineDash([]);

        const barW = 1;
        const barGap = 2;
        const step = barW + barGap;
        const barCount = Math.max(6, Math.floor((w - 6) / step));
        ctx.fillStyle = "rgba(255,255,255,0.12)";
        let i, x;
        for (i = 0; i < barCount; i++) {
            x = 3 + i * step;
            const barH = 2 + (i % 5) * 1.5;
            ctx.fillRect(x, yCenter - barH, barW, barH * 2);
        }
    }

    function resetCardWaveforms() {
        cardQueue.length = 0;
    }

    function drainCardQueue() {
        if (previewLoading) return;
        while (cardLoading < CARD_MAX && cardQueue.length) {
            const job = cardQueue.shift();
            if (!job.canvas || !job.canvas.isConnected) continue;
            cardLoading++;
            loadPeaks(job.path, 120)
                .then(function (peaks) {
                    if (job.canvas.isConnected) drawMiniCardWaveform(job.canvas, peaks, job.thumbSize);
                })
                .catch(function () {
                    if (job.canvas.isConnected) drawCardPlaceholder(job.canvas, job.thumbSize);
                })
                .finally(function () {
                    cardLoading--;
                    drainCardQueue();
                });
        }
    }

    function mountCardWaveform(canvas, filePath, thumbSize) {
        if (!canvas) return;
        drawCardPlaceholder(canvas, thumbSize);

        function enqueue(tries) {
            if (!canvas.isConnected) {
                if (tries < 30) requestAnimationFrame(function () { enqueue(tries + 1); });
                return;
            }
            cardQueue.push({ canvas: canvas, path: filePath, thumbSize: thumbSize });
            drainCardQueue();
        }

        requestAnimationFrame(function () { enqueue(0); });
    }

    function mountScrubber(wrap, canvas, peaks, duration, onTimeUpdate) {
        const ctx = canvas.getContext("2d");
        let progress = 0;
        let dragging = false;

        function draw() {
            const w = canvas.width / (window.devicePixelRatio || 1);
            const h = canvas.height / (window.devicePixelRatio || 1);
            drawBarWaveform(ctx, w, h, peaks, progress, {
                bg: WAVE_THEME.bgPreview,
                centerLine: true,
                showStartLine: false,
                playhead: true,
                playheadColor: WAVE_THEME.playhead,
                playheadWidth: 1,
                padX: 4,
                padY: 4,
                amplitude: 0.9,
                fit: true,
                barWidth: w < 200 ? 1.5 : 2,
                barGap: 2
            });
        }

        function seekFromEvent(ev, opts) {
            opts = opts || {};
            const rect = canvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left));
            progress = rect.width > 0 ? x / rect.width : 0;
            if (audioEl && duration) {
                audioEl.currentTime = progress * duration;
                if (opts.play) {
                    applyPreviewVolume();
                    audioEl.play().catch(function () {});
                    if (playBtnRef) Icons.setPlayState(playBtnRef, true);
                } else if (opts.pause) {
                    audioEl.pause();
                    if (playBtnRef) Icons.setPlayState(playBtnRef, false);
                }
            }
            draw();
            if (onTimeUpdate) onTimeUpdate(progress * duration, duration);
        }

        function onPointerDown(ev) {
            if (ev.button !== 0) return;
            ev.preventDefault();
            dragging = true;
            canvas.classList.add("scrubbing");
            seekFromEvent(ev, { pause: true });
        }

        function onPointerMove(ev) {
            if (!dragging) return;
            seekFromEvent(ev, { pause: true });
        }

        function onPointerUp(ev) {
            if (!dragging) return;
            dragging = false;
            canvas.classList.remove("scrubbing");
            seekFromEvent(ev, { play: true });
        }

        canvas.addEventListener("mousedown", onPointerDown);
        window.addEventListener("mousemove", onPointerMove);
        window.addEventListener("mouseup", onPointerUp);

        scrubState = {
            setProgress: function (p) {
                progress = Math.max(0, Math.min(1, p));
                draw();
            },
            resize: resizeCanvas,
            destroy: function () {
                dragging = false;
                canvas.removeEventListener("mousedown", onPointerDown);
                window.removeEventListener("mousemove", onPointerMove);
                window.removeEventListener("mouseup", onPointerUp);
            }
        };

        function resizeCanvas() {
            const rect = wrap.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            const w = Math.max(200, Math.floor(rect.width));
            const h = Math.max(28, Math.floor(rect.height));
            canvas.width = w * dpr;
            canvas.height = h * dpr;
            canvas.style.width = w + "px";
            canvas.style.height = h + "px";
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            draw();
        }

        resizeCanvas();
        window.addEventListener("resize", resizeCanvas);

        return scrubState;
    }

    function playOnce() {
        if (audioEl) {
            audioEl.pause();
            audioEl.currentTime = 0;
            applyPreviewVolume();
            audioEl.play().catch(function () {});
            if (playBtnRef) Icons.setPlayState(playBtnRef, true);
            return;
        }
        if (videoEl) {
            videoEl.pause();
            videoEl.currentTime = 0;
            videoEl.play().catch(function () {});
        }
    }

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    function mount(container, controlsEl, asset, Lib, metaEl, options) {
        stopAll();
        currentAsset = asset;
        options = options || {};
        container.innerHTML = "";
        controlsEl.innerHTML = "";

        if (!asset) return;

        if (asset.type === "video") {
            videoEl = document.createElement("video");
            videoEl.className = "preview-video";
            videoEl.playsInline = true;
            videoEl.autoplay = false;
            videoEl.preload = "auto";
            videoEl.setAttribute("playsinline", "");
            videoEl.setAttribute("webkit-playsinline", "");

            const src = fileUrl(asset.path);
            const source = document.createElement("source");
            source.src = src;
            source.type = Lib.videoMimeType ? Lib.videoMimeType(asset.ext) : "video/mp4";
            videoEl.appendChild(source);
            videoEl.src = src;
            videoEl.addEventListener("ended", function () {
                videoEl.pause();
                videoEl.currentTime = 0;
            });
            videoEl.controls = true;
            container.appendChild(videoEl);
            videoEl.load();
            if (options.playOnMount) {
                videoEl.addEventListener(
                    "loadeddata",
                    function handler() {
                        videoEl.removeEventListener("loadeddata", handler);
                        playOnce();
                    },
                    { once: true }
                );
            }
            return;
        }

        if (asset.type === "image") {
            const img = document.createElement("img");
            img.className = "preview-image";
            img.src = fileUrl(asset.path);
            img.alt = asset.name;
            container.appendChild(img);
            return;
        }

        if (asset.type === "audio") {
            const wrap = document.createElement("div");
            wrap.className = "wave-scrubber-wrap";
            wrap.innerHTML = '<div class="wave-loading">Cargando forma de onda…</div>';
            container.appendChild(wrap);

            const canvas = document.createElement("canvas");
            canvas.className = "wave-scrubber";

            audioEl = document.createElement("audio");
            audioEl.src = fileUrl(asset.path);
            audioEl.preload = "auto";
            audioEl.autoplay = false;
            bindPreviewVolume(audioEl);
            container.appendChild(audioEl);

            const playBtn = document.createElement("button");
            playBtn.type = "button";
            playBtn.className = "play-btn";
            playBtn.innerHTML = Icons.html("play");
            playBtn.setAttribute("aria-label", "Reproducir");
            playBtnRef = playBtn;

            const timeEl = document.createElement("span");
            timeEl.className = "preview-time";
            timeEl.textContent = "0:00 / —";

            controlsEl.appendChild(playBtn);
            controlsEl.appendChild(timeEl);

            let scrubber = null;
            let peaksDuration = 0;

            function updateTimeDisplay(cur, dur) {
                timeEl.textContent = formatTime(cur) + " / " + formatTime(dur || peaksDuration);
            }

            playBtn.addEventListener("click", function () {
                if (!audioEl) return;
                if (audioEl.paused) {
                    applyPreviewVolume();
                    audioEl.play().catch(function () {});
                    Icons.setPlayState(playBtn, true);
                } else {
                    audioEl.pause();
                    Icons.setPlayState(playBtn, false);
                }
            });

            audioEl.addEventListener("loadedmetadata", function () {
                if (audioEl.duration && !peaksDuration) updateTimeDisplay(0, audioEl.duration);
            });

            audioEl.addEventListener("timeupdate", function () {
                if (!audioEl.duration) return;
                if (scrubber) scrubber.setProgress(audioEl.currentTime / audioEl.duration);
                updateTimeDisplay(audioEl.currentTime, audioEl.duration);
            });

            audioEl.addEventListener("ended", function () {
                Icons.setPlayState(playBtn, false);
                if (scrubber) scrubber.setProgress(0);
                audioEl.currentTime = 0;
                updateTimeDisplay(0, peaksDuration || audioEl.duration);
            });

            function startTick() {
                function tick() {
                    if (audioEl && !audioEl.paused && audioEl.duration && scrubber) {
                        scrubber.setProgress(audioEl.currentTime / audioEl.duration);
                    }
                    rafId = requestAnimationFrame(tick);
                }
                if (rafId) cancelAnimationFrame(rafId);
                rafId = requestAnimationFrame(tick);
            }

            if (options.playOnMount) {
                audioEl.addEventListener(
                    "canplay",
                    function onCanPlay() {
                        playOnce();
                    },
                    { once: true }
                );
                audioEl.load();
            }

            loadPeaks(asset.path, 400, true)
                .then(function (peaks) {
                    if (currentAsset !== asset) return;
                    peaksDuration = peaks.duration;
                    wrap.innerHTML = "";
                    wrap.appendChild(canvas);
                    scrubber = mountScrubber(wrap, canvas, peaks, peaks.duration, updateTimeDisplay);
                    updateTimeDisplay(audioEl.currentTime || 0, peaks.duration);
                    startTick();
                })
                .catch(function () {
                    if (currentAsset !== asset) return;
                    wrap.innerHTML = '<div class="wave-fallback">♫ ' + escapeHtml(asset.name) + "</div>";
                    updateTimeDisplay(0, audioEl.duration || 0);
                });
            return;
        }

        const badge = document.createElement("div");
        badge.className = "preview-badge";
        badge.style.color = Lib.typeColor(asset.type);
        badge.innerHTML = Icons.typeHtml(asset.type) + ' <span class="preview-badge-ext">' + asset.ext.toUpperCase() + "</span>";
        container.appendChild(badge);
    }

    return {
        mount: mount,
        stopAll: stopAll,
        playOnce: playOnce,
        mountCardWaveform: mountCardWaveform,
        resetCardWaveforms: resetCardWaveforms,
        getPreviewVolume: getPreviewVolume,
        setPreviewVolume: setPreviewVolume,
        getCurrent: function () {
            return currentAsset;
        }
    };
})();
