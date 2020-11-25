export type AbsPitch = number; // Midi Pitch 0 - 127
export type Frequency = number; // hz

export const absPitchToFrequency: (
  absPitch: AbsPitch
) => Frequency = absPitch => 440 * Math.pow(2, (absPitch - 69) / 12);
