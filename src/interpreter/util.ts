export const coroutine = (f: () => any) => {
  const o = f();
  o.next();
  return (arg: any) => o.next(arg);
};
