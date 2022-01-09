import {Environment, VariableValue} from './evaluator';

export const initializeBuiltInFunctions: (
  globalEnv: Environment
) => void = globalEnv => {
  globalEnv.set('len', {
    type: 'internal',
    name: 'len',
    value: (val: VariableValue) => {
      if (val.type !== 'array')
        throw Error("Built-in function 'len' can only be applied to arrays");
      return {type: 'number', value: val.items.length};
    },
  });

  globalEnv.set('rand', {
    type: 'internal',
    name: 'rand',
    value: () => {
      return {type: 'number', value: Math.random()};
    },
  });

  globalEnv.set('floor', {
    type: 'internal',
    name: 'floor',
    value: (val: VariableValue) => {
      if (val.type !== 'number')
        throw Error("Built in function 'floor' can be only applied to numbers");
      return {type: 'number', value: Math.floor(val.value)};
    },
  });

  globalEnv.set('ceil', {
    type: 'internal',
    name: 'ceil',
    value: (val: VariableValue) => {
      if (val.type !== 'number')
        throw Error("Built in function 'ceil' can be only applied to numbers");
      return {type: 'number', value: Math.ceil(val.value)};
    },
  });
};
