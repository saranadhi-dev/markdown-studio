"use client";
import { ChevronDown } from "./Icons";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  label: string;
  icon?: ReactNode;
  title?: string;
  align?: "left" | "right";
  children: ReactNode;
};

/** Dropdown. Any element inside with `data-close` closes the menu when clicked. */
export default function Menu({ label, icon, title, align = "right", children }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      <button className="btn" title={title || label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {icon}
        <span className="lbl">{label}</span>
        <ChevronDown  />
      </button>
      {open && (
        <div
          className={`menu-pop ${align}`}
          role="menu"
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("[data-close]")) setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
