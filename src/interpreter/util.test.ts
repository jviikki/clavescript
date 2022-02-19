import {spread} from './util';

describe('spread(accentedBeats, beats)', () => {
  type SpreadTest = [number, number, Array<boolean>];

  const spreadTests: SpreadTest[] = [
    [1, 2, [true, false]],
    [1, 3, [true, false, false]],
    [1, 4, [true, false, false, false]],
    [
      4,
      12,
      [
        true,
        false,
        false,
        true,
        false,
        false,
        true,
        false,
        false,
        true,
        false,
        false,
      ],
    ],
    [2, 3, [true, true, false]],
    [2, 5, [true, false, true, false, false]],
    [3, 4, [true, true, true, false]],
    [3, 5, [true, false, true, false, true]],
    [3, 7, [true, false, true, false, true, false, false]],
    [3, 8, [true, false, false, true, false, false, true, false]],
    [4, 7, [true, false, true, false, true, false, true]],
    [4, 9, [true, false, true, false, true, false, true, false, false]],
    [
      4,
      11,
      [true, false, false, true, false, false, true, false, false, true, false],
    ],
    [5, 6, [true, true, true, true, true, false]],
    [5, 7, [true, false, true, true, false, true, true]],
    [5, 8, [true, false, true, true, false, true, true, false]],
    [5, 9, [true, false, true, false, true, false, true, false, true]],
    [
      5,
      11,
      [true, false, true, false, true, false, true, false, true, false, false],
    ],
    [
      5,
      12,
      [
        true,
        false,
        false,
        true,
        false,
        true,
        false,
        false,
        true,
        false,
        true,
        false,
      ],
    ],
    [
      5,
      16,
      [
        true,
        false,
        false,
        true,
        false,
        false,
        true,
        false,
        false,
        true,
        false,
        false,
        true,
        false,
        false,
        false,
      ],
    ],
    [7, 8, [true, true, true, true, true, true, true, false]],
    [
      7,
      12,
      [
        true,
        false,
        true,
        true,
        false,
        true,
        false,
        true,
        true,
        false,
        true,
        false,
      ],
    ],
    [
      7,
      16,
      [
        true,
        false,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
      ],
    ],
    [
      9,
      16,
      [
        true,
        false,
        true,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        true,
        false,
        true,
        false,
        true,
        false,
      ],
    ],
    [
      11,
      24,
      [
        true,
        false,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
      ],
    ],
    [
      13,
      24,
      [
        true,
        false,
        true,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
        true,
        false,
      ],
    ],
  ];

  for (const test of spreadTests) {
    it(`spread(${test[0]}, ${test[1]})`, () => {
      expect(spread(test[0], test[1])).toEqual(test[2]);
    });
  }
});
