"use client";
import {
  Bold, Code, Heading, Italic, LinkIcon, List, ListChecks, ListOrdered, Minus, Quote, SquareCode, Strikethrough, Table,
} from "./Icons";
import { useMemo, useRef, type RefObject } from "react";

type Props = {
  value: string;
  onChange: (v: string) => void;
  wrap: boolean;
  fontSize: number;
  taRef: RefObject<HTMLTextAreaElement | null>;
  onCursor: (ln: number, col: number) => void;
  onScrollRatio: (r: number) => void;
};

export default function Editor({ value, onChange, wrap, fontSize, taRef, onCursor, onScrollRatio }: Props) {
  const gutRef = useRef<HTMLPreElement>(null);
  const lineCount = useMemo(() => value.split("\n").length, [value]);
  const gutterText = useMemo(() => Array.from({ length: lineCount }, (_, i) => i + 1).join("\n"), [lineCount]);

  const ta = () => taRef.current as HTMLTextAreaElement;

  function report() {
    const t = ta();
    if (!t) return;
    const upto = t.value.slice(0, t.selectionStart);
    onCursor(upto.split("\n").length, upto.length - upto.lastIndexOf("\n"));
  }

  /** Replace a range keeping the native undo stack (execCommand), with a fallback. */
  function replaceRange(start: number, end: number, text: string, selStart?: number, selEnd?: number) {
    const t = ta();
    t.focus();
    t.setSelectionRange(start, end);
    let ok = false;
    try {
      ok = text === "" ? (start === end ? true : document.execCommand("delete")) : document.execCommand("insertText", false, text);
    } catch {}
    if (!ok) {
      t.setRangeText(text, start, end, "end");
      onChange(t.value);
    }
    const s = selStart ?? start + text.length;
    t.setSelectionRange(s, selEnd ?? s);
    report();
  }

  function wrapSel(before: string, after = before, placeholder = "text") {
    const t = ta();
    const s = t.selectionStart, e = t.selectionEnd;
    const sel = t.value.slice(s, e) || placeholder;
    replaceRange(s, e, before + sel + after, s + before.length, s + before.length + sel.length);
  }

  function lineRange() {
    const t = ta(), v = t.value;
    const a = v.lastIndexOf("\n", t.selectionStart - 1) + 1;
    let b = v.indexOf("\n", t.selectionEnd);
    if (b < 0) b = v.length;
    return { a, b, v };
  }
  function linePrefix(fn: (l: string, i: number) => string) {
    const { a, b, v } = lineRange();
    const out = v.slice(a, b).split("\n").map(fn).join("\n");
    replaceRange(a, b, out, a, a + out.length);
  }
  const insert = (text: string) => {
    const t = ta();
    replaceRange(t.selectionStart, t.selectionEnd, text);
  };

  const F: Record<string, () => void> = {
    h: () => linePrefix((l) => (/^#{1,5} /.test(l) ? "#" + l : /^###### /.test(l) ? l.replace(/^#+ /, "") : "# " + l)),
    bold: () => wrapSel("**"),
    italic: () => wrapSel("*"),
    strike: () => wrapSel("~~"),
    code: () => wrapSel("`", "`", "code"),
    codeblock: () => wrapSel("\n```\n", "\n```\n", "code"),
    link: () => {
      const t = ta(), s = t.selectionStart, e = t.selectionEnd;
      const sel = t.value.slice(s, e) || "text";
      replaceRange(s, e, `[${sel}](https://)`, s + sel.length + 3, s + sel.length + 11);
    },
    ul: () => linePrefix((l) => "- " + l),
    ol: () => linePrefix((l, i) => `${i + 1}. ` + l),
    task: () => linePrefix((l) => "- [ ] " + l),
    quote: () => linePrefix((l) => "> " + l),
    hr: () => insert("\n\n---\n\n"),
    table: () => insert("\n| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Cell | Cell | Cell |\n"),
  };

  function moveLines(dir: -1 | 1) {
    const { a, b, v } = lineRange();
    const t = ta();
    const off = t.selectionStart - a, len = t.selectionEnd - t.selectionStart;
    if (dir === 1) {
      if (b >= v.length) return;
      let nb = v.indexOf("\n", b + 1);
      if (nb < 0) nb = v.length;
      const next = v.slice(b + 1, nb), block = v.slice(a, b);
      replaceRange(a, nb, next + "\n" + block, a + next.length + 1 + off, a + next.length + 1 + off + len);
    } else {
      if (a === 0) return;
      const pa = v.lastIndexOf("\n", a - 2) + 1;
      const prev = v.slice(pa, a - 1), block = v.slice(a, b);
      replaceRange(pa, b, block + "\n" + prev, pa + off, pa + off + len);
    }
  }
  function duplicate() {
    const { b, a, v } = lineRange();
    const t = ta(), off = t.selectionStart - a, len = t.selectionEnd - t.selectionStart;
    const block = v.slice(a, b);
    replaceRange(b, b, "\n" + block, b + 1 + off, b + 1 + off + len);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    const t = ta();
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && !e.shiftKey && k === "b") { e.preventDefault(); F.bold(); }
    else if (mod && !e.shiftKey && k === "i") { e.preventDefault(); F.italic(); }
    else if (mod && !e.shiftKey && k === "k") { e.preventDefault(); F.link(); }
    else if (mod && e.shiftKey && k === "d") { e.preventDefault(); duplicate(); }
    else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) { e.preventDefault(); moveLines(e.key === "ArrowUp" ? -1 : 1); }
    else if (e.key === "Tab") {
      e.preventDefault();
      if (e.shiftKey) linePrefix((l) => l.replace(/^( {1,2}|\t)/, ""));
      else if (t.selectionStart === t.selectionEnd) insert("  ");
      else linePrefix((l) => "  " + l);
    } else if (e.key === "Enter" && !mod && !e.shiftKey && t.selectionStart === t.selectionEnd) {
      const v = t.value, s = t.selectionStart;
      const ls = v.lastIndexOf("\n", s - 1) + 1, line = v.slice(ls, s);
      const m = line.match(/^(\s*)([-*+] \[[ xX]\] |[-*+] |(\d+)\. |> )/);
      if (m) {
        e.preventDefault();
        if (line.trim() === m[2].trim()) replaceRange(ls, s, "", ls);
        else insert("\n" + m[1] + (m[3] ? `${+m[3] + 1}. ` : m[2].replace(/\[[xX]\]/, "[ ]")));
      }
    }
  }

  const tools: [string, string, React.ReactNode][] = [
    ["h", "Heading", <Heading  key="h" />],
    ["bold", "Bold (Ctrl+B)", <Bold  key="b" />],
    ["italic", "Italic (Ctrl+I)", <Italic  key="i" />],
    ["strike", "Strikethrough", <Strikethrough  key="s" />],
    ["code", "Inline code", <Code  key="c" />],
    ["codeblock", "Code block", <SquareCode  key="cb" />],
    ["link", "Link (Ctrl+K)", <LinkIcon  key="l" />],
    ["ul", "Bullet list", <List  key="ul" />],
    ["ol", "Numbered list", <ListOrdered  key="ol" />],
    ["task", "Task list", <ListChecks  key="t" />],
    ["quote", "Quote", <Quote  key="q" />],
    ["hr", "Horizontal rule", <Minus  key="hr" />],
    ["table", "Table", <Table  key="tb" />],
  ];

  return (
    <div className="editor">
      <div className="fmt" role="toolbar" aria-label="Formatting">
        {tools.map(([k, title, icon]) => (
          <button key={k} className="btn icon" title={title} aria-label={title} onMouseDown={(e) => e.preventDefault()} onClick={() => F[k]()}>
            {icon}
          </button>
        ))}
      </div>
      <div className="ed-wrap" style={{ fontSize }}>
        {!wrap && (
          <div className="gutter" aria-hidden>
            <pre ref={gutRef}>{gutterText}</pre>
          </div>
        )}
        <textarea
          ref={taRef}
          className={wrap ? "wrap" : ""}
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          wrap={wrap ? "soft" : "off"}
          placeholder="Type or paste markdown here..."
          aria-label="Markdown editor"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onSelect={report}
          onScroll={(e) => {
            const t = e.currentTarget;
            if (gutRef.current) gutRef.current.style.transform = `translateY(${-t.scrollTop}px)`;
            onScrollRatio(t.scrollTop / Math.max(1, t.scrollHeight - t.clientHeight));
          }}
        />
      </div>
    </div>
  );
}
