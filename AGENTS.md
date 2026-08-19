# AI Agent Development & Vibe Coding Guidelines (`AGENTS.md`)

This file governs all AI Agents (including Gemini, ChatGPT, Claude, Cursor, Antigravity) operating on the `HostCalculator` project.

---

## 🛡️ Vibe Coding Safety Rules (NON-NEGOTIABLE)

1. **Never delete production data without explicit confirmation.**
2. **Never reset production database without explicit confirmation.**
3. **Never modify production database schema directly.** All schema changes MUST use migration files in `migrations/`.
4. **Never expose or commit secrets** (`.env`, Cloudflare tokens, API secrets, database passwords).
5. **Never rewrite the whole project** unless explicitly requested by the user. Perform progressive refactoring on existing architecture.
6. **Never remove an existing feature** just because it is inconvenient or complex.
7. **Never assume database schema or API behavior.** Always inspect actual source files (`migrations/`, `worker/src/index.js`, `frontend/js/`).
8. **Always inspect existing code before modifying it.**
9. **Treat sub-windows entered from buttons as full-screen standalone pages/views.** Do NOT manufacture narrow or tiny pop-up modal boxes for feature screens (e.g., History Bills, Database Management, Complex Tools). Ensure full-screen immersion, proper touch scroll isolation (`body.modal-open`), and prevent background swipe leakage.
10. **Admin is a User with `role=admin`.** Never create a separate Admin account system unless explicitly requested.
11. **Frontend role checks are not sufficient for authorization.** Every Admin API MUST perform backend authorization checks on Cloudflare Worker.
12. **Never allow the system to have zero active Admins.** Never allow an Admin to accidentally remove or freeze the sole Admin.
13. **Important Admin actions must create Audit Logs.** Always record action details in `admin_logs`.
14. **Do not break existing user functionality when adding Admin functionality.** Admin users must retain 100% of normal user functionality.

---

## 📋 Standard Operating Workflow for AI Agents

### 1. Before Modifying Code
1. Read [`docs/ARCHITECTURE.md`](file:///Users/lebin/Documents/GitHub/HostCalculator/docs/ARCHITECTURE.md) to understand overall system architecture.
2. Read [`docs/API.md`](file:///Users/lebin/Documents/GitHub/HostCalculator/docs/API.md) if touch points involve backend endpoints.
3. Read [`docs/DATABASE.md`](file:///Users/lebin/Documents/GitHub/HostCalculator/docs/DATABASE.md) if touch points involve data structures.
4. Run `git status` / inspect working directory before making changes.
5. Search for existing utility functions and existing patterns in `frontend/js/` and `worker/src/`.

### 2. Before Modifying Database / Schema
1. Check `migrations/` directory for existing migration files.
2. **NEVER modify or edit already executed migration files** (e.g. `migrations/0001_create_venues.sql`).
3. Create a **new sequential migration file** (e.g., `migrations/0002_add_field_name.sql`).
4. Test the migration locally first using:
   ```bash
   npm run d1:migrate:local
   ```
5. Verify backward data compatibility.
6. Update [`docs/DATABASE.md`](file:///Users/lebin/Documents/GitHub/HostCalculator/docs/DATABASE.md) with updated table/column schema details.

### 3. Before Modifying API Endpoints
1. Search frontend code (`frontend/js/`) for references to the target API endpoint.
2. Ensure backward compatibility for request/response fields so frontend components do not break.
3. Update [`docs/API.md`](file:///Users/lebin/Documents/GitHub/HostCalculator/docs/API.md) after updating backend logic in `worker/src/index.js`.

### 4. After Completing Modifications
1. Execute unit tests (`npm test`).
2. Test modified functionality in local environment (`npm run dev`).
3. Check browser console logs and terminal logs for hidden runtime errors.
4. Review `git diff` to ensure clean, intended changes without accidental whitespace or leftover debug logs.
5. Provide a summary of modifications and step-by-step instructions on how to test changes.

---

## ⚙️ Environment Isolation Checklist

- **Local Development**: Work in `Local` mode (`http://localhost:8000`, local worker `127.0.0.1:8787`, local SQLite in `.wrangler/state/v3/d1/`).
- **Production**: Production database (`host-calculator-db`) is ONLY updated via explicit Cloudflare D1 migration commands or Cloudflare dashboard deployment.
