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

// Compact y-axis label for money: 1.5k, 20k, 1.2M.
export const formatAxisValue = (label: string): string => {
  const value = Number(label);
  if (!Number.isFinite(value)) return label;
  const abs = Math.abs(value);
  const trim = (n: number) => String(Number(n.toFixed(n < 10 ? 1 : 0)));
  if (abs >= 1e9) return `${trim(value / 1e9)}B`;
  if (abs >= 1e6) return `${trim(value / 1e6)}M`;
  if (abs >= 1e3) return `${trim(value / 1e3)}k`;
  return String(Math.round(value));
};
