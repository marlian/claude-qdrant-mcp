# Contributing to qdrant-mcp-hybrid-public

First of all, thanks for even considering contributing. You're already doing better than 99% of visitors.

## 🧠 What This Is

This repo is a TypeScript MCP server for Qdrant, with multi-client isolation, LM Studio integration, and enterprise-level document processing.  
If you’re reading this, you probably know what you’re doing — but just in case:

- All clients are separated (`{client}_catalog`, `{client}_chunks`)
- Local-first architecture (no cloud dependencies)
- Built for semantic search using BGE-M3 embeddings + Qwen3-8B summaries

## 🛠 How to Contribute

### 1. Fork the repo

Classic move. Hit that **Fork** button like you mean it.

### 2. Clone your fork

```bash
git clone https://github.com/your-username/qdrant-mcp-hybrid-public.git
```

### 3. Create a feature branch

```bash
git checkout -b cool-feature-name
```

### 4. Code. Try not to break everything.

### 5. Commit with useful messages

```bash
git commit -m "Add support for multi-doc unicorn indexing"
```

Yes, we read the commit messages. Don’t make us sad.

### 6. Push and open a Pull Request

Keep it small and focused. PRs that change 1000+ files will be softly ignored while we pretend to be busy.

---

## ✅ Ground Rules

- Be respectful. Don’t be a jerk, not even in cleverly disguised sarcasm.
- Format your code. We use `prettier` and basic TypeScript linting.
- If you’re adding a new dependency, explain why. If it’s `"leftpad"`, go home.

---

## 💬 Questions?

Open a discussion or issue. Or email us at [marlian.github@gmail.com](mailto:marlian.github@gmail.com) if it’s sensitive or dramatic.

---

Thanks again. We genuinely appreciate contributions, even if we pretend to be too cool to say it.
