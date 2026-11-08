// Mapa de relevo das frentes de atuação.
// Cada frente é uma montanha (gaussiana) num campo de altura; as curvas de nível
// saem de um marching squares sobre esse campo. A ponte entre duas frentes fica
// no vale (sela) entre as duas montanhas.

const NS = "http://www.w3.org/2000/svg";

// Posições pensadas para 4 frentes; [x, y, altura, espalhamento, direção das trilhas em graus]
const LAYOUTS = {
  wide: {
    w: 1100, h: 500,
    peaks: [[250, 235, 1.0, 112, 200], [505, 300, 1.06, 108, 40], [790, 205, 1.14, 122, 330], [985, 375, 0.84, 84, 150]],
  },
  tall: {
    w: 420, h: 820,
    peaks: [[125, 150, 1.0, 74, 150], [295, 305, 1.06, 72, 20], [130, 520, 1.14, 80, 160], [300, 705, 0.84, 58, 250]],
  },
};

// Ruído suave e determinístico para o relevo não parecer perfeito demais.
const noise = (x, y) =>
  0.022 * Math.sin(x * 0.021 + 1.3) * Math.cos(y * 0.017 - 0.4) +
  0.016 * Math.sin((x + y) * 0.013 + 2.1) +
  0.012 * Math.cos(x * 0.034 - y * 0.027);

function field(peaks) {
  const parts = (x, y) => peaks.map(([px, py, ph, ps]) => ph * Math.exp(-((x - px) ** 2 + (y - py) ** 2) / (2 * ps * ps)));
  return { parts, height: (x, y) => parts(x, y).reduce((a, b) => a + b, 0) + noise(x, y) };
}

// Marching squares: devolve segmentos [x1, y1, x2, y2] para o nível `lv`.
function isoSegments(grid, cols, rows, step, lv) {
  const segs = [];
  const lerp = (a, b, va, vb) => a + ((lv - va) / (vb - va)) * (b - a);
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const tl = grid[j * cols + i], tr = grid[j * cols + i + 1];
      const br = grid[(j + 1) * cols + i + 1], bl = grid[(j + 1) * cols + i];
      const c = (tl > lv) * 8 + (tr > lv) * 4 + (br > lv) * 2 + (bl > lv) * 1;
      if (c === 0 || c === 15) continue;
      const x = i * step, y = j * step;
      const T = [lerp(x, x + step, tl, tr), y];
      const R = [x + step, lerp(y, y + step, tr, br)];
      const B = [lerp(x, x + step, bl, br), y + step];
      const L = [x, lerp(y, y + step, tl, bl)];
      const add = (p, q) => segs.push([p[0], p[1], q[0], q[1]]);
      switch (c) {
        case 1: case 14: add(L, B); break;
        case 2: case 13: add(B, R); break;
        case 3: case 12: add(L, R); break;
        case 4: case 11: add(T, R); break;
        case 5: add(L, T); add(B, R); break;
        case 6: case 9: add(T, B); break;
        case 7: case 8: add(L, T); break;
        case 10: add(T, R); add(L, B); break;
      }
    }
  }
  return segs;
}

const el = (tag, attrs = {}, text) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (text != null) n.textContent = text;
  return n;
};

export function renderTerrain(svg, tree, onPick) {
  const narrow = svg.getBoundingClientRect().width < 620;
  const L = narrow ? LAYOUTS.tall : LAYOUTS.wide;
  const peaks = tree.branches.map((_, i) => L.peaks[i] || [((i + 0.5) / tree.branches.length) * L.w, L.h / 2, 1, 90, 270]);
  const { parts, height } = field(peaks);

  svg.setAttribute("viewBox", `0 0 ${L.w} ${L.h}`);
  svg.replaceChildren();

  // campo de altura em grade
  const step = 7;
  const cols = Math.ceil(L.w / step) + 1, rows = Math.ceil(L.h / step) + 1;
  const grid = new Float32Array(cols * rows);
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) grid[j * cols + i] = height(i * step, j * step);

  // curvas: cada segmento ganha a cor da montanha dominante naquele ponto
  const lines = el("g", { class: "terrain-lines" });
  const levels = [];
  for (let lv = 0.09; lv < 1.2; lv += 0.07) levels.push(lv);
  levels.forEach((lv, li) => {
    const buckets = new Map();
    for (const [x1, y1, x2, y2] of isoSegments(grid, cols, rows, step, lv)) {
      const p = parts((x1 + x2) / 2, (y1 + y2) / 2);
      const top = p.indexOf(Math.max(...p));
      const key = lv < 0.2 ? "base" : top;
      const d = `M${x1.toFixed(1)} ${y1.toFixed(1)}L${x2.toFixed(1)} ${y2.toFixed(1)}`;
      buckets.set(key, (buckets.get(key) || "") + d);
    }
    for (const [key, d] of buckets) {
      const color = key === "base" ? "var(--muted)" : `var(--${tree.branches[key].color})`;
      const index = li % 4 === 3; // curva mestra mais grossa, como nos mapas
      lines.append(
        el("path", {
          d,
          style: `stroke:${color};opacity:${(key === "base" ? 0.28 : 0.3 + 0.55 * (li / levels.length)).toFixed(2)};stroke-width:${index ? 1.7 : 1}`,
        })
      );
    }
  });
  svg.append(lines);

  // trilhas (pontos de cada frente) e a ponte no vale
  const marks = el("g", { class: "terrain-marks" });
  const waypoint = (x, y, color, leaf, id, anchorRight) => {
    const g = el("g", { class: `wp${leaf.now ? " is-now" : ""}`, tabindex: "0", role: "button", "data-leaf": id, "aria-label": leaf.title, style: `--wc:${color}` });
    if (narrow) {
      // celular: marco numerado (o número se repete no card), sem rótulo que estoure a borda
      if (leaf.now) g.append(el("circle", { cx: x, cy: y, r: 14, class: "wp-pulse" }));
      g.append(el("circle", { cx: x, cy: y, r: 12, class: "wp-dot wp-dot-n" }));
      g.append(el("text", { x, y: y + 5, class: "wp-n", "text-anchor": "middle" }, String(tree.nums?.[id] ?? "")));
    } else {
      if (leaf.now) g.append(el("circle", { cx: x, cy: y, r: 9, class: "wp-pulse" }));
      g.append(el("circle", { cx: x, cy: y, r: 5.5, class: "wp-dot" }));
      g.append(el("text", { x: x + (anchorRight ? 11 : -11), y: y + 4, class: "wp-label", "text-anchor": anchorRight ? "start" : "end" }, leaf.title));
    }
    g.addEventListener("click", () => onPick(id));
    g.addEventListener("keydown", (e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onPick(id)));
    marks.append(g);
  };

  tree.branches.forEach((b, bi) => {
    const [px, py, , ps, dir] = peaks[bi];
    const n = b.leaves.length;
    b.leaves.forEach((leaf, k) => {
      const a = ((dir + (k - (n - 1) / 2) * 48) * Math.PI) / 180;
      const r = ps * (n === 1 ? 0.95 : 0.62 + 0.12 * k);
      const x = px + Math.cos(a) * r, y = py + Math.sin(a) * r;
      waypoint(x, y, `var(--${b.color})`, leaf, `${bi}-${k}`, Math.cos(a) >= -0.15);
    });
  });
  (tree.bridges || []).forEach((br, k) => {
    const [a, c] = br.between.map((i) => peaks[i]);
    const x = (a[0] + c[0]) / 2, y = (a[1] + c[1]) / 2 + (narrow ? 0 : 34);
    waypoint(x, y, "var(--text)", br.leaf, `b-${k}`, narrow);
  });

  // cumes: triângulo + nome da frente
  tree.branches.forEach((b, bi) => {
    const [px, py] = peaks[bi];
    const g = el("g", { class: "peak", style: `--wc:var(--${b.color})` });
    g.append(el("path", { d: `M${px} ${py - 9}l7.5 12.5h-15z`, class: "peak-mark" }));
    g.append(el("text", { x: px, y: py - 18, class: "peak-name", "text-anchor": "middle" }, b.name));
    g.append(el("text", { x: px, y: py + 22, class: "peak-sub", "text-anchor": "middle" }, b.sub));
    marks.append(g);
  });
  svg.append(marks);
}
