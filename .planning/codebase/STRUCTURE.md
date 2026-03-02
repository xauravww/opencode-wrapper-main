# Codebase Structure

**Analysis Date:** 2026-03-02

## Directory Layout

```
opencode-wrapper-main/
├── server.js              # Main Express server entry point
├── providerManager.js     # Provider abstraction and health monitoring
├── package.json           # Node.js dependencies
├── .env                   # Environment configuration (not committed)
├── .env.example           # Environment template
├── db/                    # Database layer
│   ├── index.js          # SQLite initialization
│   ├── schema.sql        # Database schema
│   └── opencode.db       # SQLite database file
├── utils/                 # Utility modules
│   ├── streamTracker.js  # SSE stream parsing
│   └── emailService.js   # Email backup service
├── client/                # React admin dashboard
│   ├── src/              # Source code
│   ├── dist/             # Built files
│   ├── package.json      # Frontend dependencies
│   ├── vite.config.js    # Vite configuration
│   └── tailwind.config.js
└── test*.js              # Various test scripts
```

## Directory Purposes

**Root Directory:**
- Purpose: Server entry point and configuration
- Contains: server.js, providerManager.js, package.json
- Key files: `server.js`, `providerManager.js`, `package.json`

**db/:**
- Purpose: Database layer
- Contains: SQLite database initialization and schema
- Key files: `db/index.js`, `db/schema.sql`

**utils/:**
- Purpose: Shared utility functions
- Contains: Stream tracking, email services
- Key files: `utils/streamTracker.js`, `utils/emailService.js`

**client/:**
- Purpose: React admin dashboard
- Contains: React components, pages, API client
- Key files: `client/src/App.jsx`, `client/src/api.js`

## Key File Locations

**Entry Points:**
- `server.js`: Main Express server, all REST endpoints, middleware, cron jobs
- `client/src/main.jsx`: React app entry point

**Configuration:**
- `package.json`: Node.js dependencies and scripts
- `client/package.json`: Frontend dependencies
- `client/vite.config.js`: Vite build configuration
- `client/tailwind.config.js`: Tailwind CSS configuration

**Core Logic:**
- `providerManager.js`: Provider abstraction layer, health monitoring, request routing
- `db/index.js`: Database module with initDB function

**Testing:**
- Various `test*.js` files in root directory

## Naming Conventions

**Files:**
- JavaScript: camelCase (`streamTracker.js`, `emailService.js`)
- JSX components: PascalCase (`Dashboard.jsx`, `Login.jsx`)
- Database schema: lowercase with dashes (`schema.sql`)

**Directories:**
- All lowercase: `db/`, `utils/`, `client/src/pages/`

**Variables/Functions:**
- camelCase for functions and variables
- PascalCase for React components
- CONSTANT_CASE for configuration constants within files

## Where to Add New Code

**New API Endpoint:**
- Primary code: Add new route handler in `server.js`
- Tests: Create new `test_*.js` file in root

**New Provider:**
- Implementation: Add provider config in `providerManager.js` initializeProviders()
- Configuration: Add environment variable handling for API keys

**New Database Table:**
- Schema: Add CREATE TABLE in `db/schema.sql`
- Queries: Use db module in `db/index.js`

**New Utility:**
- Shared helpers: Add to `utils/` directory
- Import in `server.js` as needed

**New Admin Dashboard Page:**
- Component: Create in `client/src/pages/`
- Route: Add to `client/src/App.jsx` Routes
- API call: Add endpoint in `server.js`

**New Background Job:**
- Cron job: Add in `server.js` start() function using node-cron

## Special Directories

**db/:**
- Purpose: SQLite database storage
- Generated: Yes (opencode.db created at runtime)
- Committed: No (in .gitignore)

**client/dist/:**
- Purpose: Built frontend files
- Generated: Yes (via Vite build)
- Committed: Yes (for production serving)

**node_modules/:**
- Purpose: npm dependencies
- Generated: Yes (via npm install)
- Committed: No

---

*Structure analysis: 2026-03-02*
