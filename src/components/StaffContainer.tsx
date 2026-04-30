import { StaffDisplay } from "./StaffDisplay";
import type { GeneratedNote } from "../lib/noteGenerator";
import type { NoteResultState } from "../hooks/useSpeedNoteSession";

type StaffContainerProps = {
  notes: GeneratedNote[];
  activeNoteIndex: number;
  feedbackMessage: string;
  feedbackClass: "neutral" | "success" | "error";
  showGrandStaff?: boolean;
  noteResults?: NoteResultState[];
};

export function StaffContainer({
  notes,
  activeNoteIndex,
  feedbackMessage,
  feedbackClass,
  showGrandStaff = false,
  noteResults = []
}: StaffContainerProps) {
  return (
    <>
      <div className="note-focus">
        <StaffDisplay notes={notes} activeNoteIndex={activeNoteIndex} showGrandStaff={showGrandStaff} noteResults={noteResults} />
      </div>
      <p className={`feedback ${feedbackClass}`}>{feedbackMessage}</p>
    </>
  );
}
