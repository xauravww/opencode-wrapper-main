# Technology Stack

**Analysis Date:** 2026-03-02

## Languages

**Primary:**
- JavaScript (ES Modules) - Server-side API wrapper
- JavaScript (ES Modules) - React frontend

**Secondary:**
- SQL - Database schema (SQLite)

## Runtime

**Environment:**
- Node.js - Runtime for backend server

**Package Manager:**
- npm - Package manager for both server and client
- Lockfile: `package-lock.json` present (both root and client)

## Frameworks

**Core (Backend):**
- Express 5.1.0 - Web application framework
- `@modelcontextprotocol/sdk` 1.20.2 - MCP client integration

**Core (Frontend):**
- React 18.2.0 - UI framework
- Vite 5.1.6 - Build tool and dev server
- React Router DOM 6.22.3 - Client-side routing

**Testing:**
- Node.js built-in test runner - `node --test`

**Build/Dev:**
- nodemon 3.1.7 - Development server auto-restart

## Key Dependencies

**Critical (Backend):**
- `@opencode-ai/sdk` 0.15.29 - OpenCode AI SDK
- `@rohitaryal/whisk-api` 3.1.0 - Whisk API integration
- `edge-tts-universal` 1.3.3 - Text-to-speech
- `better-sqlite3` 12.6.2 - SQLite database
- `express` 5.1.0 - HTTP server
- `jsonwebtoken` 9.0.3 - JWT authentication
- `bcryptjs` 3.0.3 - Password hashing

**Infrastructure:**
- `nodemailer` 7.0.12 - Email sending (SMTP)
- `xlsx` 0.18.5 - Excel file generation
- `swagger-jsdoc` 6.2.8 / `swagger-ui-express` 5.0.1 - API documentation
- `node-cron` 4.2.1 - Scheduled tasks
- `express-rate-limit` 8.2.0 - Rate limiting
- `morgan` 1.10.1 - HTTP request logging
- `cors` - Cross-origin resource sharing
- `dotenv` 16.4.5 - Environment configuration
- `node-fetch` 3.3.2 - HTTP client

**Frontend:**
- `axios` 1.6.7 - HTTP client
- `recharts` 2.12.2 - Charting library
- `framer-motion` 11.0.8 - Animation library
- `lucide-react` 0.344.0 - Icon library
- `tailwind-merge` 2.2.1 - Tailwind utility merging
- `clsx` 2.1.0 - Class name utility

**Frontend Dev:**
- `tailwindcss` 3.4.1 - CSS framework
- `postcss` 8.4.35 - CSS processing
- `autoprefixer` 10.4.18 - CSS vendor prefixes
- `@vitejs/plugin-react` 4.2.1 - Vite React plugin
- `eslint` 8.57.0 - JavaScript linting

## Configuration

**Environment:**
- `.env` file - Runtime configuration
- `.env.example` - Configuration template
- Key configs: API keys for 12+ AI providers, database path, SMTP settings

**Build:**
- `vite.config.js` - Frontend build configuration
- `postcss.config.js` - PostCSS configuration
- `tailwind.config.js` - Tailwind CSS configuration

## Platform Requirements

**Development:**
- Node.js (ES Modules support required)
- npm
- MongoDB not used - SQLite instead

**Production:**
- Node.js runtime
- SQLite file storage
- SMTP server for email notifications
- Multiple AI provider API keys

---

*Stack analysis: 2026-03-02*
