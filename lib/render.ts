import { marked } from "marked";
import DOMPurify from "dompurify";
import hljs from "highlight.js/lib/common";

export type TocItem = { id: string; text: string; level: number };

const slug = (s: string) =>
  s.toLowerCase().trim().replace(/[^\wÀ-￿\- ]+/g, "").replace(/\s+/g, "-");

/** Render markdown into `target` (sanitised), add heading ids, copy buttons, highlighting. */
export function renderInto(md: string, target: HTMLElement): TocItem[] {
  const raw = marked.parse(md, { gfm: true, breaks: false }) as string;
  target.innerHTML = DOMPurify.sanitize(raw, { ADD_ATTR: ["target"] });

  const seen: Record<string, number> = {};
  const toc: TocItem[] = [];
  target.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6").forEach((h) => {
    let id = slug(h.textContent || "") || "section";
    if (seen[id] != null) id += "-" + ++seen[id];
    else seen[id] = 0;
    h.id = id;
    if (+h.tagName[1] <= 4) toc.push({ id, text: h.textContent || "", level: +h.tagName[1] });
  });

  target.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((a) => {
    if (/^https?:/i.test(a.getAttribute("href") || "")) {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    }
  });

  // interactive task-list checkboxes (index = order in document)
  target.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((cb, i) => {
    cb.disabled = false;
    cb.dataset.task = String(i);
    cb.style.cursor = "pointer";
  });

  target.querySelectorAll<HTMLElement>("pre > code").forEach((code) => {
    const lang = /language-([\w+-]+)/.exec(code.className)?.[1];
    try {
      hljs.highlightElement(code);
    } catch {}
    const pre = code.parentElement as HTMLElement;
    pre.classList.add("has-copy");
    if (lang) {
      const l = document.createElement("span");
      l.className = "code-lang";
      l.textContent = lang;
      pre.appendChild(l);
    }
    const b = document.createElement("button");
    b.className = "copy-code";
    b.type = "button";
    b.textContent = "Copy";
    b.onclick = async () => {
      await navigator.clipboard.writeText(code.textContent || "");
      b.textContent = "Copied!";
      setTimeout(() => (b.textContent = "Copy"), 1200);
    };
    pre.appendChild(b);
  });
  return toc;
}

/** Toggle the n-th task-list marker in the markdown source (skips fenced code). */
export function toggleTask(md: string, index: number): string {
  const lines = md.split("\n");
  let fence: string | null = null,
    n = 0;
  for (let i = 0; i < lines.length; i++) {
    const f = /^\s*(```|~~~)/.exec(lines[i]);
    if (f) {
      fence = fence ? (fence === f[1] ? null : fence) : f[1];
      continue;
    }
    if (fence) continue;
    const m = /^(\s*(?:[-*+]|\d+\.)\s+)\[([ xX])\]/.exec(lines[i]);
    if (m) {
      if (n === index) {
        lines[i] = lines[i].replace(/\[([ xX])\]/, m[2] === " " ? "[x]" : "[ ]");
        break;
      }
      n++;
    }
  }
  return lines.join("\n");
}
