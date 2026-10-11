/* Grably — fetch console logic. Zero own-server load: the browser talks
 * straight to the configured relay API. */
(function () {
  "use strict";
  var CFG = window.GRABLY || {};
  var API = (CFG.apiEndpoint || "").replace(/\/$/, "");
  var API_KEY = CFG.apiKey || "";

  var $ = function (id) { return document.getElementById(id); };
  var urlInput = $("urlInput"), fetchBtn = $("fetchBtn"), fetchLabel = $("fetchLabel"),
      statusLine = $("statusLine"), statusText = $("statusText"),
      result = $("result"), resThumb = $("resThumb"), resTitle = $("resTitle"),
      resMeta = $("resMeta"), qualityRow = $("qualityRow"), dlBtn = $("dlBtn"),
      clipBtn = $("clipBtn");

  var current = null; // {url, fileUrl, filename, title, videoId}

  function setStatus(kind, msg) {
    statusLine.className = "status-line" + (kind ? " " + kind : "");
    statusText.textContent = msg;
  }
  function setLoading(on, label) {
    fetchBtn.disabled = on;
    fetchLabel.innerHTML = on
      ? '<svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-6.2-8.56"/></svg> Working…'
      : (label || "Fetch");
  }

  function cleanUrl(raw) {
    var u = (raw || "").trim().replace(/^["'\s]+|["'\s]+$/g, "");
    if (!u) return null;
    if (!/^https?:\/\//i.test(u)) u = "https://" + u;
    try {
      var parsed = new URL(u);
      if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(parsed.hostname)) return null;
      return parsed.toString();
    } catch (e) { return null; }
  }

  function ytId(u) {
    var m = u.match(/[?&]v=([a-zA-Z0-9_-]{6,})/) ||
            u.match(/youtu\.be\/([a-zA-Z0-9_-]{6,})/) ||
            u.match(/youtube\.com\/(?:shorts|live|embed)\/([a-zA-Z0-9_-]{6,})/);
    return m ? m[1] : null;
  }

  function titleFromFilename(fn) {
    if (!fn) return "Video file";
    return fn.replace(/\.[a-z0-9]{2,5}$/i, "").replace(/[_]+/g, " ").trim().slice(0, 120) || "Video file";
  }

  function apiPost(body) {
    var headers = { "Accept": "application/json", "Content-Type": "application/json" };
    if (API_KEY) headers["Authorization"] = "Api-Key " + API_KEY;
    return fetch(API, { method: "POST", headers: headers, body: JSON.stringify(body) })
      .then(function (r) {
        if (r.status === 429) throw { code: "rate", message: "Relay is busy (rate limit). Wait a minute and retry." };
        if (!r.ok) {
          return r.json().catch(function () { return null; }).then(function (j) {
            var err = (j && j.error) || {};
            throw { code: err.code || "http", message: "Relay error " + r.status + ". Try again." };
          });
        }
        return r.json();
      });
  }

  function friendlyError(err) {
    if (!err) return "Something broke. Try again.";
    if (err.code === "rate") return err.message;
    var code = (err.error && err.error.code) || err.code || "";
    if (/jwt|auth|unauthorized/i.test(code)) return "Relay needs a key right now. Try again later or point Grably at your own instance (js/config.js).";
    if (/content\.parse|link|invalid|unsupported/i.test(code)) return "Couldn't read that link. Copy the full URL from the video page and retry.";
    if (/geo|region|age|private|drm|protected|login/i.test(code)) return "That video is restricted (private, age/region-locked, or protected) — it can't be fetched.";
    if (err.message) return err.message;
    return "Fetch failed. The relay may be down — wait a bit and retry.";
  }

  function requestFile(url, quality, mode) {
    var body = { url: url, downloadMode: mode || "auto", filenameStyle: "basic" };
    if (mode === "audio") { body.audioFormat = "mp3"; }
    else { body.videoQuality = String(quality || "1080"); }
    return apiPost(body).then(function (res) {
      if (res.status === "tunnel" || res.status === "redirect") return res;
      if (res.status === "picker" && res.picker && res.picker.length) return res.picker[0];
      throw res;
    });
  }

  function renderResult(fileUrl, filename, url) {
    var vid = ytId(url);
    var title = titleFromFilename(filename);
    current = { url: url, fileUrl: fileUrl, filename: filename || "video.mp4", title: title, videoId: vid };

    resTitle.textContent = title;
    resMeta.textContent = (vid ? "youtube · " : "") + "via grably relay";
    if (vid) {
      resThumb.src = "https://i.ytimg.com/vi/" + vid + "/hqdefault.jpg";
      resThumb.onerror = function () { resThumb.onerror = null; resThumb.src = "https://i.ytimg.com/vi/" + vid + "/mqdefault.jpg"; };
    } else {
      resThumb.removeAttribute("src");
    }
    dlBtn.href = fileUrl;
    dlBtn.setAttribute("download", current.filename);

    // quality chips
    qualityRow.innerHTML = "";
    var quals = [
      { label: "1080p", q: "1080", mode: "video" },
      { label: "720p", q: "720", mode: "video" },
      { label: "480p", q: "480", mode: "video" },
      { label: "360p", q: "360", mode: "video" },
      { label: "MP3 audio", q: null, mode: "audio" }
    ];
    quals.forEach(function (opt) {
      var b = document.createElement("button");
      b.className = "q-btn" + (opt.mode === "audio" ? " is-audio" : "");
      b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>' + opt.label;
      b.addEventListener("click", function () { swapQuality(opt); });
      qualityRow.appendChild(b);
    });

    result.classList.add("show");
    setStatus("ok", "ready — pick a quality, or trim a clip.");
    saveHistory(url, title);

    // hand off to clip studio
    if (window.GrablyClip) window.GrablyClip.load(current);
  }

  function swapQuality(opt) {
    if (!current) return;
    setLoading(true); setStatus("", "switching to " + opt.label + "…");
    requestFile(current.url, opt.q, opt.mode).then(function (res) {
      current.fileUrl = res.url;
      current.filename = res.filename || current.filename;
      dlBtn.href = res.url;
      dlBtn.setAttribute("download", current.filename);
      setLoading(false, "Fetch");
      setStatus("ok", opt.label + " ready — hit download.");
      if (window.GrablyClip) window.GrablyClip.load(current);
    }).catch(function (err) {
      setLoading(false, "Fetch");
      setStatus("err", friendlyError(err));
    });
  }

  function doFetch() {
    var url = cleanUrl(urlInput.value);
    urlInput.setAttribute("aria-invalid", url ? "false" : "true");
    if (!url) { setStatus("err", "That doesn't look like a link. Paste the full video URL."); urlInput.focus(); return; }
    setLoading(true); setStatus("", "contacting relay…");
    result.classList.remove("show");
    requestFile(url, "1080", "auto").then(function (res) {
      setLoading(false, "Fetch");
      renderResult(res.url, res.filename, url);
    }).catch(function (err) {
      setLoading(false, "Fetch");
      setStatus("err", friendlyError(err));
    });
  }

  /* history (local only) */
  function saveHistory(url, title) {
    try {
      var h = JSON.parse(localStorage.getItem("grably_history") || "[]");
      h = [{ url: url, title: title, at: Date.now() }].concat(h.filter(function (x) { return x.url !== url; })).slice(0, 12);
      localStorage.setItem("grably_history", JSON.stringify(h));
    } catch (e) {}
  }

  /* ads — banner units render in isolated iframes so their scripts run
   * exactly as pasted, with no atOptions collisions between units. */
  function renderAds() {
    var ads = (CFG.ads || {});
    (ads.units || []).forEach(function (u) {
      var el = document.getElementById(u.slot);
      if (!el) return;
      if (!u.html) return; // keep the quiet placeholder box
      el.innerHTML = "";
      el.classList.remove("ad-box");
      var f = document.createElement("iframe");
      f.setAttribute("width", String(u.width));
      f.setAttribute("height", String(u.height));
      f.setAttribute("frameborder", "0");
      f.setAttribute("scrolling", "no");
      f.setAttribute("title", "Advertisement");
      f.style.border = "0";
      f.style.maxWidth = "100%";
      f.srcdoc = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head>" +
        "<body style=\"margin:0;padding:0;overflow:hidden\">" + u.html + "</body></html>";
      el.appendChild(f);
    });
    var stickyHasAd = (ads.units || []).some(function (u) { return u.slot === "adSticky" && u.html; });
    if (!stickyHasAd) { var w = document.getElementById("adStickyWrap"); if (w) w.style.display = "none"; }
    if (ads.popunderScript) {
      var ps = document.createElement("script");
      ps.setAttribute("data-cfasync", "false");
      ps.src = ads.popunderScript;
      document.body.appendChild(ps);
    }
  }

  /* ticker duplicate for seamless loop */
  function buildTicker() {
    var t = document.getElementById("tickerTrack");
    if (t) t.innerHTML += t.innerHTML;
  }

  /* reveal on scroll */
  function initReveal() {
    var els = document.querySelectorAll(".rv");
    if (!("IntersectionObserver" in window)) { els.forEach(function (e) { e.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* wire up */
  fetchBtn.addEventListener("click", doFetch);
  urlInput.addEventListener("keydown", function (e) { if (e.key === "Enter") doFetch(); });
  document.getElementById("pasteBtn").addEventListener("click", function () {
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(function (t) {
        if (t) { urlInput.value = t.trim(); urlInput.focus(); setStatus("", "pasted — hit Fetch."); }
        else setStatus("err", "Clipboard is empty.");
      }).catch(function () { setStatus("err", "Clipboard blocked — paste manually (Ctrl+V)."); urlInput.focus(); });
    } else { setStatus("err", "Clipboard blocked — paste manually (Ctrl+V)."); urlInput.focus(); }
  });
  document.getElementById("sampleBtn").addEventListener("click", function () {
    urlInput.value = CFG.sampleLink || ""; urlInput.focus(); setStatus("", "sample loaded — hit Fetch.");
  });
  document.getElementById("clearBtn").addEventListener("click", function () {
    urlInput.value = ""; result.classList.remove("show"); current = null;
    setStatus("", "waiting for a link…"); urlInput.focus();
  });
  clipBtn.addEventListener("click", function () {
    var s = document.getElementById("studio");
    if (s) s.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  /* service status pill — pings the relay root (no auth needed) */
  function checkStatus() {
    var pill = document.getElementById("statusPill");
    var txt = document.getElementById("statusPillText");
    if (!pill || !txt) return;
    var done = false;
    function setOk(ok) {
      if (done) return; done = true;
      pill.classList.add(ok ? "ok" : "bad");
      txt.textContent = ok ? "operational" : "degraded — retry soon";
    }
    try {
      var ctrl = new AbortController();
      var to = setTimeout(function () { try { ctrl.abort(); } catch (e) {} setOk(false); }, 9000);
      fetch((CFG.apiEndpoint || "").replace(/\/$/, "") + "/", { signal: ctrl.signal, mode: "cors" })
        .then(function (r) { clearTimeout(to); setOk(!!(r && r.ok)); })
        .catch(function () { clearTimeout(to); setOk(false); });
    } catch (e) { setOk(false); }
  }

  buildTicker();
  renderAds();
  initReveal();
  checkStatus();
})();
