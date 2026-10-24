const SYMBOLS: Record<string, string> = {
  alpha: "α", beta: "β", gamma: "γ", delta: "δ", epsilon: "ε", theta: "θ", lambda: "λ", mu: "μ", pi: "π", sigma: "σ", phi: "φ", omega: "ω",
  Delta: "Δ", Sigma: "Σ", Omega: "Ω", infty: "∞", sum: "∑", prod: "∏", int: "∫", sqrt: "√", pm: "±", times: "×", div: "÷", cdot: "·",
  le: "≤", ge: "≥", ne: "≠", neq: "≠", approx: "≈", to: "→", rightarrow: "→", leftarrow: "←", Rightarrow: "⇒", in: "∈", partial: "∂", nabla: "∇",
};
const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", n: "ⁿ", i: "ⁱ" };
const SUB: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", n: "ₙ", i: "ᵢ" };

function script(body: string, map: Record<string, string>, fallback: string): string {
  return body.split("").every((c) => map[c]) ? body.split("").map((c) => map[c]).join("") : `${fallback}(${body})`;
}

/** Tiny, dependency-free LaTeX subset → Unicode renderer (not a full TeX engine). */
export function renderTexLite(tex: string): string {
  let s = tex.slice(0, 500);
  for (let i = 0; i < 4; i += 1) s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)");
  s = s.replace(/\\([a-zA-Z]+)/g, (m, name: string) => SYMBOLS[name] ?? m);
  s = s.replace(/\^\{([^{}]*)\}|\^(\w)/g, (_m, a: string | undefined, b: string | undefined) => script(a ?? b ?? "", SUP, "^"));
  s = s.replace(/_\{([^{}]*)\}|_(\w)/g, (_m, a: string | undefined, b: string | undefined) => script(a ?? b ?? "", SUB, "_"));
  return s.replace(/[{}]/g, "");
}
