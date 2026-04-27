import { useEffect, useRef, useState } from "react";
import { Beam, Formatter, Renderer, Stave, StaveNote, Voice } from "vexflow";
import type { Clef, GeneratedNote } from "../lib/noteGenerator";

type StaffDisplayProps = {
  notes: GeneratedNote[];
  activeNoteIndex: number;
};

function renderClefLabel(clef: Clef) {
  return clef === "treble" ? "Treble Clef" : "Bass Clef";
}

export function StaffDisplay({ notes, activeNoteIndex }: StaffDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const firstNote = notes[0] ?? { clef: "treble" as Clef };
  const [availableWidth, setAvailableWidth] = useState(460);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      setAvailableWidth(entry.contentRect.width);
    });

    observer.observe(container);
    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || notes.length === 0) {
      return;
    }

    const idealWidth = 460 + Math.max(0, notes.length - 1) * 70;
    const minimumWidth = 300;
    const width = Math.max(minimumWidth, Math.min(idealWidth, Math.floor(availableWidth)));
    const height = 210;
    const container = containerRef.current;
    container.innerHTML = "";

    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(width, height);

    const context = renderer.getContext();
    context.setFont("Arial", 10);

    const stave = new Stave(20, 40, width - 40);
    stave.addClef(firstNote.clef);
    stave.setContext(context);
    stave.draw();

    const staveNotes = notes.map((note, index) => {
      const staveNote = new StaveNote({
        clef: note.clef,
        keys: [note.key],
        duration: note.duration
      });
      if (index === activeNoteIndex) {
        staveNote.setStyle({ fillStyle: "#2563eb", strokeStyle: "#2563eb" });
      }
      return staveNote;
    });

    const voice = new Voice({ numBeats: 4, beatValue: 4 });
    voice.setStrict(false);
    voice.addTickables(staveNotes);
    const beams = Beam.generateBeams(staveNotes);

    // If many notes are present, justify to available width to tighten spacing.
    new Formatter().joinVoices([voice]).format([voice], Math.max(140, width - 120));
    voice.draw(context, stave);
    beams.forEach((beam) => beam.setContext(context).draw());
  }, [activeNoteIndex, availableWidth, firstNote?.clef, notes]);

  return (
    <section className="staff-panel" aria-live="polite">
      <div className="staff-header">
        <h2>Identify these notes in order</h2>
        <p>
          {renderClefLabel(firstNote.clef)} - Note {Math.min(activeNoteIndex + 1, notes.length)} of {notes.length}
        </p>
      </div>
      <div ref={containerRef} className="staff-canvas" aria-label={`Notes on ${renderClefLabel(firstNote.clef)}`} />
    </section>
  );
}
