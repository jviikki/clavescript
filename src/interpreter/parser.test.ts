import {createTokenizer} from './tokenizer';
import {createInputStream} from './input-stream';
import {parse, Block} from './parser';

describe('parser', () => {
  it('parses a program successfully', () => {
    const input =
      '# here are some comments\n' +
      '\n' +
      'tempo 100; # set the tempo here\n' +
      '\n' +
      'pattern :=\n' +
      '  step { x -  | x := 88 }        :=:\n' +
      '  step { x - x - - x | x := 44 } :=:\n' +
      '  step { x - - - | x := 25 }     :+:\n' +
      '\n' +
      '  step { x - x y | x := 88, y := 39 }     :=:\n' +
      '  step { x - x - | x := 44 }     :=:\n' +
      '  step { x - - - | x := 25 }     :+:\n' +
      '\n' +
      '(  step { x - x - | x := 88 }    :=:\n' +
      '   step { x - x | x := 44 }      :=:\n' +
      '   step { x - - 60 | x := 25 }  );\n' +
      '\n' +
      '# Some more comments\n' +
      'pattern2 := seq {\n' +
      '  play 40;' +
      '  sleep 2;\n' +
      '  play 41; \n' +
      '};\n' +
      '\n' +
      'loop pattern; # start looping the pattern';

    const expectedOutput: Block = {
      type: 'block',
      statements: [
        {
          type: 'cmd',
          name: 'tempo',
          arg: {
            type: 'integer',
            value: 100,
          },
        },
        {
          type: 'assignment',
          left: {
            type: 'identifier',
            name: 'pattern',
          },
          right: {
            type: 'musical_binary',
            operator: ':+:',
            left: {
              type: 'musical_binary',
              operator: ':+:',
              left: {
                type: 'musical_binary',
                operator: ':=:',
                left: {
                  type: 'musical_binary',
                  operator: ':=:',
                  left: {
                    type: 'step_sequence',
                    pattern: [
                      {
                        type: 'identifier',
                        name: 'x',
                      },
                      {
                        type: 'step_rest',
                      },
                    ],
                    attributes: [
                      {
                        type: 'assignment',
                        left: {
                          type: 'identifier',
                          name: 'x',
                        },
                        right: {
                          type: 'integer',
                          value: 88,
                        },
                      },
                    ],
                  },
                  right: {
                    type: 'step_sequence',
                    pattern: [
                      {
                        type: 'identifier',
                        name: 'x',
                      },
                      {
                        type: 'step_rest',
                      },
                      {
                        type: 'identifier',
                        name: 'x',
                      },
                      {
                        type: 'step_rest',
                      },
                      {
                        type: 'step_rest',
                      },
                      {
                        type: 'identifier',
                        name: 'x',
                      },
                    ],
                    attributes: [
                      {
                        type: 'assignment',
                        left: {
                          type: 'identifier',
                          name: 'x',
                        },
                        right: {
                          type: 'integer',
                          value: 44,
                        },
                      },
                    ],
                  },
                },
                right: {
                  type: 'step_sequence',
                  pattern: [
                    {
                      type: 'identifier',
                      name: 'x',
                    },
                    {
                      type: 'step_rest',
                    },
                    {
                      type: 'step_rest',
                    },
                    {
                      type: 'step_rest',
                    },
                  ],
                  attributes: [
                    {
                      type: 'assignment',
                      left: {
                        type: 'identifier',
                        name: 'x',
                      },
                      right: {
                        type: 'integer',
                        value: 25,
                      },
                    },
                  ],
                },
              },
              right: {
                type: 'musical_binary',
                operator: ':=:',
                left: {
                  type: 'musical_binary',
                  operator: ':=:',
                  left: {
                    type: 'step_sequence',
                    pattern: [
                      {
                        type: 'identifier',
                        name: 'x',
                      },
                      {
                        type: 'step_rest',
                      },
                      {
                        type: 'identifier',
                        name: 'x',
                      },
                      {
                        type: 'identifier',
                        name: 'y',
                      },
                    ],
                    attributes: [
                      {
                        type: 'assignment',
                        left: {
                          type: 'identifier',
                          name: 'x',
                        },
                        right: {
                          type: 'integer',
                          value: 88,
                        },
                      },
                      {
                        type: 'assignment',
                        left: {
                          type: 'identifier',
                          name: 'y',
                        },
                        right: {
                          type: 'integer',
                          value: 39,
                        },
                      },
                    ],
                  },
                  right: {
                    type: 'step_sequence',
                    pattern: [
                      {
                        type: 'identifier',
                        name: 'x',
                      },
                      {
                        type: 'step_rest',
                      },
                      {
                        type: 'identifier',
                        name: 'x',
                      },
                      {
                        type: 'step_rest',
                      },
                    ],
                    attributes: [
                      {
                        type: 'assignment',
                        left: {
                          type: 'identifier',
                          name: 'x',
                        },
                        right: {
                          type: 'integer',
                          value: 44,
                        },
                      },
                    ],
                  },
                },
                right: {
                  type: 'step_sequence',
                  pattern: [
                    {
                      type: 'identifier',
                      name: 'x',
                    },
                    {
                      type: 'step_rest',
                    },
                    {
                      type: 'step_rest',
                    },
                    {
                      type: 'step_rest',
                    },
                  ],
                  attributes: [
                    {
                      type: 'assignment',
                      left: {
                        type: 'identifier',
                        name: 'x',
                      },
                      right: {
                        type: 'integer',
                        value: 25,
                      },
                    },
                  ],
                },
              },
            },
            right: {
              type: 'musical_binary',
              operator: ':=:',
              left: {
                type: 'musical_binary',
                operator: ':=:',
                left: {
                  type: 'step_sequence',
                  pattern: [
                    {
                      type: 'identifier',
                      name: 'x',
                    },
                    {
                      type: 'step_rest',
                    },
                    {
                      type: 'identifier',
                      name: 'x',
                    },
                    {
                      type: 'step_rest',
                    },
                  ],
                  attributes: [
                    {
                      type: 'assignment',
                      left: {
                        type: 'identifier',
                        name: 'x',
                      },
                      right: {
                        type: 'integer',
                        value: 88,
                      },
                    },
                  ],
                },
                right: {
                  type: 'step_sequence',
                  pattern: [
                    {
                      type: 'identifier',
                      name: 'x',
                    },
                    {
                      type: 'step_rest',
                    },
                    {
                      type: 'identifier',
                      name: 'x',
                    },
                  ],
                  attributes: [
                    {
                      type: 'assignment',
                      left: {
                        type: 'identifier',
                        name: 'x',
                      },
                      right: {
                        type: 'integer',
                        value: 44,
                      },
                    },
                  ],
                },
              },
              right: {
                type: 'step_sequence',
                pattern: [
                  {
                    type: 'identifier',
                    name: 'x',
                  },
                  {
                    type: 'step_rest',
                  },
                  {
                    type: 'step_rest',
                  },
                  {
                    type: 'integer',
                    value: 60,
                  },
                ],
                attributes: [
                  {
                    type: 'assignment',
                    left: {
                      type: 'identifier',
                      name: 'x',
                    },
                    right: {
                      type: 'integer',
                      value: 25,
                    },
                  },
                ],
              },
            },
          },
        },
        {
          type: 'assignment',
          left: {
            type: 'identifier',
            name: 'pattern2',
          },
          right: {
            type: 'musical_procedure',
            statements: [
              {
                type: 'cmd',
                name: 'play',
                arg: {
                  type: 'integer',
                  value: 40,
                },
              },
              {
                type: 'cmd',
                name: 'sleep',
                arg: {
                  type: 'integer',
                  value: 2,
                },
              },
              {
                type: 'cmd',
                name: 'play',
                arg: {
                  type: 'integer',
                  value: 41,
                },
              },
            ],
          },
        },
        {
          type: 'cmd',
          name: 'loop',
          arg: {
            type: 'identifier',
            name: 'pattern',
          },
        },
      ],
    };

    const output = parse(createTokenizer(createInputStream(input)));

    expect(output).toEqual(expectedOutput);
  });
});
