"use client";
import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { renderInto, type TocItem } from "@/lib/render";
import { initAnnotate, type AnnApi } from "@/lib/annotate";

type Props = {
  text: string;
  width: string;
  fontSize: number;
  mode: "preview" | "split" | "editor";
  pvRef: RefObject<HTMLDivElement | null>;
  articleRef: RefObject<HTMLElement | null>;
  annRef: MutableRefObject<AnnApi | null>;
  onAnnChange: (on: boolean) => void;
  onToc: (t: TocItem[]) => void;
  onToggleTask: (i: number) => void;
  onScrollRatio: (r: number) => void;
};

export default function Preview({ text, width, fontSize, mode, pvRef, articleRef, annRef, onAnnChange, onToc, onToggleTask, onScrollRatio }: Props) {
  const first = useRef(true);
  const cbRef = useRef(onAnnChange);
  cbRef.current = onAnnChange;

  // render markdown (debounced after the first paint)
  useEffect(() => {
    const run = () => articleRef.current && onToc(renderInto(text, articleRef.current));
    if (first.current) {
      first.current = false;
      run();
      return;
    }
    const t = setTimeout(run, 80);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  // annotation layer lives for the lifetime of the preview
  useEffect(() => {
    const ann = initAnnotate({ pv: pvRef.current!, article: articleRef.current!, onChange: (on) => cbRef.current(on) });
    annRef.current = ann;
    return () => {
      ann.destroy();
      annRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    annRef.current?.setAvailable(mode !== "editor");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div
      ref={pvRef}
      className="pv"
      style={{ ["--mw" as any]: width, ["--fs" as any]: fontSize + "px" }}
      onScroll={(e) => {
        const t = e.currentTarget;
        onScrollRatio(t.scrollTop / Math.max(1, t.scrollHeight - t.clientHeight));
      }}
    >
      <article
        ref={articleRef as RefObject<HTMLElement>}
        className="markdown-body"
        onClick={(e) => {
          const el = e.target as HTMLElement;
          if (el instanceof HTMLInputElement && el.dataset.task != null) {
            e.preventDefault();
            onToggleTask(+el.dataset.task);
          }
        }}
      />
    </div>
  );
}
