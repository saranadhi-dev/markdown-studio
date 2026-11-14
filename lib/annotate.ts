// @ts-nocheck
/* Annotation layer on top of the markdown preview:
 * laser pointer (fading trail), pen, highlighter, text blocks, eraser, undo, clear.
 * Ink lives in a canvas inside the scrolling preview, so it scrolls with the page. */
export type AnnApi = { toggle: (v?: boolean) => void; setAvailable: (v: boolean) => void; isOn: () => boolean; destroy: () => void };

const COLORS = ["#ff3b30", "#ff9500", "#ffd60a", "#34c759", "#0a84ff", "#bf5af2", "#111111", "#ffffff"];
const TRAIL_MS = 750;

export function initAnnotate(ctx: { pv: HTMLElement; article: HTMLElement; onChange?: (on: boolean) => void }): AnnApi {
  const pv = ctx.pv, article = ctx.article;
  let visible = false, available = true;
  let tool = "laser", color = COLORS[0], size = 4;
  let strokes = [], texts = [], undo = [], cur = null, erasing = false, erasedAny = false;
  let scale = 1, W = 0, H = 0;

  // ----- ink canvas (inside the scroller) -----
  const ink = document.createElement("canvas");
  ink.id = "ann-ink";
  pv.appendChild(ink);
  const ictx = ink.getContext("2d");

  // ----- laser canvas (fixed over the preview viewport) -----
  const laser = document.createElement("canvas");
  laser.id = "ann-laser";
  document.body.appendChild(laser);
  const lctx = laser.getContext("2d");

  // ----- palette -----
  const pal = document.createElement("div");
  pal.id = "ann-pal";
  pal.hidden = true;
  pal.innerHTML =
    '<div class="grp" id="ann-tools">' +
    '<button data-t="cursor" title="Scroll / click links (V)">Select</button>' +
    '<button data-t="laser" title="Laser pointer (L)">Laser</button>' +
    '<button data-t="pen" title="Pen (P)">Pen</button>' +
    '<button data-t="marker" title="Highlighter (H)">Marker</button>' +
    '<button data-t="text" title="Text block (T)">Text</button>' +
    '<button data-t="eraser" title="Eraser (E)">Eraser</button></div>' +
    '<div class="grp" id="ann-colors"></div>' +
    '<div class="grp"><input id="ann-size" type="range" min="1" max="24" value="4" title="Size"></div>' +
    '<div class="grp"><button id="ann-undo" title="Undo (Ctrl+Z)">Undo</button>' +
    '<button id="ann-clear" title="Clear all ink">Clear</button>' +
    '<button id="ann-close" title="Close (Esc)">\u2715</button></div>';
  document.body.appendChild(pal);
  const colorsEl = pal.querySelector("#ann-colors");
  COLORS.forEach((c) => {
    const b = document.createElement("button");
    b.className = "sw"; b.style.background = c; b.dataset.c = c; b.title = c;
    colorsEl.appendChild(b);
  });
  const custom = document.createElement("input");
  custom.type = "color"; custom.value = color; custom.title = "Custom color"; custom.className = "sw-custom";
  colorsEl.appendChild(custom);

  // ----- geometry -----
  const centerX = () => article.offsetLeft + article.offsetWidth / 2;
  function layout() {
    const w = Math.max(1, pv.clientWidth);
    const h = Math.max(pv.clientHeight, article.offsetTop + article.offsetHeight + 40);
    const dpr = window.devicePixelRatio || 1;
    scale = Math.max(1, Math.min(dpr, 16000 / Math.max(w, h)));
    if (w !== W || h !== H) {
      W = w; H = h;
      ink.style.width = w + "px"; ink.style.height = h + "px";
      ink.width = Math.ceil(w * scale); ink.height = Math.ceil(h * scale);
    }
    redraw(); placeTexts();
    const r = pv.getBoundingClientRect();
    laser.style.left = r.left + "px"; laser.style.top = r.top + "px";
    laser.style.width = r.width + "px"; laser.style.height = r.height + "px";
    const ls = window.devicePixelRatio || 1;
    laser.width = Math.ceil(r.width * ls); laser.height = Math.ceil(r.height * ls);
    lctx.setTransform(ls, 0, 0, ls, 0, 0);
    const pw = pal.offsetWidth || 0, mid = r.left + r.width / 2;
    pal.style.left = Math.min(Math.max(mid, pw / 2 + 8), window.innerWidth - pw / 2 - 8) + "px";
  }

  // ----- text blocks -----
  const snap = () => ({ s: strokes.slice(), t: texts.map((t) => ({ x: t.x, y: t.y, text: t.text, color: t.color, size: t.size })) });
  function placeTexts() {
    const cx = centerX();
    texts.forEach((t) => { t.el.style.left = cx + t.x + "px"; t.el.style.top = t.y + "px"; });
  }
  const fontPx = (s) => 12 + s * 1.5;
  function styleText(t) { t.el.style.color = t.color; t.el.style.fontSize = fontPx(t.size) + "px"; }
  function makeText(r, focus) {
    const t = { x: r.x, y: r.y, text: r.text || "", color: r.color, size: r.size };
    const el = document.createElement("div");
    el.className = "ann-text";
    el.innerHTML = '<span class="h" title="Drag to move">\u2725</span><div class="b" contenteditable="plaintext-only" spellcheck="false"></div><button class="x" title="Delete">\u2715</button>';
    const body = el.querySelector(".b");
    body.textContent = t.text;
    t.el = el; pv.appendChild(el); styleText(t);
    body.addEventListener("input", () => { t.text = body.innerText; });
    body.addEventListener("focus", () => { selected = t; el.classList.add("sel"); });
    body.addEventListener("blur", () => {
      el.classList.remove("sel");
      if (!body.innerText.trim()) removeText(t);
    });
    body.addEventListener("keydown", (e) => { e.stopPropagation(); if (e.key === "Escape") body.blur(); });
    el.querySelector(".x").onclick = () => { undo.push(snap()); removeText(t); };
    const h = el.querySelector(".h");
    h.addEventListener("pointerdown", (e) => {
      e.preventDefault(); h.setPointerCapture(e.pointerId);
      const before = snap(); const sx = e.clientX, sy = e.clientY, ox = t.x, oy = t.y; let moved = false;
      const mv = (ev) => { moved = true; t.x = ox + ev.clientX - sx; t.y = Math.max(0, oy + ev.clientY - sy); placeTexts(); };
      const up = () => { h.removeEventListener("pointermove", mv); h.removeEventListener("pointerup", up); if (moved) undo.push(before); };
      h.addEventListener("pointermove", mv); h.addEventListener("pointerup", up);
    });
    texts.push(t); placeTexts();
    if (focus) body.focus();
    return t;
  }
  let selected = null;
  function removeText(t) {
    const i = texts.indexOf(t);
    if (i >= 0) texts.splice(i, 1);
    if (t.el.parentNode) t.el.parentNode.removeChild(t.el);
    if (selected === t) selected = null;
  }
  function restore(sn) {
    strokes = sn.s;
    texts.slice().forEach(removeText);
    sn.t.forEach((r) => makeText(r, false));
    redraw();
  }

  // ----- drawing -----
  function drawStroke(st, cx) {
    const p = st.pts;
    ictx.save();
    ictx.lineCap = "round"; ictx.lineJoin = "round";
    ictx.strokeStyle = st.color; ictx.fillStyle = st.color;
    const w = st.tool === "marker" ? st.size * 3.5 : st.size;
    ictx.lineWidth = w;
    ictx.globalAlpha = st.tool === "marker" ? 0.35 : 1;
    if (p.length === 1) {
      ictx.beginPath(); ictx.arc(p[0][0] + cx, p[0][1], w / 2, 0, Math.PI * 2); ictx.fill();
    } else {
      ictx.beginPath();
      ictx.moveTo(p[0][0] + cx, p[0][1]);
      for (let i = 1; i < p.length - 1; i++) {
        const mx = (p[i][0] + p[i + 1][0]) / 2 + cx, my = (p[i][1] + p[i + 1][1]) / 2;
        ictx.quadraticCurveTo(p[i][0] + cx, p[i][1], mx, my);
      }
      const l = p[p.length - 1];
      ictx.lineTo(l[0] + cx, l[1]);
      ictx.stroke();
    }
    ictx.restore();
  }
  let raf = 0;
  function redraw() {
    ictx.setTransform(scale, 0, 0, scale, 0, 0);
    ictx.clearRect(0, 0, W, H);
    const cx = centerX();
    strokes.forEach((s) => drawStroke(s, cx));
  }
  const redrawSoon = () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; redraw(); }); };

  // ----- laser -----
  let trail = [], head = null, lraf = 0;
  function laserFrame() {
    lraf = 0;
    const r = laser.getBoundingClientRect();
    lctx.clearRect(0, 0, r.width, r.height);
    const now = performance.now();
    trail = trail.filter((p) => now - p.t < TRAIL_MS);
    lctx.lineCap = "round"; lctx.lineJoin = "round";
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1], b = trail[i];
      const k = 1 - (now - b.t) / TRAIL_MS;
      lctx.strokeStyle = color; lctx.globalAlpha = Math.max(0, k) * 0.9;
      lctx.lineWidth = 2 + size * 0.9 * k;
      lctx.beginPath(); lctx.moveTo(a.x, a.y); lctx.lineTo(b.x, b.y); lctx.stroke();
    }
    lctx.globalAlpha = 1;
    if (head) {
      const g = lctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 16 + size);
      g.addColorStop(0, color); g.addColorStop(0.3, color + "99"); g.addColorStop(1, color + "00");
      lctx.fillStyle = g; lctx.beginPath(); lctx.arc(head.x, head.y, 16 + size, 0, Math.PI * 2); lctx.fill();
      lctx.fillStyle = "#fff"; lctx.beginPath(); lctx.arc(head.x, head.y, 2 + size * 0.35, 0, Math.PI * 2); lctx.fill();
    }
    if (trail.length || head) lraf = requestAnimationFrame(laserFrame);
  }
  const laserKick = () => { if (!lraf) lraf = requestAnimationFrame(laserFrame); };

  // ----- pointer handling (on the ink canvas) -----
  const pos = (e) => { const r = ink.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const hitErase = (x, y) => {
    const rad = size * 2 + 8, cx = centerX();
    const keep = strokes.filter((s) => !s.pts.some((q) => Math.hypot(q[0] + cx - x, q[1] - y) < rad + (s.tool === "marker" ? size * 1.7 : s.size / 2)));
    if (keep.length !== strokes.length) {
      if (!erasedAny) { undo.push(snap()); erasedAny = true; }
      strokes = keep; redrawSoon();
    }
  };
  ink.addEventListener("pointerdown", (e) => {
    if (tool === "cursor" || e.button > 0) return;
    ink.setPointerCapture(e.pointerId);
    const [x, y] = pos(e);
    if (tool === "pen" || tool === "marker") {
      undo.push(snap());
      cur = { tool, color, size, pts: [[x - centerX(), y]] };
      strokes.push(cur); redrawSoon();
    } else if (tool === "text") {
      textStart = [x, y];
    } else if (tool === "eraser") { erasing = true; erasedAny = false; hitErase(x, y); }
    else if (tool === "laser") { trail.push({ x: e.clientX - laser.getBoundingClientRect().left, y: e.clientY - laser.getBoundingClientRect().top, t: performance.now() }); laserKick(); }
  });
  ink.addEventListener("pointermove", (e) => {
    const [x, y] = pos(e);
    if (tool === "laser") {
      const r = laser.getBoundingClientRect();
      head = { x: e.clientX - r.left, y: e.clientY - r.top };
      trail.push({ x: head.x, y: head.y, t: performance.now() });
      laserKick();
    } else if (cur) {
      cur.pts.push([x - centerX(), y]); redrawSoon();
    } else if (erasing) hitErase(x, y);
  });
  let textStart = null;
  const end = (e) => {
    cur = null; erasing = false;
    if (textStart && tool === "text" && e.type === "pointerup") {
      undo.push(snap());
      const nt = makeText({ x: textStart[0] - centerX(), y: textStart[1] - 4, text: "", color, size }, true);
    }
    textStart = null;
  };
  ink.addEventListener("pointerup", end);
  ink.addEventListener("pointercancel", end);
  ink.addEventListener("pointerleave", () => { head = null; laserKick(); });

  // ----- state / UI -----
  function sync() {
    const on = visible && available;
    pal.hidden = !on;
    ink.style.pointerEvents = on && tool !== "cursor" ? "auto" : "none";
    ink.dataset.tool = tool;
    pv.classList.toggle("ann-on", on); pv.dataset.atool = tool;
    laser.style.display = on && tool === "laser" ? "block" : "none";
    pal.querySelectorAll("#ann-tools button").forEach((b) => b.classList.toggle("on", b.dataset.t === tool));
    pal.querySelectorAll(".sw").forEach((b) => b.classList.toggle("on", b.dataset.c === color));
    if (!on) { trail = []; head = null; }
    if (ctx.onChange) ctx.onChange(on);
    if (on) layout();
  }
  pal.querySelectorAll("#ann-tools button").forEach((b) => (b.onclick = () => { tool = b.dataset.t; sync(); }));
  const applySel = () => { if (selected) { selected.color = color; selected.size = size; styleText(selected); } };
  colorsEl.addEventListener("mousedown", (e) => { if (e.target.dataset && e.target.dataset.c) e.preventDefault(); });
  colorsEl.addEventListener("click", (e) => { const c = e.target.dataset && e.target.dataset.c; if (c) { color = c; custom.value = c; sync(); applySel(); } });
  custom.addEventListener("input", () => { color = custom.value; sync(); applySel(); });
  pal.querySelector("#ann-size").oninput = (e) => { size = +e.target.value; applySel(); };
  const doUndo = () => { if (undo.length) restore(undo.pop()); };
  pal.querySelector("#ann-undo").onclick = doUndo;
  pal.querySelector("#ann-clear").onclick = () => { if (strokes.length || texts.length) { undo.push(snap()); strokes = []; texts.slice().forEach(removeText); redraw(); } };
  pal.querySelector("#ann-close").onclick = () => api.toggle(false);

  const onKey = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.shiftKey && e.key.toLowerCase() === "a") { e.preventDefault(); api.toggle(); return; }
    if (!visible || !available) return;
    const t = e.target && e.target.tagName;
    if (t === "TEXTAREA" || t === "INPUT" || t === "SELECT" || (e.target && e.target.isContentEditable)) return;
    if (mod && e.key.toLowerCase() === "z") { e.preventDefault(); doUndo(); return; }
    if (mod || e.altKey) return;
    const map = { v: "cursor", l: "laser", p: "pen", h: "marker", t: "text", e: "eraser" };
    const k = e.key.toLowerCase();
    if (map[k]) { tool = map[k]; sync(); }
    else if (e.key === "Escape") api.toggle(false);
  };
  addEventListener("keydown", onKey);

  const ro1 = new ResizeObserver(() => layout()); ro1.observe(article);
  const ro2 = new ResizeObserver(() => layout()); ro2.observe(pv);
  addEventListener("resize", layout);
  layout(); sync();

  const api = {
    toggle(v) { visible = v === undefined ? !visible : v; sync(); },
    setAvailable(v) { available = v; sync(); },
    isOn() { return visible && available; },
    destroy() {
      ro1.disconnect(); ro2.disconnect();
      removeEventListener("keydown", onKey); removeEventListener("resize", layout);
      cancelAnimationFrame(lraf); cancelAnimationFrame(raf);
      texts.slice().forEach(removeText);
      ink.remove(); laser.remove(); pal.remove();
      pv.classList.remove("ann-on"); delete pv.dataset.atool;
    },
  };
  return api;
}
