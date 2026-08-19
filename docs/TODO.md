# Project Backlog & TODO (`docs/TODO.md`)

This document tracks prioritized issues, architectural enhancements, security recommendations, and feature roadmaps.

---

## 🚨 Critical (Immediate Priority)

- [ ] **API Security Guard**: Implement header token validation (e.g. `X-Admin-Token` or Bearer token) on `POST`, `PUT`, `DELETE` endpoints in `worker/src/index.js` to protect against unauthorized data modification on production D1 database.

---

## ⚡ High Priority

- [x] **Vibe Coding System Setup**: Audit project, create `docs/` (`ARCHITECTURE.md`, `DATABASE.md`, `API.md`, `TODO.md`), migration guidelines, and `AGENTS.md`.
- [ ] **Automated Test Suite**: Add unit tests for calculation logic in `tests/calculator.test.js` and API schemas in `tests/api_schema.test.js`.
- [ ] **Automated Backup Procedure**: Create automated cron or CLI command for Cloudflare D1 SQL snapshot exports.

---

## 📈 Medium Priority

- [ ] **Dedicated Admin Panel (`/admin`)**: Build an authenticated administrative UI with pagination, filtering, search, export, and record modification capabilities.
- [ ] **Rate Limiting**: Add Cloudflare Worker rate limiting guard to endpoints to prevent denial of service or spam requests.
- [ ] **Soft Delete Support**: Add `is_deleted` column to database via a new migration (`0002_add_soft_delete.sql`) instead of hard row deletions.

---

## 🟢 Low Priority

- [ ] **Enhanced Bill Exporting**: Option to export bill summary as downloadable PNG/JPEG canvas image in addition to text format.
- [ ] **Multi-Currency Support**: Support currency selection (RM, SGD, RMB, USD, TWD) for regional badminton groups.
- [ ] **Local Storage Fallback Sync**: Improve offline local storage caching for venue lists when API network request fails.

---

## 🔮 Future Enhancements

- [ ] **Multi-Host User Authentication**: User signup/login to save host profiles, custom venues, and bill history in Cloudflare D1.
- [ ] **WeChat / Telegram Bot Integration**: Webhook service for quick calculation directly inside messaging apps.
