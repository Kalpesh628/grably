/* Grably — Clip Studio. Timeline trimmer, cuts on-device via ffmpeg.wasm.
 * No server involved: the file streams to the browser, the cut happens locally. */
(function () {
  "use strict";

  var grid = null, emptyEl = null, video = null, stateEl = null;
  var track = null, sel = null, playhead = null, hStart = null, hEnd = null;
  var tStart = null, tEnd = null, tDur = null, tTotal0 = null, tTotal1 = null;
  var previewBtn = null, cutBtn = null, cutLabel = null, preciseCut = null;
  var progress = null, cutBar = null, cutPct = null, cutNote = null;

  var media = null;      // {fileUrl, filename, title}
  var duration = 0;
  var start = 0, end = 0;
  var ffmpeg = null, ffmpegLoading = null;
  var previewing = false;

  function $(id) { return document.getElementById(id); }

  function fmt(t) {
    t = Math.max(0, t || 0);
    var m = Math.floor(t / 60), s = t - m * 60;
    return m + ":" + (s < 10 ? "0" : "") + s.toFixed(1);
  }
  function parse(str) {
    var m = String(str || "").trim().match(/^(?:(\d+):)?(\d+(?:\.\d+)?)$/);
    if (!m) return null;
    return (parseInt(m[1] || "0", 10) * 60) + parseFloat(m[2]);
  }

  function setStudioState(txt, live) {
    if (stateEl) { stateEl.textContent = "● " + txt; stateEl.style.color = live ? "var(--color-accent)" : ""; }
  }

  function clampTimes() {
    start = Math.min(Math.max(0, start), duration);
    end = Math.min(Math.max(0, end), duration);
    if (end - start < 0.5) {
      if (document.activeElement === hStart || start + 0.5 <= duration) end = Math.min(duration, start + 0.5);
      else start = Math.max(0, end - 0.5);
    }
  }

  function render() {
    clampTimes();
    if (!duration) return;
    var rs = (start / duration) * 100, re = (end / duration) * 100;
    sel.style.left = rs + "%";
    sel.style.right = (100 - re) + "%";
    hStart.style.left = rs + "%";
    hEnd.style.left = re + "%";
    hStart.setAttribute("aria-valuenow", Math.round(rs));
    hEnd.setAttribute("aria-valuenow", Math.round(re));
    hStart.setAttribute("aria-valuetext", fmt(start));
    hEnd.setAttribute("aria-valuetext", fmt(end));
    if (document.activeElement !== tStart) tStart.value = fmt(start);
    if (document.activeElement !== tEnd) tEnd.value = fmt(end);
    tDur.value = fmt(end - start);
    var total = fmt(duration);
    tTotal0.textContent = "0:00";
    tTotal1.textContent = total;
  }

  function stopPreview() {
    previewing = false;
    if (video) video.pause();
    if (previewBtn) previewBtn.classList.remove("is-on");
  }

  /* ---------- drag handles ---------- */
  function bindHandle(el, which) {
    var dragging = false;
    function moveTo(clientX) {
      var r = track.getBoundingClientRect();
      var ratio = (clientX - r.left) / r.width;
      ratio = Math.min(1, Math.max(0, ratio));
      var t = ratio * duration;
      if (which === "start") start = Math.min(t, end - 0.5);
      else end = Math.max(t, start + 0.5);
      render();
    }
    el.addEventListener("pointerdown", function (e) {
      dragging = true; stopPreview();
      el.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    el.addEventListener("pointermove", function (e) { if (dragging) moveTo(e.clientX); });
    el.addEventListener("pointerup", function () { dragging = false; });
    el.addEventListener("pointercancel", function () { dragging = false; });
    el.addEventListener("keydown", function (e) {
      var step = e.shiftKey ? 5 : 1, used = true;
      if (e.key === "ArrowLeft") { if (which === "start") start -= step; else end -= step; }
      else if (e.key === "ArrowRight") { if (which === "start") start += step; else end += step; }
      else if (e.key === "Home") { if (which === "start") start = 0; else end = start + 0.5; }
      else if (e.key === "End") { if (which === "end") end = duration; else start = end - 0.5; }
      else used = false;
      if (used) { e.preventDefault(); stopPreview(); render(); }
    });
    // tap track to nudge nearest handle
    track.addEventListener("pointerdown", function (e) {
      if (e.target === el || el.contains(e.target)) return;
    });
  }
  function bindTrackTap() {
    track.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".handle")) return;
      stopPreview();
      var r = track.getBoundingClientRect();
      var t = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)) * duration;
      if (Math.abs(t - start) <= Math.abs(t - end)) start = Math.min(t, end - 0.5);
      else end = Math.max(t, start + 0.5);
      render();
    });
  }

  /* ---------- preview loop ---------- */
  function togglePreview() {
    if (!duration) return;
    if (previewing) { stopPreview(); return; }
    previewing = true;
    video.currentTime = start;
    video.play().catch(function () { previewing = false; });
  }

  /* ---------- ffmpeg cut ---------- */
  function loadFFmpeg() {
    if (ffmpeg) return Promise.resolve(ffmpeg);
    if (ffmpegLoading) return ffmpegLoading;
    setStudioState("loading cutter…", true);
    ffmpegLoading = (async function () {
      var ffmod = await import("https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/+esm");
      var util = await import("https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/+esm");
      var ff = new ffmod.FFmpeg();
      var base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm";
      ff.on("progress", function (p) {
        var pct = Math.min(99, Math.round((p.progress || 0) * 100));
        cutBar.style.width = pct + "%"; cutPct.textContent = pct + "%";
      });
      await ff.load({
        coreURL: await util.toBlobURL(base + "/ffmpeg-core.js", "text/javascript"),
        wasmURL: await util.toBlobURL(base + "/ffmpeg-core.wasm", "application/wasm")
      });
      window.__grablyFetchFile = util.fetchFile;
      ffmpeg = ff;
      return ff;
    })();
    return ffmpegLoading;
  }

  function extOf(name) {
    var m = /\.([a-z0-9]{2,5})$/i.exec(name || "");
    var e = (m ? m[1] : "mp4").toLowerCase();
    return /^(mp4|webm|mkv|mov|m4a|mp3)$/.test(e) ? e : "mp4";
  }

  function doCut() {
    if (!media || !duration) return;
    if (end - start < 0.5) { setStudioState("clip too short", false); return; }
    stopPreview();
    cutBtn.disabled = true;
    cutLabel.textContent = "Preparing…";
    progress.classList.add("show");
    cutBar.style.width = "2%"; cutPct.textContent = "…";
    setStudioState("cutting…", true);

    var ext = extOf(media.filename);
    var inName = "in." + ext, outName = "clip." + ext;
    var precise = preciseCut.checked;
    var args = precise
      ? ["-ss", String(start), "-i", inName, "-t", String(end - start),
         "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-c:a", "aac",
         "-movflags", "+faststart", outName]
      : ["-ss", String(start), "-i", inName, "-t", String(end - start),
         "-c", "copy", "-movflags", "+faststart", outName];

    loadFFmpeg().then(function (ff) {
      cutLabel.textContent = "Fetching file…";
      return fetch(media.fileUrl).then(function (r) {
        if (!r.ok) throw new Error("fetch " + r.status);
        return r.arrayBuffer();
      }).then(function (buf) {
        cutLabel.textContent = precise ? "Cutting (precise)…" : "Cutting (fast)…";
        return ff.writeFile(inName, new Uint8Array(buf)).then(function () { return ff.exec(args); });
      }).then(function () { return ff.readFile(outName); }).then(function (data) {
        var blob = new Blob([data.buffer], { type: ext === "webm" ? "video/webm" : "video/mp4" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "grably-clip_" + fmt(start).replace(/[:.]/g, "-") + "_to_" + fmt(end).replace(/[:.]/g, "-") + "." + ext;
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
        try { ff.deleteFile(inName); ff.deleteFile(outName); } catch (e) {}
        cutBar.style.width = "100%"; cutPct.textContent = "100%";
        setStudioState("done", true);
        cutLabel.textContent = "Download clip";
        cutBtn.disabled = false;
        setTimeout(function () { progress.classList.remove("show"); }, 2500);
      });
    }).catch(function (err) {
      cutLabel.textContent = "Download clip";
      cutBtn.disabled = false;
      progress.classList.remove("show");
      setStudioState("cut failed", false);
      cutNote.textContent = "Cut failed (" + (err && err.message ? err.message : "unknown") + "). The full file download still works above.";
    });
  }

  /* ---------- public: load a fetched video ---------- */
  function load(m) {
    media = m;
    if (!grid) init();
    emptyEl.style.display = "none";
    grid.hidden = false;
    stopPreview();
    start = 0; end = 0; duration = 0;
    video.src = m.fileUrl;
    video.load();
    setStudioState("loading video…", true);
  }

  function init() {
    grid = $("studioGrid"); emptyEl = $("studioEmpty"); video = $("clipVideo"); stateEl = $("studioState");
    track = $("tlTrack"); sel = $("tlSel"); playhead = $("tlPlay");
    hStart = $("hStart"); hEnd = $("hEnd");
    tStart = $("tStart"); tEnd = $("tEnd"); tDur = $("tDur");
    tTotal0 = $("tTotal0"); tTotal1 = $("tTotal1");
    previewBtn = $("previewBtn"); cutBtn = $("cutBtn"); cutLabel = $("cutLabel");
    preciseCut = $("preciseCut"); progress = $("cutProgress");
    cutBar = $("cutBar"); cutPct = $("cutPct"); cutNote = $("cutNote");

    bindHandle(hStart, "start");
    bindHandle(hEnd, "end");
    bindTrackTap();

    video.addEventListener("loadedmetadata", function () {
      duration = video.duration || 0;
      if (!duration || !isFinite(duration)) { setStudioState("no duration", false); return; }
      start = 0; end = Math.min(duration, 30);
      render();
      setStudioState("ready", true);
    });
    video.addEventListener("timeupdate", function () {
      if (!duration) return;
      playhead.style.left = (video.currentTime / duration * 100) + "%";
      if (previewing && video.currentTime >= end) {
        if (end - start > 0.4) { video.currentTime = start; }
        else stopPreview();
      }
    });
    video.addEventListener("error", function () {
      setStudioState("video failed to load", false);
    });

    function fieldCommit(which, el) {
      var v = parse(el.value);
      if (v === null || !duration) { render(); return; }
      stopPreview();
      if (which === "start") start = Math.min(v, end - 0.5);
      else end = Math.max(v, start + 0.5);
      render();
    }
    tStart.addEventListener("change", function () { fieldCommit("start", tStart); });
    tEnd.addEventListener("change", function () { fieldCommit("end", tEnd); });

    previewBtn.addEventListener("click", togglePreview);
    cutBtn.addEventListener("click", doCut);
  }

  window.GrablyClip = { load: load };
})();
