"use client";

import React, { useMemo, useState, useCallback } from "react";
import { DndContext, useDraggable, useDroppable, DragEndEvent, DragStartEvent, PointerSensor, MouseSensor, useSensor, useSensors, DragOverlay, closestCenter, pointerWithin, DragOverEvent } from "@dnd-kit/core";

const ROWS = 8;
const COLS = 12;
const toRowLabel = (i: number) => String.fromCharCode("A".charCodeAt(0) + i);
const toWellId = (r: number, c: number) => `${toRowLabel(r)}${c + 1}`;
const parseWellId = (wellId: string) => {
  const row = wellId.charCodeAt(0) - "A".charCodeAt(0);
  const col = parseInt(wellId.slice(1), 10) - 1;
  return { row, col };
};

type Sample = { id: string; name: string };
type Assignments = Record<string, string | undefined>;

function makeSamples(n = 120): Sample[] {
  return Array.from({ length: n }, (_, i) => ({ id: `S${i + 1}`, name: `Sample ${i + 1}` }));
}

function DraggableSample({ sample, selected, onToggleSelect, isHighlighted, onSampleHover, hasPlacement, isHovered }: { 
  sample: Sample; 
  selected: boolean; 
  onToggleSelect: (id: string, multi?: boolean, range?: boolean) => void;
  isHighlighted: boolean;
  onSampleHover: (sampleId: string | null) => void;
  hasPlacement: boolean;
  isHovered: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ 
    id: sample.id
  });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.6 : 1,
    cursor: "grab",
    padding: "8px 10px",
    border: isHovered ? "2px solid #ff9800" : (isHighlighted ? "2px solid #ff9800" : (hasPlacement ? "2px solid #4caf50" : "1px solid var(--border)")),
    borderRadius: 10,
    background: selected ? (hasPlacement ? "#ffeb3b" : "var(--accent)") : (isHovered ? "#fff3e0" : (isHighlighted ? "#fff3e0" : (hasPlacement ? "#e8f5e8" : "white"))),
    userSelect: "none",
    boxShadow: selected ? "0 0 0 2px #bcd6ff inset" : (isHovered ? "0 0 4px rgba(255, 152, 0, 0.3)" : (isHighlighted ? "0 0 4px rgba(255, 152, 0, 0.3)" : (hasPlacement ? "0 0 4px rgba(76, 175, 80, 0.3)" : undefined))),
    zIndex: isDragging ? 1000 : 1,
  };

  const handleClick: React.MouseEventHandler = (e) => {
    onToggleSelect(sample.id, e.metaKey || e.ctrlKey, e.shiftKey);
  };

  // Filter out drag events when modifier keys are pressed
  const customListeners = {
    ...listeners,
    onPointerDown: (e: React.PointerEvent) => {
      // If modifier key is pressed, don't start drag
      if (e.metaKey || e.ctrlKey) {
        return;
      }
      // Otherwise, call the original handler
      if (listeners?.onPointerDown) {
        listeners.onPointerDown(e);
      }
    }
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...customListeners} 
      {...attributes} 
      onClick={handleClick} 
      title={sample.name}
      onMouseEnter={() => onSampleHover(sample.id)}
      onMouseLeave={() => onSampleHover(null)}
      data-sample-id={sample.id}
    >
      {sample.name}
    </div>
  );
}

function Well({ wellId, assigned, onClear, samples, onWellHover, selectedSampleIds, isHighlighted, onWellClick, isHoveredSample, isWellHovered, isSelected, onWellMouseDown, onWellMouseEnter }: { 
  wellId: string; 
  assigned?: string; 
  onClear: (wellId: string) => void;
  samples: Sample[];
  onWellHover: (wellId: string | null) => void;
  selectedSampleIds: string[];
  isHighlighted: boolean;
  onWellClick: (wellId: string, sampleId: string | undefined, multi?: boolean) => void;
  isHoveredSample: boolean;
  isWellHovered: boolean;
  isSelected: boolean;
  onWellMouseDown: (wellId: string, e: React.MouseEvent) => void;
  onWellMouseEnter: (wellId: string) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: wellId });
  const assignedSample = assigned ? samples.find(s => s.id === assigned) : null;
  const tooltipText = assigned ? `${wellId}: ${assignedSample?.name || assigned}` : wellId;
  
  // Check if this well's sample is selected (for yellow highlighting)
  const wellSampleSelected = assigned && selectedSampleIds.includes(assigned);
  
  const style: React.CSSProperties = {
    width: 30, height: 30, borderRadius: "50%",
    display: "grid", placeItems: "center",
    background: assigned 
      ? (isHighlighted ? "#ffeb3b" : (wellSampleSelected ? "#ffeb3b" : ((isHoveredSample || isWellHovered) ? "#fff3e0" : "#4caf50")))
      : (isOver ? "#4f94ff" : (isHighlighted ? "#fff59d" : ((isHoveredSample || isWellHovered) ? "#fff3e0" : "var(--muted)"))),
    border: (isOver || isHighlighted) 
      ? "2px solid #f57f17" 
      : (wellSampleSelected ? "2px solid #f57f17" : ((isHoveredSample || isWellHovered) ? "2px solid #ff9800" : (assigned ? "1px solid #388e3c" : "1px solid #333"))),
    fontSize: 11, lineHeight: 1, userSelect: "none",
    boxShadow: (isOver || isHighlighted) 
      ? "0 0 12px rgba(245, 127, 23, 0.6)" 
      : (wellSampleSelected ? "0 0 12px rgba(245, 127, 23, 0.6)" : ((isHoveredSample || isWellHovered) ? "0 0 8px rgba(255, 152, 0, 0.4)" : (assigned ? "0 2px 4px rgba(76, 175, 80, 0.3)" : undefined))),
    transform: (isOver || isHighlighted || isHoveredSample || isWellHovered || wellSampleSelected) ? "scale(1.05)" : "scale(1)",
    transition: "all 0.15s ease-in-out"
  };
  
  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      title={tooltipText} 
      onClick={(e) => {
        console.log('Well clicked!', { wellId, metaKey: e.metaKey, ctrlKey: e.ctrlKey, assigned });
        onWellClick(wellId, assigned, e.metaKey || e.ctrlKey);
      }}
      onDoubleClick={() => onClear(wellId)}
      onMouseDown={(e) => onWellMouseDown(wellId, e)}
      onMouseEnter={() => {
        onWellHover(wellId);
        onWellMouseEnter(wellId);
      }}
      onMouseLeave={() => onWellHover(null)}
    >
      {assigned ? (
        <div style={{
          fontSize: 8,
          fontWeight: 600,
          color: (isHighlighted || isHoveredSample || isWellHovered || wellSampleSelected) ? '#333' : 'white',
          textAlign: 'center',
          lineHeight: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          width: '100%',
          textShadow: (isHighlighted || isHoveredSample || isWellHovered || wellSampleSelected) ? 'none' : '0 1px 1px rgba(0,0,0,0.5)'
        }}>
          {assignedSample?.name?.replace('Sample ', 'S') || assigned.replace('S', '')}
        </div>
      ) : ""}
    </div>
  );
}

export default function Page() {
  const sensors = useSensors(
    useSensor(MouseSensor, { 
      activationConstraint: { 
        distance: 5
      }
    })
  );
  const wells = useMemo(
    () => Array.from({ length: ROWS }, (_, r) => Array.from({ length: COLS }, (_, c) => toWellId(r, c))),
    []
  );

  const [samples] = useState<Sample[]>(() => makeSamples(120));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<Assignments>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [hoveredWell, setHoveredWell] = useState<string | null>(null);
  const [hoveredSample, setHoveredSample] = useState<string | null>(null);
  const [selectedWells, setSelectedWells] = useState<string[]>([]);
  const [isDragSelecting, setIsDragSelecting] = useState<boolean>(false);
  const [dragStartWell, setDragStartWell] = useState<string | null>(null);

  const onToggleSelect = useCallback((id: string, multi?: boolean, range?: boolean) => {
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
  };

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    setActiveId(id);
    if (!selectedIds.includes(id)) {
      const idx = samples.findIndex(s => s.id === id);
      setSelectedIds([id]);
      setLastSelectedIndex(idx);
    }
    // Prevent body scroll during drag
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
  };

  const onDragEnd = (e: DragEndEvent) => {
    const sampleId = String(e.active.id);
    const dropId = e.over?.id ? String(e.over.id) : null;
    setActiveId(null);
    
    // Restore body scroll after drag
    document.body.style.overflow = '';
    document.body.style.position = '';
    document.body.style.width = '';
    
    if (!dropId) return;
    
    // If multiple samples selected, fill from drop point using selected fill mode
    if (selectedIds.length > 1) {
      const selectedSamplesInOrder = samples.filter(s => selectedIds.includes(s.id));
      const fullOrder = fillMode === "rows" ? plateOrderRowMajor : plateOrderColMajor;
      const startIndex = fullOrder.indexOf(dropId);
      
      if (startIndex !== -1) {
        // Only use wells from the drop point onwards (no wraparound)
        const orderFromDrop = fullOrder.slice(startIndex);
        const next: Assignments = { ...assignments };
        
        let sampleIndex = 0;
        for (const wellId of orderFromDrop) {
          if (sampleIndex >= selectedSamplesInOrder.length) break;
          // Place samples in wells (replacing existing ones)
          next[wellId] = selectedSamplesInOrder[sampleIndex].id;
          sampleIndex++;
        }
        setAssignments(next);
      }
    } else {
      // Single sample - existing behavior
      setAssignments(prev => ({ ...prev, [dropId]: sampleId }));
    }
  };

  const plateOrderRowMajor = useMemo(() => {
    const ids: string[] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) ids.push(toWellId(r, c));
    return ids;
  }, []);
  const plateOrderColMajor = useMemo(() => {
    const ids: string[] = [];
    for (let c = 0; c < COLS; c++) for (let r = 0; r < ROWS; r++) ids.push(toWellId(r, c));
    return ids;
  }, []);

  const [startWell, setStartWell] = useState<string>("A1");
  const [fillMode, setFillMode] = useState<"rows" | "cols">("rows");

  const rotateOrderFromStart = (order: string[], start: string) => {
    const i = order.indexOf(start);
    if (i === -1) return order;
    return order.slice(i).concat(order.slice(0, i));
  };

  const fillWithSelection = (mode: "rows" | "cols") => {
    if (selectedIds.length !== ROWS * COLS) return;
    const selectedInDisplayOrder = samples.filter(s => selectedIds.includes(s.id)).map(s => s.id);
    const order = rotateOrderFromStart(mode === "rows" ? plateOrderRowMajor : plateOrderColMajor, startWell);
    const next: Assignments = { ...assignments };
    for (let i = 0; i < order.length; i++) next[order[i]] = selectedInDisplayOrder[i];
    setAssignments(next);
  };

  const clearPlate = () => setAssignments({});

  /** Well hover and highlight handlers */
  const handleWellHover = (wellId: string | null) => {
    setHoveredWell(wellId);
  };

  // Get which wells contain selected samples (for yellow highlighting)
  const getWellsForSelectedSamples = () => {
    const wellsToHighlight: string[] = [];
    Object.entries(assignments).forEach(([wellId, sampleId]) => {
      if (sampleId && selectedIds.includes(sampleId)) {
        wellsToHighlight.push(wellId);
      }
    });
    return wellsToHighlight;
  };

  // Get which wells contain hovered samples (for orange highlighting)
  const getWellsForHoveredSample = () => {
    const wellsToHighlight: string[] = [];
    if (hoveredSample) {
      Object.entries(assignments).forEach(([wellId, sampleId]) => {
        if (sampleId === hoveredSample) {
          wellsToHighlight.push(wellId);
        }
      });
    }
    return wellsToHighlight;
  };

  // Get sample ID that's in the hovered well
  const hoveredWellSampleId = hoveredWell ? assignments[hoveredWell] : null;

  const allSelectedIs96 = selectedIds.length === ROWS * COLS;
  const wellIdsFlat = useMemo(() => wells.flat(), [wells]);
  const unassignedCount = wellIdsFlat.filter(id => !assignments[id]).length;
  const wellsToHighlight = getWellsForSelectedSamples();
  const wellsToHighlightHovered = getWellsForHoveredSample();

  const handleSampleHover = (sampleId: string | null) => {
    setHoveredSample(sampleId);
  };

  const handleWellClick = (wellId: string, sampleId: string | undefined, multi?: boolean) => {
    // Handle well selection - ALL well selection happens here now
    setSelectedWells(prev => {
      if (multi) {
        // Multi-select: add/remove well from selection
        const set = new Set(prev);
        set.has(wellId) ? set.delete(wellId) : set.add(wellId);
        return Array.from(set);
      } else {
        // Single select: replace selection
        return [wellId];
      }
    });

    if (sampleId) {
      // Well already has a sample - select that sample
      const idx = samples.findIndex(s => s.id === sampleId);
      const wasAlreadySelected = selectedIds.includes(sampleId);
      
      if (multi) {
        // Multi-select mode: add/remove sample from current selection
        setSelectedIds(prev => {
          const set = new Set(prev);
          if (set.has(sampleId)) {
            set.delete(sampleId);
          } else {
            set.add(sampleId);
            setLastSelectedIndex(idx);
          }
          return Array.from(set);
        });
        
        // Only scroll if we're adding a new sample (not removing)
        if (!wasAlreadySelected) {
          const sampleElement = document.querySelector(`[data-sample-id="${sampleId}"]`);
          if (sampleElement) {
            sampleElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'nearest'
            });
          }
        }
      } else {
        // Single select mode: replace selection with this sample
        setSelectedIds([sampleId]);
        setLastSelectedIndex(idx);
        
        // Always scroll in single-select mode
        const sampleElement = document.querySelector(`[data-sample-id="${sampleId}"]`);
        if (sampleElement) {
          const container = sampleElement.closest('[style*="overflow: auto"]');
          if (container) {
            const containerRect = container.getBoundingClientRect();
            const elementRect = sampleElement.getBoundingClientRect();
            const sampleHeight = elementRect.height + 8; // including gap
            const buffer = sampleHeight * 2; // 2 samples buffer
            
            // Calculate desired scroll position with buffer
            const elementTop = elementRect.top - containerRect.top + container.scrollTop;
            const targetScrollTop = elementTop - buffer;
            
            container.scrollTo({
              top: Math.max(0, targetScrollTop),
              behavior: 'smooth'
            });
          } else {
            // Fallback to default scrollIntoView
            sampleElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'nearest'
            });
          }
        }
      }
    } else if (selectedIds.length === 1) {
      // Well is empty and we have exactly one selected sample - place it
      const selectedSampleId = selectedIds[0];
      setAssignments(prev => ({ ...prev, [wellId]: selectedSampleId }));
    }
  };

  // Get which samples have placements
  const samplesWithPlacements = useMemo(() => {
    const placedSampleIds = new Set(Object.values(assignments).filter(Boolean));
    return placedSampleIds;
  }, [assignments]);

  // Helper functions for well selection
  const clearSelectedWells = () => {
    selectedWells.forEach(wellId => {
      setAssignments(prev => {
        const clone = { ...prev };
        delete clone[wellId];
        return clone;
      });
    });
    setSelectedWells([]);
  };

  const handleWellMouseDown = (wellId: string, e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      const isMultiSelect = e.metaKey || e.ctrlKey;
      
      if (!isMultiSelect) {
        // Only start drag selection for non-multi-select
        setIsDragSelecting(true);
        setDragStartWell(wellId);
      }
    }
  };

  const handleWellMouseEnter = (wellId: string) => {
    if (isDragSelecting && dragStartWell) {
      // Calculate rectangle selection from dragStartWell to current well
      const startPos = parseWellId(dragStartWell);
      const currentPos = parseWellId(wellId);
      
      const minRow = Math.min(startPos.row, currentPos.row);
      const maxRow = Math.max(startPos.row, currentPos.row);
      const minCol = Math.min(startPos.col, currentPos.col);
      const maxCol = Math.max(startPos.col, currentPos.col);
      
      const selectedWellIds = [];
      for (let r = minRow; r <= maxRow; r++) {
        for (let c = minCol; c <= maxCol; c++) {
          selectedWellIds.push(toWellId(r, c));
        }
      }
      setSelectedWells(selectedWellIds);
    }
  };

  const handleMouseUp = () => {
    // Only perform automatic sample selection if we were actually drag-selecting
    // and we selected more than just the starting well (indicating a real drag operation)
    if (isDragSelecting && selectedWells.length > 1) {
      // Get samples from selected wells and select them
      const samplesInSelectedWells = selectedWells
        .map(wellId => assignments[wellId])
        .filter((sampleId): sampleId is string => Boolean(sampleId)); // Remove undefined values
      
      if (samplesInSelectedWells.length > 0) {
        // Select all samples found in the selected wells
        setSelectedIds(samplesInSelectedWells);
        
        // Find the topmost sample (first one in the sample list order) and scroll to it
        const firstSampleIndex = Math.min(
          ...samplesInSelectedWells.map(sampleId => samples.findIndex(s => s.id === sampleId))
        );
        
        if (firstSampleIndex !== -1) {
          setLastSelectedIndex(firstSampleIndex);
          
          // Scroll the topmost sample into view
          const topSampleId = samples[firstSampleIndex].id;
          const sampleElement = document.querySelector(`[data-sample-id="${topSampleId}"]`);
          if (sampleElement) {
            const container = sampleElement.closest('[style*="overflow: auto"]');
            if (container) {
              const containerRect = container.getBoundingClientRect();
              const elementRect = sampleElement.getBoundingClientRect();
              const sampleHeight = elementRect.height + 8; // including gap
              const buffer = sampleHeight * 2; // 2 samples buffer
              
              // Calculate desired scroll position with buffer
              const elementTop = elementRect.top - containerRect.top + container.scrollTop;
              const targetScrollTop = elementTop - buffer;
              
              container.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: 'smooth'
              });
            } else {
              // Fallback to default scrollIntoView
              sampleElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'nearest'
              });
            }
          }
        }
      }
    }
    
    setIsDragSelecting(false);
    setDragStartWell(null);
  };

  return (
    <>
      <style jsx global>{`
        html, body { 
          overflow: hidden !important;
          margin: 0 !important;
          padding: 0 !important;
          width: 100vw !important;
          max-width: 100vw !important;
          height: 100vh !important;
          max-height: 100vh !important;
        }
        * {
          transform: translateZ(0) !important;
          backface-visibility: hidden !important;
        }
      `}</style>
      
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} collisionDetection={pointerWithin}>
        <div 
          style={{ 
            display: "flex", 
            width: "100vw", 
            height: "100vh", 
            overflow: "hidden",
            position: "fixed",
            top: 0,
            left: 0
          }}
          onMouseUp={handleMouseUp}
        >
        
        <section style={{ 
          width: "280px", 
          minWidth: "280px", 
          display: "grid", 
          gridTemplateRows: "auto auto 1fr", 
          gap: 12, 
          padding: 20,
          paddingRight: 10,
          background: "#fff",
          borderRight: "1px solid var(--border)",
          position: "fixed",
          left: 0,
          top: 0,
          height: "100vh",
          zIndex: 1000
        }}>
          <div style={{ fontWeight: 600, fontSize: 18 }}>Samples</div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              onClick={() => {
                if (selectedIds.length === 1) {
                  // If exactly one sample is selected, start from that sample
                  const currentIndex = samples.findIndex(s => s.id === selectedIds[0]);
                  if (currentIndex !== -1) {
                    // Select 96 samples starting from current selection, no wraparound
                    const endIndex = Math.min(currentIndex + ROWS * COLS, samples.length);
                    const newSelection = samples.slice(currentIndex, endIndex).map(s => s.id);
                    setSelectedIds(newSelection);
                  }
                } else {
                  // Default behavior - select first 96 samples
                  setSelectedIds(samples.slice(0, ROWS * COLS).map(s => s.id));
                }
              }}
              style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "#fff" }}
              title={
                selectedIds.length === 1 
                  ? `Select ${ROWS * COLS} samples starting from current selection`
                  : `Select first ${ROWS * COLS} samples`
              }
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

          <div style={{ overflow: "auto", display: "grid", gap: 8, paddingRight: 4, border: "1px solid var(--border)", borderRadius: 10, padding: 10, background: "#fff" }}>
            {samples.map(s => (
              <DraggableSample 
                key={s.id} 
                sample={s} 
                selected={selectedIds.includes(s.id)} 
                onToggleSelect={onToggleSelect}
                isHighlighted={hoveredWellSampleId === s.id}
                onSampleHover={handleSampleHover}
                hasPlacement={samplesWithPlacements.has(s.id)}
                isHovered={hoveredSample === s.id}
              />
            ))}
          </div>
        </section>

        <section 
          style={{ 
            marginLeft: "300px",
            padding: 20,
            flex: 1,
            overflow: "auto",
            height: "100vh"
          }}
          onClick={(e) => {
            // Clear well selection if clicking outside the plate area
            if (e.target === e.currentTarget) {
              setSelectedWells([]);
            }
          }}
        >
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
              onClick={(e) => {
                setFillMode("rows");
                if (allSelectedIs96) {
                  fillWithSelection("rows");
                }
              }}
              style={{ 
                padding: "6px 10px", 
                border: fillMode === "rows" ? "2px solid #2563eb" : "1px solid var(--border)", 
                borderRadius: 8, 
                background: fillMode === "rows" ? "#e6f0ff" : (allSelectedIs96 ? "#fff" : "#f3f3f3"),
                opacity: allSelectedIs96 ? 1 : 0.8
              }}
              title={allSelectedIs96 ? "Fill row by row (A1..A12, B1..B12, ...)" : "Set drag mode to fill by rows"}
            >
              Fill by Rows
            </button>
            <button
              onClick={(e) => {
                setFillMode("cols");
                if (allSelectedIs96) {
                  fillWithSelection("cols");
                }
              }}
              style={{ 
                padding: "6px 10px", 
                border: fillMode === "cols" ? "2px solid #2563eb" : "1px solid var(--border)", 
                borderRadius: 8, 
                background: fillMode === "cols" ? "#e6f0ff" : (allSelectedIs96 ? "#fff" : "#f3f3f3"),
                opacity: allSelectedIs96 ? 1 : 0.8
              }}
              title={allSelectedIs96 ? "Fill column by column (A1..H1, A2..H2, ...)" : "Set drag mode to fill by columns"}
            >
              Fill by Columns
            </button>

            <button
              disabled={selectedWells.length === 0}
              onClick={clearSelectedWells}
              style={{ 
                padding: "6px 10px", 
                border: "1px solid var(--border)", 
                borderRadius: 8, 
                background: selectedWells.length > 0 ? "#fff" : "#f3f3f3",
                opacity: selectedWells.length > 0 ? 1 : 0.6
              }}
              title={`Clear ${selectedWells.length} selected well${selectedWells.length !== 1 ? 's' : ''}`}
            >
              Clear selected ({selectedWells.length})
            </button>
            
            <button
              onClick={clearPlate}
              style={{ padding: "6px 10px", border: "1px solid var(--border)", borderRadius: 8, background: "#fff" }}
              title="Clear all assignments"
            >
              Clear Plate
            </button>
          </div>

          <div style={{ width: "fit-content", padding: 12, border: "1px solid var(--border)", borderRadius: 12, background: "#fff" }}>
            <div style={{ display: "inline-grid", gridTemplateColumns: `auto repeat(${COLS}, 34px)`, gap: 8 }}>
              <div />
              {Array.from({ length: COLS }, (_, c) => (
                <div key={c} style={{ textAlign: "center", fontSize: 12 }}>{c + 1}</div>
              ))}

              {wells.map((row, r) => (
                <React.Fragment key={r}>
                  <div style={{ alignSelf: "center", fontSize: 12, width: 18, textAlign: "right" }}>{toRowLabel(r)}</div>
                  {row.map((id) => (
                    <div 
                      key={id}
                      style={{
                        width: 34,
                        height: 34,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: selectedWells.includes(id) ? "#e3f2fd" : "transparent",
                        border: selectedWells.includes(id) ? "2px solid #2196f3" : "2px solid transparent",
                        borderRadius: 4
                      }}
                    >
                      <Well 
                        wellId={id} 
                        assigned={assignments[id]} 
                        onClear={clearWell}
                        samples={samples}
                        onWellHover={handleWellHover}
                        selectedSampleIds={selectedIds}
                        isHighlighted={wellsToHighlight.includes(id)}
                        onWellClick={handleWellClick}
                        isHoveredSample={wellsToHighlightHovered.includes(id)}
                        isWellHovered={hoveredWell === id}
                        isSelected={selectedWells.includes(id)}
                        onWellMouseDown={handleWellMouseDown}
                        onWellMouseEnter={handleWellMouseEnter}
                      />
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              • Drag samples onto wells to assign. Double-click wells to clear.<br />
              • Click wells to select samples. Ctrl/Cmd-click for multi-select, drag between wells for rectangle selection.<br />
              • Select exactly {ROWS * COLS} samples to enable Fill by Rows/Columns buttons.
            </div>
          </div>
        </section>
        </div>
        
        <DragOverlay>
        {activeId ? (
          <div style={{
            padding: "8px 10px",
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--accent)",
            userSelect: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            cursor: "grabbing",
            pointerEvents: "none",
            zIndex: 9999
          }}>
            {samples.find(s => s.id === activeId)?.name}
          </div>
        ) : null}
      </DragOverlay>
      </DndContext>
    </>
  );
}