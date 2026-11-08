// Gera data/github.json com perfil e linguagens dos repositórios públicos.
// Roda no GitHub Actions (antes do deploy) e localmente: `node scripts/fetch-github.mjs`
// Sem dependências. GITHUB_TOKEN é opcional (só aumenta o limite da API).
import { writeFile, mkdir, readFile } from "node:fs/promises";

const USER = process.env.GH_USER || "PFSLDO";
const token = process.env.GITHUB_TOKEN;
const headers = {
  "User-Agent": "portfolio-builder",
  Accept: "application/vnd.github+json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
};

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

let previous = null;
try {
  previous = JSON.parse(await readFile("data/github.json", "utf8"));
} catch {}

let profile, repos;
try {
  profile = await api(`/users/${USER}`);
  repos = (await api(`/users/${USER}/repos?per_page=100&sort=pushed`)).filter((r) => !r.fork);
} catch (e) {
  if (!previous) throw e;
  // Sem acesso à API: reaproveita perfil/repos/linguagens do último arquivo e só atualiza o calendário.
  console.warn("API indisponível, reaproveitando data/github.json:", e.message);
}

const languages = profile ? {} : previous.languages;
const repoList = profile ? [] : previous.repos;
if (!profile) profile = previous.profile;
for (const r of repos || []) {
  let langs;
  try {
    langs = await api(`/repos/${USER}/${r.name}/languages`);
  } catch (e) {
    // Sem cota de API: usa a linguagem principal do repo com o tamanho (KB) como peso.
    console.warn(e.message);
    langs = r.language ? { [r.language]: r.size * 1024 } : {};
  }
  for (const [k, v] of Object.entries(langs)) languages[k] = (languages[k] || 0) + v;
  repoList.push({
    name: r.name,
    url: r.html_url,
    homepage: r.homepage || null,
    description: r.description,
    stars: r.stargazers_count,
    pushed_at: r.pushed_at,
    created_at: r.created_at,
    languages: Object.keys(langs),
  });
}

const out = {
  generated_at: new Date().toISOString(),
  profile: {
    login: profile.login,
    name: profile.name,
    bio: profile.bio,
    location: profile.location,
    avatar_url: profile.avatar_url,
    html_url: profile.html_url,
    public_repos: profile.public_repos,
    followers: profile.followers,
    created_at: profile.created_at,
  },
  languages,
  repos: repoList,
};

await mkdir("data", { recursive: true });
await writeFile("data/github.json", JSON.stringify(out));
console.log(`ok: ${repoList.length} repos, ${Object.keys(languages).length} linguagens`);
