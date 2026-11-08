# Portfólio · Pamela Fialho

Site estático (HTML, CSS e JavaScript puro, sem build) hospedado de graça no GitHub Pages.

## Como editar o conteúdo

Tudo que aparece no site vem de três arquivos em `data/`:

| Arquivo | O que tem |
| --- | --- |
| `data/site.json` | Nome, cargo, texto "Sobre", trajetória, stack, WhatsApp, e-mail e LinkedIn |
| `data/projects.json` | Cada projeto: resumo, detalhes, tecnologias, links, imagens e diagrama |
| `data/github.json` | **Gerado automaticamente** (perfil e linguagens dos repositórios públicos). Não edite à mão. |

### Adicionar um projeto

Adicione um objeto em `data/projects.json`:

```json
{
  "slug": "meu-projeto",
  "title": "Meu Projeto",
  "tagline": "Uma frase sobre o que ele faz",
  "year": "2026",
  "category": ["web"],
  "status": "No ar",
  "featured": false,
  "summary": "Resumo da ideia.",
  "details": ["Parágrafo com mais contexto."],
  "highlights": ["Destaque técnico"],
  "stack": ["React", "Firebase"],
  "languages": ["TypeScript"],
  "links": { "repo": "https://github.com/...", "live": "https://..." },
  "private": false,
  "images": [{ "src": "assets/img/projects/meu-projeto.png", "caption": "Legenda" }],
  "diagram": {
    "title": "Arquitetura",
    "steps": [{ "t": "Usuário", "s": "navegador" }, { "t": "API", "s": "Node" }],
    "edges": ["HTTPS"]
  }
}
```

- `category`: `web`, `mobile`, `embedded`, `science` ou `study`.
- `featured: true` coloca o projeto no topo, em destaque.
- `private: true` mostra "Código em repositório privado" no lugar do link.
- `diagram` vira um fluxograma que acompanha o tema claro/escuro. `edges` são os rótulos das setas (um a menos que `steps`).
- Coloque imagens em `assets/img/projects/` (de preferência com até 1400 px de largura).

## Rodar localmente

```bash
python3 -m http.server 8080
```

Abra http://localhost:8080. Para atualizar os dados do GitHub localmente: `node scripts/fetch-github.mjs`.

## Deploy

O workflow `.github/workflows/deploy.yml` publica o site a cada push na `main` e também uma vez por dia, para manter as linguagens atualizadas.

Configuração única: no repositório, vá em **Settings → Pages → Build and deployment → Source** e escolha **GitHub Actions**.
