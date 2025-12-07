# Workday Compass

**Workday Compass** is an AI-powered assistant designed to integrate seamlessly with **Workday** and **Slack**.  
It answers employee queries based on **company SOPs**, **Workday knowledge base**, and **role-based access**, delivering responses directly in Slack or through a web interface.

---

## Features
- 🔑 **Role-Aware Answers** — Uses Workday data or a role map to tailor responses for EMPLOYEE, MANAGER, or HR.
- 📄 **SOP Ingestion** — Upload company SOPs, policies, or knowledge base docs (PDF, DOCX, HTML) with role tagging.
- 🤖 **Slack Integration** — Mention the bot or use `/compass` to ask questions; responses include source citations.
- 🧠 **RAG Pipeline** — Retrieves relevant content from the SOP database before querying the LLM.
- 📊 **Admin Panel** — Manage documents, roles, and view analytics on query usage.
- 🚀 **MVP-Ready** — Can run fully on your VPS with an open-source LLM via Ollama.

---

## Tech Stack
- **Backend**: Node.js (Express) + Prisma ORM
- **Database**: PostgreSQL + `pgvector`
- **LLM**: Local (Ollama: LLaMA 3.1 8B / Mistral 7B) or external OpenAI-compatible API
- **Slack Bot**: Bolt for JS
- **Frontend Admin UI**: Next.js (App Router)
- **Containerization**: Docker Compose for local/dev environments

---

## Requirements
- Node.js 20+
- Docker + Docker Compose
- PostgreSQL with `pgvector` extension
- Slack App credentials (Client ID, Secret, Signing Secret, Bot Token)
- (Optional) Workday API sandbox credentials or role CSV
- Hostinger VPS (Ubuntu 22.04 LTS, 2 vCPU, 4 GB RAM, 80 GB SSD)

---

## Environment Variables
Copy `.env.example` to `.env` and fill in:

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/workday_compass
OPENAI_BASE_URL=http://localhost:11434/v1
OPENAI_API_KEY=ollama
EMBED_MODEL=e5-small
JWT_SECRET=change_me
ALLOWED_EMAIL_DOMAIN=company.com

SLACK_CLIENT_ID=xxx
SLACK_CLIENT_SECRET=xxx
SLACK_SIGNING_SECRET=xxx
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...