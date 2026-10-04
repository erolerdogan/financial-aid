export const getNiceScale = (peak: number): { max: number; sections: number } => {
  const target = Math.max(peak * 1.05, 10);
  const bases = [1, 2, 2.5, 5];
  const startExponent = Math.floor(Math.log10(target / 6));

  for (let exponent = startExponent; exponent <= startExponent + 2; exponent++) {
    for (const base of bases) {
      const step = base * Math.pow(10, exponent);
      const sections = Math.ceil(target / step);
      if (sections >= 2 && sections <= 6) {
        return { max: step * sections, sections };
      }
    }
  }

  return { max: target, sections: 4 };
};
