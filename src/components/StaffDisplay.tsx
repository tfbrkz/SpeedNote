import { useEffect, useRef, useState } from "react";
import { Beam, Formatter, GhostNote, Renderer, Stave, StaveConnector, StaveNote, Voice } from "vexflow";
import type { Clef, GeneratedNote } from "../lib/noteGenerator";
import type { NoteResultState } from "../hooks/useSpeedNoteSession";

type StaffDisplayProps = {
  notes: GeneratedNote[];
  activeNoteIndex: number;
  showGrandStaff?: boolean;
  noteResults?: NoteResultState[];
};

const ACTIVE_NOTE_COLOR = "#8b5cf6";
const CORRECT_NOTE_COLOR = "#22c55e";
const WRONG_NOTE_COLOR = "#ef4444";

function renderClefLabel(clef: Clef) {
  return clef === "treble" ? "Treble Clef" : "Bass Clef";
}

export function StaffDisplay({ notes, activeNoteIndex, showGrandStaff = false, noteResults = [] }: StaffDisplayProps) {
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
    const width = Math.min(idealWidth, Math.max(120, Math.floor(availableWidth)));
    const hasBothClefs = showGrandStaff || (notes.some((note) => note.clef === "treble") && notes.some((note) => note.clef === "bass"));
    const height = hasBothClefs ? 280 : 210;
    const container = containerRef.current;
    container.innerHTML = "";

    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(width, height);

    const context = renderer.getContext();
    context.setFont("Arial", 10);

    if (!hasBothClefs) {
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
        const result = noteResults[index];
        if (result === "correct") {
          staveNote.setStyle({ fillStyle: CORRECT_NOTE_COLOR, strokeStyle: CORRECT_NOTE_COLOR });
        } else if (result === "wrong") {
          staveNote.setStyle({ fillStyle: WRONG_NOTE_COLOR, strokeStyle: WRONG_NOTE_COLOR });
        } else if (index === activeNoteIndex) {
          staveNote.setStyle({ fillStyle: ACTIVE_NOTE_COLOR, strokeStyle: ACTIVE_NOTE_COLOR });
        }
        return staveNote;
      });

      const voice = new Voice({ numBeats: 4, beatValue: 4 });
      voice.setStrict(false);
      voice.addTickables(staveNotes);
      const beams = Beam.generateBeams(staveNotes);

      new Formatter().joinVoices([voice]).format([voice], Math.max(140, width - 120));
      voice.draw(context, stave);
      beams.forEach((beam) => beam.setContext(context).draw());
      return;
    }

    const trebleStave = new Stave(20, 30, width - 40);
    const bassStave = new Stave(20, 130, width - 40);
    trebleStave.addClef("treble");
    bassStave.addClef("bass");
    trebleStave.setContext(context).draw();
    bassStave.setContext(context).draw();
    new StaveConnector(trebleStave, bassStave).setType(StaveConnector.type.BRACE).setContext(context).draw();
    new StaveConnector(trebleStave, bassStave).setType(StaveConnector.type.SINGLE_LEFT).setContext(context).draw();

    const trebleTickables = notes.map((note, index) => {
      if (note.clef === "treble") {
        const staveNote = new StaveNote({
          clef: "treble",
          keys: [note.key],
          duration: note.duration
        });
        const result = noteResults[index];
        if (result === "correct") {
          staveNote.setStyle({ fillStyle: CORRECT_NOTE_COLOR, strokeStyle: CORRECT_NOTE_COLOR });
        } else if (result === "wrong") {
          staveNote.setStyle({ fillStyle: WRONG_NOTE_COLOR, strokeStyle: WRONG_NOTE_COLOR });
        } else if (index === activeNoteIndex) {
          staveNote.setStyle({ fillStyle: ACTIVE_NOTE_COLOR, strokeStyle: ACTIVE_NOTE_COLOR });
        }
        return staveNote;
      }
      return new GhostNote({ duration: note.duration });
    });

    const bassTickables = notes.map((note, index) => {
      if (note.clef === "bass") {
        const staveNote = new StaveNote({
          clef: "bass",
          keys: [note.key],
          duration: note.duration
        });
        const result = noteResults[index];
        if (result === "correct") {
          staveNote.setStyle({ fillStyle: CORRECT_NOTE_COLOR, strokeStyle: CORRECT_NOTE_COLOR });
        } else if (result === "wrong") {
          staveNote.setStyle({ fillStyle: WRONG_NOTE_COLOR, strokeStyle: WRONG_NOTE_COLOR });
        } else if (index === activeNoteIndex) {
          staveNote.setStyle({ fillStyle: ACTIVE_NOTE_COLOR, strokeStyle: ACTIVE_NOTE_COLOR });
        }
        return staveNote;
      }
      return new GhostNote({ duration: note.duration });
    });

    const trebleVoice = new Voice({ numBeats: 4, beatValue: 4 });
    trebleVoice.setStrict(false);
    trebleVoice.addTickables(trebleTickables);

    const bassVoice = new Voice({ numBeats: 4, beatValue: 4 });
    bassVoice.setStrict(false);
    bassVoice.addTickables(bassTickables);

    new Formatter().joinVoices([trebleVoice, bassVoice]).format([trebleVoice, bassVoice], Math.max(140, width - 120));
    trebleVoice.draw(context, trebleStave);
    bassVoice.draw(context, bassStave);

    const trebleBeams = Beam.generateBeams(
      trebleTickables.filter((tickable) => tickable instanceof StaveNote)
    );
    const bassBeams = Beam.generateBeams(
      bassTickables.filter((tickable) => tickable instanceof StaveNote)
    );
    [...trebleBeams, ...bassBeams].forEach((beam) => beam.setContext(context).draw());
  }, [activeNoteIndex, availableWidth, firstNote?.clef, noteResults, notes, showGrandStaff]);

  return (
    <section className="staff-panel" aria-live="polite">
      <div className="staff-header">
        <h2>Read these notes in order</h2>
        <p>
          {(showGrandStaff || (notes.some((note) => note.clef === "treble") && notes.some((note) => note.clef === "bass")))
            ? "Treble + Bass"
            : renderClefLabel(firstNote.clef)}{" "}
          - Note {Math.min(activeNoteIndex + 1, notes.length)} of {notes.length}
        </p>
      </div>
      <div
        ref={containerRef}
        className="staff-canvas"
        aria-label={`Notes on ${
          showGrandStaff || (notes.some((note) => note.clef === "treble") && notes.some((note) => note.clef === "bass"))
            ? "Treble and Bass Clefs"
            : renderClefLabel(firstNote.clef)
        }`}
      />
    </section>
  );
}
