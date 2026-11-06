# HostGPT AI — runnable starter v0.1

Persian-first Node.js dashboard with server-side Ollama local/cloud, Gemini and xAI adapters, secure ZIP preview, GitHub repository listing and branch-based Pull Request import. Includes a read-only MCP JSON-RPC scaffold. Not a production hosting manager yet.

**Important:** The credentials pasted in the conversation have not been included. Revoke and rotate them before use.

## Quick start

1. Install Node.js 20+ and extract the project.
2. Copy `.env.example` to `.env`. Fill in a NEW `ADMIN_PASSWORD` (14+ characters).
3. `node server.mjs`
4. Visit `http://127.0.0.1:3000`.
5. For free AI: start Ollama locally and download the `qwen2.5-coder:7b` model; the app will use its local API.

See `README.fa.md` for Persian setup and limitations. Run `npm test` to verify ZIP safety checks.

GitHub Pages can host the static interface only; this starter currently serves frontend and backend together, so use a Node.js environment to run it. Never commit `.env` or publish keys in browser code.
