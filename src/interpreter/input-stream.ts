export const EOF: unique symbol = Symbol('eof');

export type InputStream = {
  next(): string | typeof EOF;
  peek(): string | typeof EOF;

  line(): number;
  col(): number;

  eof(): boolean;
};

export const createInputStream: (input: string) => InputStream = input => {
  let pos = 0,
    line = 1,
    col = 1;

  const next = () => {
    if (eof()) return EOF;

    const ch = input[pos++];
    if (ch === '\n') {
      line++;
      col = 1;
    } else {
      col++;
    }

    return ch;
  };

  const peek = () => (eof() ? EOF : input[pos]);

  const eof = () => pos === input.length;

  return {
    next: next,
    peek: peek,
    eof: eof,
    line: () => line,
    col: () => col,
  };
};
