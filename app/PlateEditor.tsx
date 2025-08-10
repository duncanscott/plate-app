"use client";

import React from "react";
import {
  DndContext,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  rectIntersection,
  DragOverlay,
  MeasuringStrategy
} from "@dnd-kit/core";

/** ---------- Plate geometry ---------- */
const ROWS = 8;
const COLS = 12;
const toRowLabel = (i: number) => String.fromCharCode("A".charCodeAt(0) + i);
const toWellId = (r: number, c: number) => `${toRowLabel(r)}${c + 1}`;
const toCoords = (wellId: string) => {
  const m = /^([A-P])(\d{1,2})$/.exec(wellId);
  if (!m) return { r: 0, c: 0 };
  const r = m[1].charCodeAt(0) - "A".charCodeAt(0);
  const c = Number(m[2]) - 1;
  return { r, c };
};

type Sample = { id: string; name: string };
type Assignments = Record<string, string | undefined>;

/** ---------- Drag-only scroll lock (keeps left panel in view while dragging) ---------- */
let __scrollY_for_lock = 0;
function lockBodyScroll() {
  const b = document.body as HTMLBodyElement;
  __scrollY_for_lock = window.scrollY || window.pageYOffset || 0;
  const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
  b.style.position = "fixed";
  b.style.top = `-${__scrollY_for_lock}px`;
  b.style.left = "0";
  b.style.right = "0";
  b.style.width = "100%";
  b.style.overflow = "hidden";
  if (scrollbarWidth > 0) b.style.paddingRight = `${scrollbarWidth}px`;
}
function unlockBodyScroll() {
  const b = document.body as HTMLBodyElement;
  const y = __scrollY_for_lock || 0;
  b.style.position = "";
  b.style.top = "";
  b.style.left = "";
  b.style.right = "";
  b.style.width = "";
  b.style.overflow = "";
  b.style.paddingRight = "";
  window.scrollTo(0, y);
}

/** ---------- Draggable sample tab ---------- */
const DraggableSample = React.memo(function DraggableSample({
  sample,
  selected,
  onToggleSelect,
}: {
  sample: Sample;
  selected: boolean;
  onToggleSelect: (id: string, multi?: boolean, range?: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: sample.id });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.0 : 1, // hide while overlay is shown
    cursor: "grab",
    padding: "8px 10px",
    border: "1px solid var(--border)",
    borderRadius: 10,
    background: selected ? "var(--accent)" : "#fff",
    userSelect: "none",
    boxShadow: selected ? "0 0 0 2px #bcd6ff inset" : undefined,
  };
  const handleClick: React.MouseEventHandler = (e) => {
    onToggleSelect(sample.id, e.metaKey || e.ctrlKey, e.shiftKey);
  };
  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={handleClick} title={sample.name}>
      {sample.name}
    </div>
  );
});

/** ---------- Drag overlay (prevents hit-testing issues) ---------- */
function SampleOverlay({ sample }: { sample: Sample | null }) {
  if (!sample) return null;
  return (
    <div style={{
      pointerEvents: "none",
      padding: "8px 10px",
      border: "1px solid var(--border)",
      borderRadius: 10,
      background: "white",
      boxShadow: "0 6px 18px rgba(0,0,0,0.15)"
    }}>
      {sample.name}
    </div>
  );
}

/** ---------- Droppable well (with ARIA + keyboard) ---------- */
const Well = React.memo(function Well({
  wellId,
  assigned,
  rowIndex,
  colIndex,
  onClear,
  onWellKeyPlace,
  onWellKeyFillRow,
  onWellKeyFillCol,
  onFocusMove,
}: {
  wellId: string;
  assigned?: string;
  rowIndex: number;
  colIndex: number;
  onClear: (id: string) => void;
  onWellKeyPlace: (id: string) => void;
  onWellKeyFillRow: (id: string, clear?: boolean) => void;
  onWellKeyFillCol: (id: string, clear?: boolean) => void;
  onFocusMove: (r: number, c: number) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: wellId });
  const style: React.CSSProperties = {
    width: 30, height: 30, borderRadius: "50%",
    display: "grid", placeItems: "center",
    background: assigned ? "var(--green)" : (isOver ? "var(--accent)" : "var(--muted)"),
    border: "1px solid var(--border)",
    fontSize: 11, lineHeight: 1, userSelect: "none", outlineOffset: 2
  };
  const label = assigned ? `${wellId}: Sample ${assigned}` : `${wellId}: empty`;
  const onKeyDown: React.KeyboardEventHandler = (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onWellKeyPlace(wellId); }
    if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); onClear(wellId); }
    if (e.key.toLowerCase() === "r") { e.preventDefault(); onWellKeyFillRow(wellId, e.shiftKey); }
    if (e.key.toLowerCase() === "c") { e.preventDefault(); onWellKeyFillCol(wellId, e.shiftKey); }
    if (e.key === "ArrowRight") { e.preventDefault(); onFocusMove(rowIndex - 1, colIndex); }
    if (e.key === "ArrowLeft")  { e.preventDefault(); onFocusMove(rowIndex - 1, colIndex - 2); }
    if (e.key === "ArrowDown")  { e.preventDefault(); onFocusMove(rowIndex, colIndex - 1); }
    if (e.key === "ArrowUp")    { e.preventDefault(); onFocusMove(rowIndex - 2, colIndex - 1); }
  };
  return (
    <div
      id={`well-${rowIndex}-${colIndex}`}
      ref={setNodeRef}
      role="gridcell"
      aria-label={label}
      aria-rowindex={rowIndex}
      aria-colindex={colIndex}
      tabIndex={0}
      onKeyDown={onKeyDown}
      title={label}
      style={style}
      onDoubleClick={() => onClear(wellId)}
    >
      {assigned ? "•" : ""}
    </div>
  );
});

/** ---------- PlateEditor (client) ---------- */
export default function PlateEditor() {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const wells = React.useMemo(
    () => Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => toWellId(r, c))),
    []
  );
  const [samples] = React.useState<Sample[]>(
    () => Array.from({ length: 120 }, (_, i) => ({ id: `S${i + 1}`, name: `Sample ${i + 1}` }))
  );
  const [assignments, setAssignments] = React.useState<Assignments>({});
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = React.useState<number | null>(null);
  const [startWell, setStartWell] = React.useState<string>("A1");
  const sampleListRef = React.useRef<HTMLDivElement>(null);

  // Drag overlay sample
  const [overlaySample, setOverlaySample] = React.useState<Sample | null>(null);

  // Live region for announcements
  const [liveMsg, setLiveMsg] = React.useState("");
  const liveAnnounce = (msg: string) => setLiveMsg(msg);

  // Persist state to localStorage
  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("plate-app:v1");
      if (raw) {
        const data = JSON.parse(raw);
        if (data.assignments) setAssignments(data.assignments);
        if (Array.isArray(data.selectedIds)) setSelectedIds(data.selectedIds);
        if (typeof data.startWell === "string") setStartWell(data.startWell);
      }
    } catch {}
  }, []);
  React.useEffect(() => {
    try {
      localStorage.setItem("plate-app:v1", JSON.stringify({ assignments, selectedIds, startWell }));
    } catch {}
  }, [assignments, selectedIds, startWell]);

  React.useEffect(() => () => { try { unlockBodyScroll(); } catch {} }, []);

  const onToggleSelect = React.useCallback((id: string, multi?: boolean, range?: boolean) => {
    const idx = samples.findIndex(s => s.id === id);
    setSelectedIds(prev => {
      if (range && lastSelectedIndex !== null) {
        const [a, b] = [lastSelectedIndex, idx].sort((x, y) => x - y);
        const rangeIds = samples.slice(a, b + 1).map(s => s.id);
        const base = new Set(multi ? prev : []);
        rangeIds.forEach(x => base.add(x));
        return Array.from(base);
      }
      if (multi) {
        const set = new Set(prev);
        set.has(id) ? set.delete(id) : set.add(id);
        return Array.from(set);
      }
      setLastSelectedIndex(idx);
      return [id];
    });
    if (!range) setLastSelectedIndex(idx);
  }, [samples, lastSelectedIndex]);

  const clearWell = (wellId: string) => {
    setAssignments(prev => {
      const clone = { ...prev };
      delete clone[wellId];
      return clone;
    });
    liveAnnounce(`Cleared ${wellId}`);
  };

  const onDragStart = (e: DragStartEvent) => {
    // Give DnD Kit one frame to measure initial layouts before we reposition <body>
    requestAnimationFrame(() => lockBodyScroll());
    const id = String(e.active.id);
    const sample = samples.find(s => s.id === id) || null;
    setOverlaySample(sample);
    if (!selectedIds.includes(id)) {
      const idx = samples.findIndex(s => s.id === id);
      setSelectedIds([id]);
      setLastSelectedIndex(idx);
    }
  };
  const onDragEnd = (e: DragEndEvent) => {
    unlockBodyScroll();
    setOverlaySample(null);
    const sampleId = String(e.active.id);
    const dropId = e.over?.id ? String(e.over.id) : null;
    if (!dropId) return;
    setAssignments(prev => ({ ...prev, [dropId]: sampleId }));
    liveAnnounce(`Placed ${sampleId} in ${dropId}`);
  };
  const onDragCancel = () => { unlockBodyScroll(); setOverlaySample(null); };

  const clearPlate = () => { setAssignments({}); liveAnnounce("Cleared plate"); };

  // Fill helpers (row-major/col-major) starting at selected start well
  const plateOrderRowMajor = React.useMemo(() => {
    const ids: string[] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) ids.push(toWellId(r, c));
    return ids;
  }, []);
  const plateOrderColMajor = React.useMemo(() => {
    const ids: string[] = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) ids.push(toWellId(r, c));
    return ids;
  }, []);
  const rotateOrderFromStart = (order: string[], start: string) => {
    const i = order.indexOf(start);
    if (i === -1) return order;
    return order.slice(i).concat(order.slice(0, i));
  };
  const allSelectedIs96 = selectedIds.length === ROWS * COLS;
  const wellsFlat = React.useMemo(() => wells.flat(), [wells]);
  const unassignedCount = wellsFlat.filter(id => !assignments[id]).length;

  const fillWithSelection = (mode: "rows" | "cols") => {
    if (!allSelectedIs96) return;
    const selectedInDisplayOrder = samples.filter(s => selectedIds.includes(s.id)).map(s => s.id);
    const order = rotateOrderFromStart(mode === "rows" ? plateOrderRowMajor : plateOrderColMajor, startWell);
    const next: Assignments = { ...assignments };
    for (let i = 0; i < order.length; i++) next[order[i]] = selectedInDisplayOrder[i];
    setAssignments(next);
    liveAnnounce(`Filled plate by ${mode}`);
  };

  // Keyboard placement & batch ops
  const onWellKeyPlace = React.useCallback((wellId: string) => {
    const sampleId = selectedIds[0];
    if (!sampleId) return;
    setAssignments(prev => ({ ...prev, [wellId]: sampleId }));
    liveAnnounce(`Placed ${sampleId} in ${wellId}`);
  }, [selectedIds]);

  const onWellKeyFillRow = React.useCallback((wellId: string, clear?: boolean) => {
    const { r } = toCoords(wellId);
    const ids = Array.from({ length: COLS }, (_, c) => toWellId(r, c));
    setAssignments(prev => {
      const next = { ...prev };
      if (clear) {
        ids.forEach(id => { delete next[id]; });
        return next;
      }
      const sampleId = selectedIds[0];
      if (!sampleId) return next;
      ids.forEach(id => { next[id] = sampleId; });
      return next;
    });
    liveAnnounce(clear ? `Cleared row ${toRowLabel(toCoords(wellId).r)}` : `Filled row ${toRowLabel(toCoords(wellId).r)}`);
  }, [selectedIds]);

  const onWellKeyFillCol = React.useCallback((wellId: string, clear?: boolean) => {
    const { c } = toCoords(wellId);
    const ids = Array.from({ length: ROWS }, (_, r) => toWellId(r, c));
    setAssignments(prev => {
      const next = { ...prev };
      if (clear) {
        ids.forEach(id => { delete next[id]; });
        return next;
      }
      const sampleId = selectedIds[0];
      if (!sampleId) return next;
      ids.forEach(id => { next[id] = sampleId; });
      return next;
    });
    liveAnnounce(clear ? `Cleared column ${c + 1}` : `Filled column ${c + 1}`);
  }, [selectedIds]);

  // Focus movement for arrow keys
  const focusWell = (r: number, c: number) => {
    const rr = Math.max(0, Math.min(ROWS - 1, r));
    const cc = Math.max(0, Math.min(COLS - 1, c));
    const el = document.getElementById(`well-${rr + 1}-${cc + 1}`) as HTMLDivElement | null;
    el?.focus();
  };

  return (
    <>
      {/* Live region for screen readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{ position: "absolute", width: 1, height: 1, margin: -1, padding: 0, border: 0, clip: "rect(0 0 0 0)", overflow: "hidden", whiteSpace: "nowrap" }}
      >
        {liveMsg}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={rectIntersection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={onDragCancel}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            gap: 20,
            padding: 20,
            alignItems: "flex-start"
          }}
        >
          {/* Left: Samples panel */}
          <section style={{ display: "grid", gridTemplateRows: "auto auto 1fr", gap: 12, minWidth: 260 }}>
            <div style={{ fontWeight: 600, fontSize: 18 }}>Samples</div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={() => setSelectedIds(samples.slice(0, ROWS * COLS).map(s => s.id))}
                style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "#fff" }}
                title={`Select first ${ROWS * COLS} samples`}
              >
                Select {ROWS * COLS}
              </button>
              <button
                onClick={() => setSelectedIds([])}
                style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "#fff" }}
              >
                Clear selection
              </button>
            </div>

            <div
              ref={sampleListRef}
              style={{
                overflow: "auto",
                display: "grid",
                gap: 8,
                paddingRight: 4,
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: 10,
                background: "#fff",
                maxHeight: "70vh",
                minHeight: 200,
              }}
            >
              {samples.map(s => (
                <DraggableSample key={s.id} sample={s} selected={selectedIds.includes(s.id)} onToggleSelect={onToggleSelect} />
              ))}
            </div>
          </section>

          {/* Right: Plate + controls */}
          <section style={{ display: "grid", gridTemplateRows: "auto auto 1fr", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ fontWeight: 600, fontSize: 18 }}>96-well Plate</div>
              <div style={{ fontSize: 13, opacity: 0.8 }}>Unassigned wells: {unassignedCount}</div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{ fontSize: 14 }}>
                Start at:&nbsp;
                <select
                  value={startWell}
                  onChange={(e) => setStartWell(e.target.value)}
                  style={{ padding: "4px 6px", borderRadius: 6, border: "1px solid var(--border)" }}
                >
                  {wells.flat().map(id => <option key={id} value={id}>{id}</option>)}
                </select>
              </label>

              <button
                disabled={!allSelectedIs96}
                onClick={() => fillWithSelection("rows")}
                style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, background: allSelectedIs96 ? "#fff" : "#f3f3f3" }}
                title="Fill row by row (A1..A12, B1..B12, ...)"
              >
                Fill by Rows
              </button>
              <button
                disabled={!allSelectedIs96}
                onClick={() => fillWithSelection("cols")}
                style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, background: allSelectedIs96 ? "#fff" : "#f3f3f3" }}
                title="Fill column by column (A1..H1, A2..H2, ...)"
              >
                Fill by Columns
              </button>

              <button
                onClick={clearPlate}
                style={{ marginLeft: "auto", padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "#fff" }}
                title="Clear all assignments"
              >
                Clear plate
              </button>
            </div>

            {/* Plate grid */}
            <div role="grid" aria-label={`${ROWS * COLS}-well plate`} aria-rowcount={ROWS} aria-colcount={COLS}
                style={{ width: "fit-content", padding: 12, border: "1px solid var(--border)", borderRadius: 12, background: "#fff" }}>
              <div style={{ display: "inline-grid", gridTemplateColumns: `auto repeat(${COLS}, 34px)`, gap: 8 }}>
                {/* Column headers */}
                <div />
                {Array.from({ length: COLS }, (_, c) => (
                  <div key={c} style={{ textAlign: "center", fontSize: 12 }}>{c + 1}</div>
                ))}

                {/* Rows */}
                {wells.map((row, r) => (
                  <React.Fragment key={r}>
                    <div style={{ alignSelf: "center", fontSize: 12, width: 18, textAlign: "right" }}>{toRowLabel(r)}</div>
                    {row.map((id, c) => (
                      <Well
                        key={id}
                        wellId={id}
                        assigned={assignments[id]}
                        rowIndex={r + 1}
                        colIndex={c + 1}
                        onClear={clearWell}
                        onWellKeyPlace={onWellKeyPlace}
                        onWellKeyFillRow={onWellKeyFillRow}
                        onWellKeyFillCol={onWellKeyFillCol}
                        onFocusMove={focusWell}
                      />
                    ))}
                  </React.Fragment>
                ))}
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
                • Drag a sample tab onto a well to assign. Double-click a well to clear.<br />
                • Multi-select with Ctrl/Cmd-click, range-select with Shift-click.<br />
                • Select exactly {ROWS * COLS} samples to enable Fill by Rows/Columns (starts at chosen well).<br />
                • Keyboard: focus a well, <b>Enter/Space</b> place first selected sample; <b>Del/Backspace</b> clear.<br />
                • Keyboard batch: <b>R</b> fill row, <b>C</b> fill column; hold <b>Shift</b> to clear row/column.<br />
                • Use arrow keys to move between wells.
              </div>
            </div>
          </section>
        </div>
        <DragOverlay dropAnimation={null}>
          <SampleOverlay sample={overlaySample} />
        </DragOverlay>
      </DndContext>
    </>
  );
}
