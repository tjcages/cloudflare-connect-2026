export const rnd = (a: number, b: number) => a + Math.random() * (b - a);

export const between = (min: number, max: number) =>
  min + Math.floor(Math.random() * (max - min + 1));

export const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
