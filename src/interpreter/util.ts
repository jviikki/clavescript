const redistributeGroups: (
  leftGroups: Array<Array<boolean>>,
  rightGroups: Array<Array<boolean>>
) => [Array<Array<boolean>>, Array<Array<boolean>>] = (
  leftGroups,
  rightGroups
) => {
  const newLeftGroups = [];
  const numberOfMoves = Math.min(leftGroups.length, rightGroups.length);
  for (let i = 0; i < numberOfMoves; i++)
    newLeftGroups.push([...leftGroups[i], ...rightGroups[i]]);
  const newRightGroups = [
    ...leftGroups.slice(numberOfMoves),
    ...rightGroups.slice(numberOfMoves),
  ];
  return [newLeftGroups, newRightGroups];
};

// Spread accented beats equally within a number of beats. This can be useful for creating "Euclidean rhythms".
// See "The Euclidean Algorithm Generates Traditional Musical Rhythms"
// http://cgm.cs.mcgill.ca/~godfried/publications/banff.pdf
export const spread: (
  accentedBeats: number,
  beats: number
) => Array<boolean> = (accentedBeats, beats) => {
  if (accentedBeats > beats)
    throw Error(
      'Number of accented beats cannot be greater than total number of beats'
    );
  let leftGroups = Array.from({length: accentedBeats}, () => [true]);
  let rightGroups = Array.from({length: beats - accentedBeats}, () => [false]);
  while (rightGroups.length > 1) {
    [leftGroups, rightGroups] = redistributeGroups(leftGroups, rightGroups);
  }
  return [...leftGroups, ...rightGroups].flat();
};
