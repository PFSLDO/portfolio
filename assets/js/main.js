// Portfólio: renderiza tudo a partir de data/site.json, data/projects.json e data/github.json.
const $ = (s, el = document) => el.querySelector(s);
const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const fmt = (n) => n.toLocaleString("pt-BR");

// Tons terrosos, distintos entre si e legíveis nos dois temas.
const LANG_COLORS = {
  TypeScript: "#4f7393", JavaScript: "#c9a23a", Python: "#3f7a74", C: "#8a7f6c", "C++": "#b4603d",
  "Jupyter Notebook": "#d08a3c", HTML: "#c2704f", CSS: "#7d6fa6", Java: "#93703a",
  "Wolfram Language": "#a14a4a", Assembly: "#6f5d3e", Makefile: "#6f8550", "Linker Script": "#9c9886",
  "C#": "#5d8a52", PHP: "#6c74a8", Fortran: "#5e5394",
};
const color = (l) => LANG_COLORS[l] || "#7d8a6a";

const CATEGORIES = { all: "Todos", web: "Web", mobile: "Mobile", desktop: "Desktop", embedded: "Embarcados", backend: "Back-end", science: "Ciência", study: "Estudos" };

const getJSON = (p) => fetch(p, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
const [site, projects, gh] = await Promise.all([getJSON("data/site.json"), getJSON("data/projects.json"), getJSON("data/github.json")]);

/* ---------- Curvas de nível ----------
   Anéis irregulares concêntricos, como num mapa topográfico de trilha.
   Determinístico por semente, para o desenho não mudar a cada visita. */
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
function drawTopo(svg) {
  const rand = rng(Number(svg.dataset.topo) || 1);
  const waves = Array.from({ length: 4 }, (_, i) => ({ k: i + 2, a: 0.05 + rand() * 0.07, p: rand() * Math.PI * 2 }));
  const cx = 300 + (rand() - 0.5) * 40, cy = 300 + (rand() - 0.5) * 40;
  const paths = [];
  for (let level = 1; level <= 11; level++) {
    const r = 26 * level + rand() * 6;
    const pts = [];
    for (let i = 0; i < 72; i++) {
      const t = (i / 72) * Math.PI * 2;
      // a deformação cresce com o raio, como relevo real
      const d = waves.reduce((s, w) => s + w.a * (0.4 + level / 11) * Math.sin(w.k * t + w.p + level * 0.18), 0);
      pts.push([cx + Math.cos(t) * r * (1 + d), cy + Math.sin(t) * r * (1 + d)]);
    }
    // Catmull-Rom fechado -> Bézier cúbica (curva suave)
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[(i - 1 + pts.length) % pts.length], p1 = pts[i], p2 = pts[(i + 1) % pts.length], p3 = pts[(i + 2) % pts.length];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    paths.push(`<path d="${d}Z"${level % 4 === 0 ? ' style="stroke-width:1.8"' : ""}/>`);
  }
  svg.innerHTML = paths.join("");
}
document.querySelectorAll("svg[data-topo]").forEach(drawTopo);

/* ---------- Tema ---------- */
$("#theme-toggle").addEventListener("click", () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  try { localStorage.setItem("theme", root.dataset.theme); } catch {}
});
$("#year").textContent = new Date().getFullYear();

/* ---------- Hero, sobre, stack ---------- */
$("#hero-location").textContent = site.location;
$("#hero-name").textContent = site.name;
$("#hero-role").textContent = site.role;
$("#hero-headline").textContent = site.headline;

$("#about-text").innerHTML = site.about.map((p) => `<p>${esc(p)}</p>`).join("");
const projTitle = (slug) => {
  const p = projects.find((x) => x.slug === slug);
  return p ? p.short || p.title : slug;
};
const t = site.tree;
const leafHTML = (l) => `
  <h3>${esc(l.title)}${l.now ? '<span class="now" title="Em andamento">agora</span>' : ""}</h3>
  <p>${esc(l.text)}</p>
  ${l.projects?.length ? `<div class="leaf-projects">${l.projects.map((s) => `<button class="pchip" data-open="${s}">${esc(projTitle(s))}</button>`).join("")}</div>` : ""}`;
const bridges = t.bridges || [];
const bridged = new Set(bridges.flatMap((b) => b.between));
// numeração dos marcos na ordem em que os cards aparecem (galho, galho, ponte, galho...)
const seq = [
  ...t.branches.flatMap((b, i) => b.leaves.map((_, k) => [i * 2, `${i}-${k}`])),
  ...bridges.map((br, k) => [Math.max(...br.between) * 2 + 1, `b-${k}`]),
].sort((a, b) => a[0] - b[0]);
const nums = Object.fromEntries(seq.map(([, id], n) => [id, n + 1]));
t.nums = nums;
const valley = bridges[0] && bridges[0].between.map((i) => t.branches[i].name).join(" e ");
$("#tree").innerHTML = `
  <figure class="terrain">
    <figcaption class="terrain-head">
      <span><b>${esc(t.root)}</b><small>${esc(t.rootSub)}</small></span>
      <svg class="north" viewBox="0 0 40 52" aria-hidden="true"><path d="M20 4l9 30-9-6-9 6z"/><text x="20" y="50" text-anchor="middle">N</text></svg>
    </figcaption>
    <svg class="terrain-map" role="img" aria-label="Mapa de relevo: cada montanha é uma frente (${t.branches.map((b) => esc(b.name)).join(", ")})"></svg>
    <p class="terrain-legend small muted">
      <span><i class="lg-now"></i>em andamento</span>
      <span><i class="lg-peak"></i>cada montanha é uma frente</span>
      ${valley ? `<span><i class="lg-valley"></i>no vale entre ${esc(valley)}, as duas se encontram</span>` : ""}
      <span class="lg-hint">clique num ponto para ver a trilha</span>
    </p>
  </figure>
  <div class="fronts">${t.branches
    .map(
      (b, i) => `<section class="front${bridged.has(i) ? " bridged" : ""}" style="--bc:var(--${b.color});--o:${i * 2}">
        <header class="front-head"><i></i><b>${esc(b.name)}</b><small>${esc(b.sub)}</small></header>
        ${b.leaves.map((l, k) => `<article class="leaf" id="leaf-${i}-${k}" data-leaf="${i}-${k}" data-n="${nums[`${i}-${k}`]}">${leafHTML(l)}</article>`).join("")}
      </section>`
    )
    .join("")}${bridges
    .map((br, k) => {
      const [a, b] = br.between.map((i) => t.branches[i]);
      return `<section class="front front-bridge" style="--ba:var(--${a.color});--bb:var(--${b.color});--bc:var(--${a.color});--o:${Math.max(...br.between) * 2 + 1};grid-column:${Math.min(...br.between) + 1} / span 2">
        <article class="leaf bridge-leaf" id="leaf-b-${k}" data-leaf="b-${k}" data-n="${nums[`b-${k}`]}">
          <span class="bridge-tag"><i style="background:var(--ba)"></i>${esc(a.name)} <span aria-hidden="true">+</span> <i style="background:var(--bb)"></i>${esc(b.name)} <em>· no vale</em></span>
          ${leafHTML(br.leaf)}
        </article>
      </section>`;
    })
    .join("")}</div>`;

document.querySelectorAll(".leaf[data-n]").forEach((a) => (a.querySelector("h3").dataset.n = a.dataset.n));
// mapa de relevo (módulo separado; herda a versão do main.js para não pegar cache velho)
const { renderTerrain } = await import(`./topomap.js${new URL(import.meta.url).search}`);
const mapSvg = $(".terrain-map");
const pickLeaf = (id) => {
  const card = document.getElementById(`leaf-${id}`);
  if (!card) return;
  card.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
  card.classList.remove("flash");
  void card.offsetWidth;
  card.classList.add("flash");
};
let lastNarrow = null;
const drawMap = () => {
  const narrow = mapSvg.getBoundingClientRect().width < 620;
  if (narrow === lastNarrow) return;
  lastNarrow = narrow;
  renderTerrain(mapSvg, t, pickLeaf);
};
drawMap();
new ResizeObserver(drawMap).observe(mapSvg);
// passar o mouse num card acende o ponto correspondente no mapa
document.querySelectorAll(".fronts .leaf").forEach((card) => {
  const on = (v) => mapSvg.querySelector(`[data-leaf="${card.dataset.leaf}"]`)?.classList.toggle("lit", v);
  card.addEventListener("mouseenter", () => on(true));
  card.addEventListener("mouseleave", () => on(false));
});
$("#stack-grid").innerHTML = site.stack
  .map((g) => `<div class="panel"><h3>${esc(g.group)}</h3><div class="chips">${g.items.map((i) => `<span class="chip${(g.highlight || []).includes(i) ? " chip-strong" : ""}">${esc(i)}</span>`).join("")}</div></div>`)
  .join("");

/* ---------- Experiência ---------- */
$("#experience-list").innerHTML = (site.experience || [])
  .map(
    (e) => `<article class="job">
      <div class="job-head">
        <div><h3>${esc(e.company)}</h3><p class="muted small">${esc(e.about)}</p></div>
        <span class="job-period">${esc(e.period)}</span>
      </div>
      <p class="job-role">${esc(e.role)}</p>
      <p>${esc(e.text)}</p>
      <div class="chips">${e.stack.map((t) => `<span class="chip chip-strong">${esc(t)}</span>`).join("")}</div>
      ${e.project ? `<button class="linkbtn" data-open="${e.project}">Ver o projeto ${esc(projTitle(e.project))} →</button>` : ""}
    </article>`
  )
  .join("");

/* ---------- Bússola ---------- */
const compassSVG = () => {
  const cx = 150, cy = 150, pt = (r, deg) => [cx + r * Math.sin((deg * Math.PI) / 180), cy - r * Math.cos((deg * Math.PI) / 180)];
  const f = (p) => p.map((v) => v.toFixed(1)).join(" ");
  let ticks = "";
  for (let a = 0; a < 360; a += 5) {
    const len = a % 90 === 0 ? 14 : a % 15 === 0 ? 9 : 5;
    ticks += `<line x1="${f(pt(128, a)).split(" ")[0]}" y1="${f(pt(128, a)).split(" ")[1]}" x2="${pt(128 - len, a)[0].toFixed(1)}" y2="${pt(128 - len, a)[1].toFixed(1)}" class="${a % 15 === 0 ? "tk-major" : "tk"}"/>`;
  }
  // rosa dos ventos: cada ponta em duas metades (luz e sombra)
  const ray = (deg, r, w, cls) => {
    const tip = pt(r, deg), l = pt(w, deg - 45), rr = pt(w, deg + 45);
    return `<path class="${cls}-a" d="M${cx} ${cy}L${f(tip)}L${f(l)}Z"/><path class="${cls}-b" d="M${cx} ${cy}L${f(tip)}L${f(rr)}Z"/>`;
  };
  const rose = [45, 135, 225, 315].map((a) => ray(a, 62, 16, "r2")).join("") + [0, 90, 180, 270].map((a) => ray(a, 96, 20, "r1")).join("");
  const labels = [["N", 0], ["L", 90], ["S", 180], ["O", 270]]
    .map(([t, a]) => `<text x="${pt(104, a)[0].toFixed(1)}" y="${(pt(104, a)[1] + 5).toFixed(1)}" class="${t === "N" ? "lb-n" : "lb"}" text-anchor="middle">${t}</text>`)
    .join("");
  return `<svg class="compass" viewBox="0 0 300 300" role="img" aria-label="Bússola">
    <circle cx="150" cy="150" r="146" class="bezel"/>
    <circle cx="150" cy="150" r="132" class="face"/>
    <circle cx="150" cy="150" r="86" class="ring"/>
    ${ticks}${labels}<g class="rose">${rose}</g>
    <g class="needle"><path class="nd-n" d="M150 46L159 150H141Z"/><path class="nd-s" d="M150 254L159 150H141Z"/><circle cx="150" cy="150" r="9" class="cap"/><circle cx="150" cy="150" r="3.2" class="cap-dot"/></g>
  </svg>`;
};
const cps = site.compass;
if (cps) {
  $("#compass").innerHTML = `
    <div class="compass-wrap">${compassSVG()}<span class="heading" aria-live="polite"></span></div>
    <div class="compass-text">
      <p class="kicker">${esc(cps.kicker)}</p>
      <h3>${esc(cps.title)}</h3>
      <p>${esc(cps.text)}</p>
      <ul class="destinations">${cps.destinations
        .map((d) => `<li><button data-open="${d.project}" data-bearing="${d.bearing}"><span class="brg">${String(d.bearing).padStart(3, "0")}°</span><b>${esc(d.stack)}</b><span class="to">→ ${esc(projTitle(d.project))}</span></button></li>`)
        .join("")}</ul>
    </div>`;
  const needle = $("#compass .needle"), headingEl = $("#compass .heading");
  const card = (b) => ["N", "NE", "L", "SE", "S", "SO", "O", "NO"][Math.round(b / 45) % 8];
  const point = (b) => {
    needle.style.setProperty("--b", `${b}deg`);
    needle.classList.add("aimed");
    headingEl.textContent = `${card(b)} · ${String(b).padStart(3, "0")}°`;
  };
  const rest = () => { needle.classList.remove("aimed"); headingEl.textContent = ""; };
  document.querySelectorAll("#compass [data-bearing]").forEach((btn) => {
    btn.addEventListener("mouseenter", () => point(Number(btn.dataset.bearing)));
    btn.addEventListener("focus", () => point(Number(btn.dataset.bearing)));
    btn.addEventListener("mouseleave", rest);
    btn.addEventListener("blur", rest);
  });
}

/* ---------- Números ---------- */
const langCount = {};
projects.forEach((p) => p.languages.forEach((l) => (langCount[l] = (langCount[l] || 0) + 1)));
const areas = new Set(projects.flatMap((p) => p.category).filter((c) => c !== "study"));
const stats = [
  [projects.length, "projetos no portfólio"],
  [Object.keys(langCount).length, "linguagens de programação"],
  [areas.size, "áreas de atuação"],
  [`${new Date().getFullYear() - site.codingSince}+`, "anos programando"],
];
$("#stats").innerHTML = stats.map(([n, t]) => `<div class="stat"><b>${n}</b><span>${t}</span></div>`).join("");

/* ---------- Linguagens ---------- */
const byProj = Object.entries(langCount).sort((a, b) => b[1] - a[1]);
const maxP = byProj[0]?.[1] || 1;
$("#lang-projects").innerHTML = byProj
  .map(([l, n]) => `<div class="bar-row"><span>${esc(l)}</span><div class="bar-track"><div class="bar-fill" style="--c:${color(l)};width:${(n / maxP) * 100}%"></div></div><span class="n">${n}</span></div>`)
  .join("");

// Repositórios públicos por linguagem (mais justo que bytes: notebooks e drivers de fabricante inflam o volume).
const repoLang = {};
(gh?.repos || []).forEach((r) => (r.languages || []).forEach((l) => (repoLang[l] = (repoLang[l] || 0) + 1)));
const useRepos = Object.keys(repoLang).length > 0;
const src = useRepos ? repoLang : gh?.languages || {};
if (Object.keys(src).length) {
  const entries = Object.entries(src).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const label = (v) => (useRepos ? `${v} repo${v > 1 ? "s" : ""}` : `${((v / total) * 100).toFixed(1)}%`);
  $("#lang-bytes-title").textContent = useRepos ? "Repositórios públicos por linguagem" : "Volume de código no GitHub";
  $("#lang-bytes-desc").textContent = useRepos
    ? `Em quantos dos ${gh.repos.length} repositórios públicos (sem forks) cada linguagem aparece, segundo o GitHub.`
    : "Distribuição por bytes nos repositórios públicos, segundo o GitHub.";
  $("#lang-bytes-bar").innerHTML = entries.map(([l, v]) => `<span style="--c:${color(l)};flex:${v}" title="${esc(l)}"></span>`).join("");
  $("#lang-bytes-bar").setAttribute("aria-label", entries.map(([l, v]) => `${l}: ${label(v)}`).join(", "));
  $("#lang-bytes-legend").innerHTML = entries
    .map(([l, v]) => `<li><i style="--c:${color(l)}"></i>${esc(l)}<span class="pct">${label(v)}</span></li>`)
    .join("");
}

/* ---------- Projetos ---------- */
const narrow = () => matchMedia("(max-width: 700px)").matches;
const flowHTML = (d, vertical = false) =>
  `<div class="flow${vertical ? " v" : ""}">${d.steps
    .map((s, i) => {
      const node = `<div class="node"><b>${esc(s.t)}</b>${s.s ? `<small>${esc(s.s)}</small>` : ""}</div>`;
      const edge = i < d.steps.length - 1 ? `<div class="edge" aria-hidden="true">${d.edges?.[i] ? `<span>${esc(d.edges[i])}</span>` : ""}</div>` : "";
      return node + edge;
    })
    .join("")}</div>`;

const linksHTML = (p) => {
  const out = [];
  if (p.links.live) out.push(`<a href="${p.links.live}" target="_blank" rel="noopener">Ver online ↗</a>`);
  if (p.links.repo) out.push(`<a href="${p.links.repo}" target="_blank" rel="noopener">Código ↗</a>`);
  if (p.links.repo2) out.push(`<a href="${p.links.repo2}" target="_blank" rel="noopener">Código (parte 2) ↗</a>`);
  (p.links.extra || []).forEach((e) => out.push(`<a href="${e.url}" target="_blank" rel="noopener">${esc(e.label)} ↗</a>`));
  if (p.private) out.push(`<span class="private-note">🔒 ${p.proprietary ? "Código proprietário da empresa" : p.client ? "Código confidencial do cliente" : "Código em repositório privado"}</span>`);
  return out.join("");
};

const metaHTML = (p) =>
  `<div class="meta"><span class="badge">${esc(p.year)}</span><span class="badge ${p.links.live ? "live" : ""}">${esc(p.status)}</span>${p.client ? '<span class="badge client">Projeto para cliente</span>' : ""}${p.company ? `<span class="badge client">${esc(p.company)}</span>` : ""}${p.category
    .map((c) => `<span class="badge">${CATEGORIES[c]}</span>`)
    .join("")}</div>`;

const chips = (arr, n = arr.length) =>
  `<div class="chips">${arr.slice(0, n).map((t) => `<span class="chip">${esc(t)}</span>`).join("")}${arr.length > n ? `<span class="chip">+${arr.length - n}</span>` : ""}</div>`;

const visualHTML = (p) => {
  // foto própria (não ilustrativa, não logo) entra acima do diagrama nos destaques
  const photo = (p.images || []).find((i) => !i.illustrative && !i.contain);
  const photoHTML = photo ? `<img class="feature-photo" src="${photo.src}" alt="${esc(photo.caption)}" loading="lazy"${photo.pos ? ` style="object-position:${photo.pos}"` : ""}>` : "";
  if (p.diagram) return `${photoHTML}<p class="diagram-title">${esc(p.diagram.title)}</p>${flowHTML(p.diagram, true)}`;
  if (p.images?.[0]) return `<img src="${p.images[0].src}" alt="${esc(p.images[0].caption)}" loading="lazy">`;
  return "";
};

$("#featured").innerHTML = projects
  .filter((p) => p.featured)
  .map(
    (p) => `<article class="feature">
      <div class="feature-body">
        ${metaHTML(p)}
        <h3>${esc(p.title)}</h3>
        <p class="tagline">${esc(p.tagline)}</p>
        ${p.role ? `<p class="role-line" style="margin:0"><b>Meu papel:</b> ${esc(p.role)}</p>` : ""}
        <p>${esc(p.summary)}</p>
        ${chips(p.stack, 8)}
        <div class="links"><button class="linkbtn" data-open="${p.slug}">Ver detalhes →</button>${linksHTML(p)}</div>
      </div>
      <div class="feature-visual">${visualHTML(p)}</div>
    </article>`
  )
  .join("");

const thumb = (p) => {
  const img = p.images?.[0];
  if (img) return `<img src="${img.src}" alt="" loading="lazy" class="${img.contain ? "contain" : ""}"${img.pos ? ` style="object-position:${img.pos}"` : ""}>${img.illustrative ? '<span class="thumb-tag">ilustrativa</span>' : ""}`;
  if (p.diagram) {
    // miniatura: no máximo 3 etapas (primeira, a do meio e a última)
    const st = p.diagram.steps;
    const pick = st.length <= 3 ? st : [st[0], st[Math.floor(st.length / 2)], st[st.length - 1]];
    return flowHTML({ steps: pick, edges: [] });
  }
  return `<span class="muted">${esc(p.languages.join(" · "))}</span>`;
};

const others = projects.filter((p) => !p.featured);
let current = "all";
const renderGrid = () => {
  const list = current === "all" ? projects : projects.filter((p) => p.category.includes(current));
  const shown = current === "all" ? others : list;
  $("#project-grid").innerHTML = shown
    .map(
      (p) => `<button class="card" data-open="${p.slug}" aria-label="Detalhes de ${esc(p.title)}">
        <div class="card-thumb">${thumb(p)}</div>
        <div class="card-body">
          ${metaHTML(p)}
          <h3>${esc(p.title)}</h3>
          <p>${esc(p.tagline)}</p>
          ${chips(p.stack, 5)}
        </div>
      </button>`
    )
    .join("");
  $("#featured").hidden = current !== "all";
};
$("#filters").innerHTML = Object.entries(CATEGORIES)
  .filter(([k]) => k === "all" || projects.some((p) => p.category.includes(k)))
  .map(([k, v]) => {
    const n = k === "all" ? projects.length : projects.filter((p) => p.category.includes(k)).length;
    return `<button class="filter" data-filter="${k}" aria-pressed="${k === current}">${v} <span class="muted">${n}</span></button>`;
  })
  .join("");
$("#filters").addEventListener("click", (e) => {
  const b = e.target.closest("[data-filter]");
  if (!b) return;
  current = b.dataset.filter;
  document.querySelectorAll(".filter").forEach((f) => f.setAttribute("aria-pressed", f === b));
  renderGrid();
});
renderGrid();

/* ---------- Modal de projeto ---------- */
const dlg = $("#project-dialog");
const openProject = (slug, push = true) => {
  const p = projects.find((x) => x.slug === slug);
  if (!p) return;
  $("#dlg-body").innerHTML = `
    ${metaHTML(p)}
    <h2 id="dlg-title" style="margin-top:12px">${esc(p.title)}</h2>
    <p class="tagline">${esc(p.tagline)}</p>
    ${p.role ? `<p class="role-line"><b>Meu papel:</b> ${esc(p.role)}</p>` : ""}
    <div class="links">${linksHTML(p)}</div>
    <section><h4>A ideia</h4><p>${esc(p.summary)}</p>${(p.details || []).map((d) => `<p>${esc(d)}</p>`).join("")}</section>
    ${p.diagram ? `<section><h4>Diagrama · ${esc(p.diagram.title)}</h4><div class="diagram-box">${flowHTML(p.diagram, true)}</div></section>` : ""}
    ${p.highlights?.length ? `<section><h4>Destaques técnicos</h4><ul class="hl">${p.highlights.map((h) => `<li>${esc(h)}</li>`).join("")}</ul></section>` : ""}
    <section><h4>Tecnologias</h4>${chips(p.stack)}<p class="muted small" style="margin-top:10px">Linguagens: ${p.languages.map(esc).join(", ")}</p></section>
    ${p.images?.length ? `<section><h4>Imagens</h4><div class="gallery">${p.images.map((i) => `<figure><img src="${i.src}" alt="${esc(i.caption)}" loading="lazy"><figcaption>${esc(i.caption)}</figcaption></figure>`).join("")}</div></section>` : ""}
  `;
  if (!dlg.open) dlg.showModal();
  dlg.scrollTop = 0;
  if (push) history.pushState(null, "", `#projeto/${slug}`);
};
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-open]");
  if (b) openProject(b.dataset.open);
});
$("#dlg-close").addEventListener("click", () => dlg.close());
dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
dlg.addEventListener("close", () => { if (location.hash.startsWith("#projeto/")) history.pushState(null, "", "#projetos"); });
const fromHash = () => {
  const m = location.hash.match(/^#projeto\/(.+)$/);
  if (m) openProject(m[1], false);
  else if (dlg.open) dlg.close();
};
addEventListener("popstate", fromHash);
fromHash();

/* ---------- Contato ---------- */
const ICONS = {
  whatsapp: '<path fill="currentColor" d="M12.04 2a9.9 9.9 0 0 0-8.5 14.98L2 22l5.17-1.5A9.93 9.93 0 1 0 12.04 2Zm0 18.13a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.07.89.9-2.99-.2-.31a8.22 8.22 0 1 1 6.86 3.74Zm4.5-6.15c-.25-.12-1.46-.72-1.69-.8-.23-.08-.39-.12-.56.12-.16.25-.64.8-.78.97-.15.16-.29.18-.54.06a6.74 6.74 0 0 1-3.36-2.94c-.25-.44.25-.41.72-1.36.08-.16.04-.3-.02-.43l-.76-1.83c-.2-.48-.4-.41-.56-.42h-.47a.9.9 0 0 0-.66.31 2.76 2.76 0 0 0-.86 2.05 4.8 4.8 0 0 0 1 2.55 10.97 10.97 0 0 0 4.2 3.71c1.56.68 2.18.73 2.96.62.48-.07 1.46-.6 1.67-1.18.2-.58.2-1.08.14-1.18-.06-.1-.22-.16-.47-.28Z"/>',
  mail: '<path fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" d="M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm-1 1.5 9 6.5 9-6.5"/>',
  linkedin: '<path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05a3.75 3.75 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z"/>',
  github: '<path fill="currentColor" d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.83 1.24 1.83 1.24 1.07 1.83 2.81 1.3 3.5 1 .1-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.63-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .32.21.69.82.57A12 12 0 0 0 12 .3"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">${ICONS[name]}</svg>`;
const waDigits = (site.whatsapp || "").replace(/\D/g, "");
const contacts = [
  waDigits && `<a class="btn primary" href="https://wa.me/${waDigits}" target="_blank" rel="noopener">${icon("whatsapp")}WhatsApp · ${esc(site.whatsapp)}</a>`,
  site.email && `<a class="btn" href="mailto:${site.email}">${icon("mail")}${esc(site.email)}</a>`,
  site.linkedin && `<a class="btn" href="${site.linkedin}" target="_blank" rel="noopener">${icon("linkedin")}LinkedIn</a>`,
  `<a class="btn" href="${site.github}" target="_blank" rel="noopener">${icon("github")}GitHub</a>`,
].filter(Boolean);
$("#contact-links").innerHTML = contacts.join("");
