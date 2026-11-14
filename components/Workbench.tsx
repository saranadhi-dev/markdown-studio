"use client";
import {
  Check, Keyboard, 
  Minus, Plus, X,
} from "./Icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "./Editor";
import Menu from "./Menu";
import Preview from "./Preview";
import type { AnnApi } from "@/lib/annotate";
import { toggleTask, type TocItem } from "@/lib/render";
import { WELCOME } from "@/lib/welcome";

type Mode = "preview" | "split" | "editor";
const WIDTHS: [string, string][] = [["Narrow", "720px"], ["Default", "880px"], ["Wide", "1200px"], ["Full width", "100%"]];
const MD_RE = /\.(md|markdown|mdown|txt)$/i;

const SHORTCUTS: [string, string][] = [
  ["Ctrl + O", "Open file"], ["Ctrl + S", "Save (to opened file, else download)"], ["Ctrl + E", "Cycle Preview / Split / Editor"],
  ["Ctrl + Shift + A", "Toggle annotate"], ["Ctrl + B / I / K", "Bold / Italic / Link"], ["Tab / Shift + Tab", "Indent / outdent"],
  ["Alt + Up / Down", "Move line(s)"], ["Ctrl + Shift + D", "Duplicate line(s)"], ["Ctrl + /", "This help"],
  ["Annotate: L P H T E V", "Laser, Pen, Marker, Text, Eraser, Select"], ["Annotate: Ctrl + Z / Esc", "Undo / close"],
];

export default function Workbench() {
  const [text, setText] = useState(WELCOME);
  const [name, setName] = useState("Untitled.md");
  const [savedText, setSavedText] = useState(WELCOME);
  const [mode, setMode] = useState<Mode>("split");
  const [toc, setToc] = useState<TocItem[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [width, setWidth] = useState("880px");
  const [font, setFont] = useState(16);
  const [wrap, setWrap] = useState(false);
  const [annOn, setAnnOn] = useState(false);
  const [cursor, setCursor] = useState<[number, number]>([1, 1]);
  const [toast, setToast] = useState("");
  const [dragging, setDragging] = useState(false);
  const [help, setHelp] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const taRef = useRef<HTMLTextAreaElement>(null);
  const pvRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const annRef = useRef<AnnApi | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const handleRef = useRef<any>(null);
  const toastTimer = useRef<any>(null);
  const lock = useRef(false);

  const dirty = text !== savedText;
  const base = name.replace(MD_RE, "") || "document";
  const stats = useMemo(() => {
    const words = (text.match(/\S+/g) || []).length;
    return { words, chars: text.length, mins: Math.max(1, Math.round(words / 220)) };
  }, [text]);

  const say = useCallback((m: string) => {
    setToast(m);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 1800);
  }, []);

  // ---------- persistence (browser only) ----------
  useEffect(() => {
    try {
      const d = JSON.parse(localStorage.getItem("mds:draft") || "null");
      if (d && typeof d.text === "string") {
        setText(d.text); setName(d.name || "Untitled.md"); setSavedText(typeof d.saved === "string" ? d.saved : d.text);
      }
      const p = JSON.parse(localStorage.getItem("mds:prefs") || "null");
      if (p) {
        if (p.mode) setMode(p.mode);
        if (p.width) setWidth(p.width);
        if (p.font) setFont(p.font);
        if (typeof p.wrap === "boolean") setWrap(p.wrap);
        if (typeof p.toc === "boolean") setShowToc(p.toc);
      }
    } catch { }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    const t = setTimeout(() => {
      try { localStorage.setItem("mds:draft", JSON.stringify({ text, name, saved: savedText })); } catch { }
    }, 300);
    return () => clearTimeout(t);
  }, [text, name, savedText, hydrated]);
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem("mds:prefs", JSON.stringify({ mode, width, font, wrap, toc: showToc })); } catch { }
  }, [mode, width, font, wrap, showToc, hydrated]);

  // ---------- file ops ----------
  const load = useCallback((content: string, fname: string, handle: any = null) => {
    setText(content); setName(fname); setSavedText(content); handleRef.current = handle;
    say(`Opened ${fname}`);
  }, [say]);

  const readFile = useCallback(async (f: File, handle: any = null) => {
    if (f.size > 5_000_000) return say("File is larger than 5 MB");
    load(await f.text(), f.name, handle);
  }, [load, say]);

  const openFile = useCallback(async () => {
    const w: any = window;
    if (w.showOpenFilePicker) {
      try {
        const [h] = await w.showOpenFilePicker({ types: [{ description: "Markdown", accept: { "text/markdown": [".md", ".markdown", ".mdown", ".txt"] } }] });
        await readFile(await h.getFile(), h);
      } catch { } // cancelled
    } else fileInput.current?.click();
  }, [readFile]);

  const download = (fname: string, content: string, type: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([content], { type }));
    a.download = fname;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const save = useCallback(async () => {
    const h = handleRef.current;
    if (h?.createWritable) {
      try {
        const w = await h.createWritable();
        await w.write(text);
        await w.close();
        setSavedText(text);
        return say(`Saved ${h.name}`);
      } catch { } // fall through to download
    }
    download(MD_RE.test(name) ? name : base + ".md", text, "text/markdown");
    setSavedText(text);
    say("Downloaded " + base + ".md");
  }, [text, name, base, say]);

  const newDoc = () => {
    if (dirty && !confirm("Discard unsaved changes?")) return;
    setText(""); setSavedText(""); setName("Untitled.md"); handleRef.current = null;
    setTimeout(() => taRef.current?.focus(), 0);
  };

  const getHtml = () => {
    const c = articleRef.current?.cloneNode(true) as HTMLElement | undefined;
    c?.querySelectorAll(".copy-code,.code-lang").forEach((x) => x.remove());
    c?.querySelectorAll("input[type=checkbox]").forEach((x) => x.setAttribute("disabled", ""));
    return c?.innerHTML || "";
  };
  const exportHtml = () => {
    const css = "body{max-width:860px;margin:40px auto;padding:0 20px;font:16px/1.6 system-ui,sans-serif;color:#1f2328;background:#fff}pre{background:#f6f8fa;padding:12px;overflow:auto;border-radius:6px}code{font-family:ui-monospace,monospace}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:6px 10px}blockquote{border-left:4px solid #ccc;margin-left:0;padding-left:16px;color:#555}img{max-width:100%}@media(prefers-color-scheme:dark){body{background:#0d1117;color:#e6edf3}pre{background:#161b22}td,th{border-color:#30363d}blockquote{border-color:#30363d;color:#8b949e}}";
    download(base + ".html", `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${base}</title><style>${css}</style>${getHtml()}`, "text/html");
  };
  const exportPdf = () => {
    const m = mode, old = document.title;
    setMode("preview");
    document.title = base; // suggested PDF file name
    setTimeout(() => { window.print(); document.title = old; setMode(m); }, 350);
  };
  const copy = async (s: string, msg: string) => { await navigator.clipboard.writeText(s); say(msg); };

  // ---------- scroll sync ----------
  const syncTo = (from: "ed" | "pv") => (r: number) => {
    if (mode !== "split" || lock.current) return;
    const to = from === "ed" ? pvRef.current : taRef.current;
    if (!to) return;
    lock.current = true;
    to.scrollTop = r * (to.scrollHeight - to.clientHeight);
    requestAnimationFrame(() => (lock.current = false));
  };

  // ---------- global shortcuts ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (mod && !e.shiftKey && k === "s") { e.preventDefault(); save(); }
      else if (mod && !e.shiftKey && k === "o") { e.preventDefault(); openFile(); }
      else if (mod && !e.shiftKey && k === "e") { e.preventDefault(); setMode((m) => (m === "preview" ? "split" : m === "split" ? "editor" : "preview")); }
      else if (mod && k === "/") { e.preventDefault(); setHelp((h) => !h); }
      else if (e.key === "Escape") setHelp(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, openFile]);

  // warn on unload with unsaved changes
  useEffect(() => {
    const f = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", f);
    return () => window.removeEventListener("beforeunload", f);
  }, [dirty]);

  // ---------- drag & drop ----------
  useEffect(() => {
    let n = 0;
    const has = (e: DragEvent) => Array.from(e.dataTransfer?.types || []).includes("Files");
    const enter = (e: DragEvent) => { if (has(e)) { n++; setDragging(true); } };
    const leave = (e: DragEvent) => { if (has(e) && --n <= 0) { n = 0; setDragging(false); } };
    const over = (e: DragEvent) => has(e) && e.preventDefault();
    const drop = async (e: DragEvent) => {
      if (!has(e)) return;
      e.preventDefault(); n = 0; setDragging(false);
      const f = e.dataTransfer!.files[0];
      if (f && (MD_RE.test(f.name) || f.type.startsWith("text/"))) await readFile(f);
      else say("Drop a .md or .txt file");
    };
    window.addEventListener("dragenter", enter); window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over); window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter); window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over); window.removeEventListener("drop", drop);
    };
  }, [readFile, say]);

  const modes: [Mode, string][] = [
    ["preview", "Preview"],
    ["split", "Split"],
    ["editor", "Editor"],
  ];

  return (
    <div className="app">
      <header className="bar">

        <div className="seg" role="tablist" aria-label="View mode">
          {modes.map(([m, label]) => (
            <button key={m} role="tab" aria-selected={mode === m} className={mode === m ? "on" : ""} onClick={() => setMode(m)} title={`${label} (Ctrl+E to cycle)`}>
              <span className="lbl">{label}</span>
            </button>
          ))}
        </div>

        <div className="actions">

          <button className="btn" onClick={newDoc} title="New document"><span className="lbl">New</span></button>
          <button className="btn" onClick={openFile} title="Open a markdown file (Ctrl+O)"><span className="lbl">Open</span></button>
          <span className="sep" />

          <Menu label="Layout" title="Layout options">
            <div className="mi-title">Layout</div>

            <button className="mi" onClick={() => setShowToc((v) => !v)}><span>Table of contents</span>{showToc && <Check />}</button>

            <div className="mi-title">Preview width</div>
            {WIDTHS.map(([l, v]) => (
              <button key={v} className="mi" onClick={() => setWidth(v)}><span>{l}</span>{width === v && <Check />}</button>
            ))}
            <div className="mi-title">Text size</div>
            <div className="mi row">
              <button className="btn icon" onClick={() => setFont((f) => Math.max(11, f - 1))} aria-label="Smaller"><Minus /></button>
              <span className="mono">{font}px</span>
              <button className="btn icon" onClick={() => setFont((f) => Math.min(28, f + 1))} aria-label="Larger"><Plus /></button>
            </div>
          </Menu>

          <button className={"btn" + (annOn ? " on" : "")} onClick={() => annRef.current?.toggle()} title="Annotate: laser, pen, text (Ctrl+Shift+A)" aria-pressed={annOn} disabled={mode === "editor"}>
            <span className="lbl">Annotate</span>
          </button>

          <span className="sep" />

          <button className="btn" onClick={() => copy(text, "Markdown copied")} title="Copy markdown"><span className="lbl">Copy</span></button>

          <Menu label="Download">
            <button className="mi" data-close onClick={() => download(MD_RE.test(name) ? name : base + ".md", text, "text/markdown")}><span>Markdown (.md)</span></button>
            <button className="mi" data-close onClick={exportHtml}><span>HTML (.html)</span></button>
            <div className="mi-sep" />
            <button className="mi" data-close onClick={() => copy(getHtml(), "HTML copied")}><span>Copy rendered HTML</span></button>
          </Menu>


          <button className="btn icon" onClick={() => setHelp(true)} title="Keyboard shortcuts (Ctrl+/)" aria-label="Keyboard shortcuts"><Keyboard /></button>
        </div>
      </header>

      <main className={`main mode-${mode}`}>
        {showToc && mode !== "editor" && (
          <>
            <div className="toc-backdrop" onClick={() => setShowToc(false)} />
            <aside className="toc" aria-label="Table of contents">
              <div className="toc-head"><span>Outline</span><button className="btn icon" onClick={() => setShowToc(false)} aria-label="Close outline"><X /></button></div>
              {toc.length === 0 && <p className="muted pad">No headings</p>}
              {toc.map((t, i) => (
                <a key={t.id + i} href={"#" + t.id} className={"l" + t.level}
                  onClick={(e) => {
                    e.preventDefault();
                    document.getElementById(t.id)?.scrollIntoView({ behavior: "smooth", block: "start" });
                    if (window.innerWidth <= 768) setShowToc(false);
                  }}>{t.text}</a>
              ))}
            </aside>
          </>
        )}

        <section className="pane editor-pane">
          <Editor value={text} onChange={setText} wrap={wrap} fontSize={Math.max(12, font - 2)} taRef={taRef}
            onCursor={(l, c) => setCursor([l, c])} onScrollRatio={syncTo("ed")} />
        </section>
        <section className="pane preview-pane">
          <Preview text={text} width={width} fontSize={font} mode={mode} pvRef={pvRef} articleRef={articleRef} annRef={annRef}
            onAnnChange={setAnnOn} onToc={setToc} onScrollRatio={syncTo("pv")}
            onToggleTask={(i) => setText((t) => toggleTask(t, i))} />
        </section>
      </main>

      <footer className="status">
        <span className="mono">Ln {cursor[0]}, Col {cursor[1]}</span>
        <span>{stats.words} words</span>
        <span className="hide-sm">{stats.chars} chars</span>
        <span className="hide-sm">{stats.mins} min read</span>
        <span className="grow" />
        <span className="hide-sm">{handleRef.current ? "Linked file" : "Browser draft"}</span>
        <span className={dirty ? "warn" : "ok"}>{dirty ? "Unsaved" : "Saved"}</span>
        <span className="hide-sm">Markdown</span>
      </footer>

      <input ref={fileInput} type="file" accept=".md,.markdown,.mdown,.txt,text/markdown,text/plain" hidden
        onChange={async (e) => { const f = e.target.files?.[0]; if (f) await readFile(f); e.target.value = ""; }} />

      {dragging && <div className="drop"><div>Drop a markdown file to open</div></div>}
      {toast && <div className="toast" role="status">{toast}</div>}
      {help && (
        <div className="modal-bg" onClick={() => setHelp(false)}>
          <div className="modal" role="dialog" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head"><h2>Keyboard shortcuts</h2><button className="btn icon" onClick={() => setHelp(false)} aria-label="Close"><X /></button></div>
            <dl>{SHORTCUTS.map(([k, d]) => (<div key={k}><dt>{k}</dt><dd>{d}</dd></div>))}</dl>
          </div>
        </div>
      )}
    </div>
  );
}
