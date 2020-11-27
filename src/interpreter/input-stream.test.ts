import {createInputStream, EOF} from './input-stream';

describe('InputStream', () => {
  it('works', () => {
    const inputLines = ['abc\n', 'def\n', 'ghi'];
    const inputString = inputLines.join('');
    const is = createInputStream(inputString);
    expect(is.line()).toEqual(1);
    expect(is.col()).toEqual(1);
    for (let line = 0; line < inputLines.length; line++) {
      for (let col = 0; col < inputLines[line].length; col++) {
        const next = is.next();
        expect(next).toEqual(inputLines[line][col]);
        if (next === '\n') {
          expect(is.col()).toEqual(1);
          expect(is.line()).toEqual(line + 2);
        } else {
          expect(is.col()).toEqual(col + 2);
          expect(is.line()).toEqual(line + 1);
        }
      }
    }
    expect(is.next()).toEqual(EOF);
  });
});
