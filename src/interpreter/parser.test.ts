import {createTokenizer} from './tokenizer';
import {createInputStream} from './input-stream';
import {parse, Program} from './parser';

describe('parser', () => {
  it('parses a program successfully', () => {
    const input =
      '# here are some comments\n' +
      '\n' +
      'tempo 100; # set the tempo here\n' +
      '\n' +
      'pattern =\n' +
      '  step { x -  | x = 88 }        :=:\n' +
      '  step { x - x - - x | x = 44 } :=:\n' +
      '  step { x - - - | x = 25 }     :+:\n' +
      '\n' +
      '  step { x - x y | x = 88, y = 39 }     :=:\n' +
      '  step { x - x - | x = 44 }     :=:\n' +
      '  step { x - - - | x = 25 }     :+:\n' +
      '\n' +
      '(  step { x - x - | x = 88 }    :=:\n' +
      '   step { x - x | x = 44 }      :=:\n' +
      '   step { x - - 60 | x = 25 }  );\n' +
      '\n' +
      '# Some more comments\n' +
      'pattern2 = seq {\n' +
      '  play 40;' +
      '  sleep 2;\n' +
      '  play 41; \n' +
      '};\n' +
      '\n' +
      'loop pattern; # start looping the pattern';

    const expectedOutput: Program = {
      type: 'program',
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
          type: 'binary_operator',
          operator: '=',
          left: {
            type: 'identifier',
            name: 'pattern',
          },
          right: {
            type: 'binary_operator',
            operator: ':+:',
            left: {
              type: 'binary_operator',
              operator: ':+:',
              left: {
                type: 'binary_operator',
                operator: ':=:',
                left: {
                  type: 'binary_operator',
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
                type: 'binary_operator',
                operator: ':=:',
                left: {
                  type: 'binary_operator',
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
              type: 'binary_operator',
              operator: ':=:',
              left: {
                type: 'binary_operator',
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
          type: 'binary_operator',
          operator: '=',
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

  it('parses a program with function call and if statement', () => {
    const input =
      'tempo 100;\n' +
      '\n' +
      'x = 30;\n' +
      '\n' +
      'seqfoo = seq {\n' +
      '  (fun (x, y) {\n' +
      '    play x; sleep y;\n' +
      '  })(x = x + 3, 0.2);\n' +
      '  if (x >= 78) {\n' +
      '      x = 30;\n' +
      '  } else if (1 == 2) x = 44;\n' +
      '  else {\n' +
      '    # x = 35;\n' +
      '    play 3 * (15 - 5);\n' +
      '    sleep 0.2;\n' +
      '  }\n' +
      '};\n' +
      '\n' +
      'loop seqfoo;';

    const expectedOutput: Program = {
      type: 'program',
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
          type: 'binary_operator',
          operator: '=',
          left: {
            type: 'identifier',
            name: 'x',
          },
          right: {
            type: 'integer',
            value: 30,
          },
        },
        {
          type: 'binary_operator',
          operator: '=',
          left: {
            type: 'identifier',
            name: 'seqfoo',
          },
          right: {
            type: 'musical_procedure',
            statements: [
              {
                type: 'call',
                func: {
                  type: 'fun',
                  params: ['x', 'y'],
                  body: [
                    {
                      type: 'cmd',
                      name: 'play',
                      arg: {
                        type: 'identifier',
                        name: 'x',
                      },
                    },
                    {
                      type: 'cmd',
                      name: 'sleep',
                      arg: {
                        type: 'identifier',
                        name: 'y',
                      },
                    },
                  ],
                },
                args: [
                  {
                    type: 'binary_operator',
                    operator: '=',
                    left: {
                      type: 'identifier',
                      name: 'x',
                    },
                    right: {
                      type: 'binary_operator',
                      operator: '+',
                      left: {
                        type: 'identifier',
                        name: 'x',
                      },
                      right: {
                        type: 'integer',
                        value: 3,
                      },
                    },
                  },
                  {
                    type: 'float',
                    value: 0.2,
                  },
                ],
              },
              {
                type: 'if',
                condition: {
                  type: 'binary_operator',
                  operator: '>=',
                  left: {
                    type: 'identifier',
                    name: 'x',
                  },
                  right: {
                    type: 'integer',
                    value: 78,
                  },
                },
                body: {
                  type: 'block',
                  statements: [
                    {
                      type: 'binary_operator',
                      operator: '=',
                      left: {
                        type: 'identifier',
                        name: 'x',
                      },
                      right: {
                        type: 'integer',
                        value: 30,
                      },
                    },
                  ],
                },
                else: {
                  type: 'if',
                  condition: {
                    type: 'binary_operator',
                    operator: '==',
                    left: {
                      type: 'integer',
                      value: 1,
                    },
                    right: {
                      type: 'integer',
                      value: 2,
                    },
                  },
                  body: {
                    type: 'binary_operator',
                    operator: '=',
                    left: {
                      type: 'identifier',
                      name: 'x',
                    },
                    right: {
                      type: 'integer',
                      value: 44,
                    },
                  },
                  else: {
                    type: 'block',
                    statements: [
                      {
                        type: 'cmd',
                        name: 'play',
                        arg: {
                          type: 'binary_operator',
                          operator: '*',
                          left: {
                            type: 'integer',
                            value: 3,
                          },
                          right: {
                            type: 'binary_operator',
                            operator: '-',
                            left: {
                              type: 'integer',
                              value: 15,
                            },
                            right: {
                              type: 'integer',
                              value: 5,
                            },
                          },
                        },
                      },
                      {
                        type: 'cmd',
                        name: 'sleep',
                        arg: {
                          type: 'float',
                          value: 0.2,
                        },
                      },
                    ],
                  },
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
            name: 'seqfoo',
          },
        },
      ],
    };

    const output = parse(createTokenizer(createInputStream(input)));

    expect(output).toEqual(expectedOutput);
  });

  it('Parse while loop properly', () => {
    const input =
      'x = 30;\n' +
      'seqfoo = seq { \n' +
      '  while (x < 85) {\n' +
      '    play x;\n' +
      '    sleep 0.2;\n' +
      '    x = x + 3;\n' +
      '  }\n' +
      '  x = 30;\n' +
      '};\n' +
      'loop seqfoo;';

    const expectedOutput: Program = {
      type: 'program',
      statements: [
        {
          type: 'binary_operator',
          operator: '=',
          left: {
            type: 'identifier',
            name: 'x',
          },
          right: {
            type: 'integer',
            value: 30,
          },
        },
        {
          type: 'binary_operator',
          operator: '=',
          left: {
            type: 'identifier',
            name: 'seqfoo',
          },
          right: {
            type: 'musical_procedure',
            statements: [
              {
                type: 'while',
                condition: {
                  type: 'binary_operator',
                  operator: '<',
                  left: {
                    type: 'identifier',
                    name: 'x',
                  },
                  right: {
                    type: 'integer',
                    value: 85,
                  },
                },
                body: {
                  type: 'block',
                  statements: [
                    {
                      type: 'cmd',
                      name: 'play',
                      arg: {
                        type: 'identifier',
                        name: 'x',
                      },
                    },
                    {
                      type: 'cmd',
                      name: 'sleep',
                      arg: {
                        type: 'float',
                        value: 0.2,
                      },
                    },
                    {
                      type: 'binary_operator',
                      operator: '=',
                      left: {
                        type: 'identifier',
                        name: 'x',
                      },
                      right: {
                        type: 'binary_operator',
                        operator: '+',
                        left: {
                          type: 'identifier',
                          name: 'x',
                        },
                        right: {
                          type: 'integer',
                          value: 3,
                        },
                      },
                    },
                  ],
                },
              },
              {
                type: 'binary_operator',
                operator: '=',
                left: {
                  type: 'identifier',
                  name: 'x',
                },
                right: {
                  type: 'integer',
                  value: 30,
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
            name: 'seqfoo',
          },
        },
      ],
    };

    const output = parse(createTokenizer(createInputStream(input)));

    expect(output).toEqual(expectedOutput);
  });

  it('Parse for loop', () => {
    const input =
      'tempo 100;\n' +
      '\n' +
      'seqfoo = seq {\n' +
      '  for (x = 30; x < 85; x = x + 3) {\n' +
      '    play x;\n' +
      '    sleep 0.2;\n' +
      '  }\n' +
      '};\n' +
      '\n' +
      'loop seqfoo;';

    const expectedOutput: Program = {
      type: 'program',
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
          type: 'binary_operator',
          operator: '=',
          left: {
            type: 'identifier',
            name: 'seqfoo',
          },
          right: {
            type: 'musical_procedure',
            statements: [
              {
                type: 'block',
                statements: [
                  {
                    type: 'binary_operator',
                    operator: '=',
                    left: {
                      type: 'identifier',
                      name: 'x',
                    },
                    right: {
                      type: 'integer',
                      value: 30,
                    },
                  },
                  {
                    type: 'while',
                    condition: {
                      type: 'binary_operator',
                      operator: '<',
                      left: {
                        type: 'identifier',
                        name: 'x',
                      },
                      right: {
                        type: 'integer',
                        value: 85,
                      },
                    },
                    body: {
                      type: 'block',
                      statements: [
                        {
                          type: 'cmd',
                          name: 'play',
                          arg: {
                            type: 'identifier',
                            name: 'x',
                          },
                        },
                        {
                          type: 'cmd',
                          name: 'sleep',
                          arg: {
                            type: 'float',
                            value: 0.2,
                          },
                        },
                        {
                          type: 'binary_operator',
                          operator: '=',
                          left: {
                            type: 'identifier',
                            name: 'x',
                          },
                          right: {
                            type: 'binary_operator',
                            operator: '+',
                            left: {
                              type: 'identifier',
                              name: 'x',
                            },
                            right: {
                              type: 'integer',
                              value: 3,
                            },
                          },
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        },
        {
          type: 'cmd',
          name: 'loop',
          arg: {
            type: 'identifier',
            name: 'seqfoo',
          },
        },
      ],
    };

    const output = parse(createTokenizer(createInputStream(input)));

    expect(output).toEqual(expectedOutput);
  });
});
