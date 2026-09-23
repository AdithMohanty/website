"use client";

import { useEffect, useRef } from "react";

const CELL_COL = 100;
const CELL_ROW = 80;

type Cell = { col: number; row: number };

// "col,row" -> a cell's fading trail box.
function key(col: number, row: number) {
  return `${col},${row}`;
}

function cellAt(x: number, y: number): Cell {
  return { col: Math.floor(x / CELL_COL), row: Math.floor(y / CELL_ROW) };
}

// Cells on the line from a to b (Bresenham), excluding a.
function cellsBetween(a: Cell, b: Cell): Cell[] {
  const cells: Cell[] = [];
  let { col, row } = a;
  const dc = Math.abs(b.col - col);
  const dr = -Math.abs(b.row - row);
  const sc = col < b.col ? 1 : -1;
  const sr = row < b.row ? 1 : -1;
  let err = dc + dr;
  while (col !== b.col || row !== b.row) {
    const e2 = 2 * err;
    if (e2 >= dr) {
      err += dr;
      col += sc;
    }
    if (e2 <= dc) {
      err += dc;
      row += sr;
    }
    cells.push({ col, row });
  }
  return cells;
}

export default function Grid() {
  const trailRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef<HTMLDivElement>(null);
  const flashRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const trailLayer = trailRef.current;
    const hover = hoverRef.current;
    const flashLayer = flashRef.current;
    if (!trailLayer || !hover || !flashLayer) return;

    let current: Cell | null = null;
    // One fading box per cell.
    const trails = new Map<string, HTMLDivElement>();

    function place(el: HTMLElement, c: Cell) {
      el.style.transform = `translate(${c.col * CELL_COL}px, ${c.row * CELL_ROW}px)`;
    }

    function fadeOut(c: Cell) {
      const k = key(c.col, c.row);
      trails.get(k)?.remove();
      const el = document.createElement("div");
      el.className = "grid-trail";
      place(el, c);
      el.addEventListener("animationend", () => {
        el.remove();
        if (trails.get(k) === el) trails.delete(k);
      });
      trailLayer!.appendChild(el);
      trails.set(k, el);
    }

    function handleMouseMove(e: MouseEvent) {
      const next = cellAt(e.clientX, e.clientY);
      if (current && current.col === next.col && current.row === next.row) return;

      if (current) {
        fadeOut(current);
        // Light the boxes skipped between the last cell and this one.
        for (const c of cellsBetween(current, next).slice(0, -1)) fadeOut(c);
      }

      const k = key(next.col, next.row);
      trails.get(k)?.remove();
      trails.delete(k);

      place(hover!, next);
      hover!.style.opacity = "1";
      current = next;
    }

    function handleMouseLeave() {
      if (current) fadeOut(current);
      hover!.style.opacity = "0";
      current = null;
    }

    function handleClick(e: MouseEvent) {
      // Ignore clicks on controls. composedPath, not target.closest, because
      // the clicked node may already be detached by a re-render.
      const interactive = e
        .composedPath()
        .some(
          (n) =>
            n instanceof Element &&
            n.matches("a, button, input, textarea, select, label, summary, [role='button'], [role='dialog']")
        );
      if (interactive) return;
      const el = document.createElement("div");
      el.className = "grid-flash";
      el.style.background = `hsl(${Math.floor(Math.random() * 360)} 85% 60% / 0.55)`;
      place(el, cellAt(e.clientX, e.clientY));
      el.addEventListener("animationend", () => el.remove());
      flashLayer!.appendChild(el);
    }

    window.addEventListener("mousemove", handleMouseMove);
    document.documentElement.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      document.documentElement.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("click", handleClick);
      trails.forEach((el) => el.remove());
      trails.clear();
      flashLayer.replaceChildren();
    };
  }, []);

  return (
    <div className="grid-layer">
      {/* Filled imperatively. */}
      <div ref={trailRef} />
      <div className="grid-hover" ref={hoverRef} />
      <div ref={flashRef} />
    </div>
  );
}
