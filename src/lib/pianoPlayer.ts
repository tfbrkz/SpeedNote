import Soundfont from "soundfont-player";

let audioContext: AudioContext | null = null;
let instrumentPromise: Promise<Soundfont.Player> | null = null;

function getAudioContext() {
  if (!audioContext) {
    audioContext = new window.AudioContext();
  }
  return audioContext;
}

async function getInstrument() {
  const context = getAudioContext();
  if (context.state === "suspended") {
    await context.resume();
  }

  if (!instrumentPromise) {
    instrumentPromise = Soundfont.instrument(context, "acoustic_grand_piano", {
      soundfont: "MusyngKite",
      nameToUrl: (name: string, soundfont: string) =>
        `https://gleitz.github.io/midi-js-soundfonts/${soundfont}/${name}-mp3.js`
    });
  }

  return instrumentPromise;
}

export async function playPianoNote(noteLabel: string) {
  const instrument = await getInstrument();
  instrument.play(noteLabel, 0, { gain: 0.8 });
}
