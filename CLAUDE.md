# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**Object Store File Manager — Agro** — SAPUI5 TypeScript frontend + CAP Node.js REST backend for managing files on SAP BTP Object Store (S3-compatible). Agro variant of the base project, with completely independent CF service instances. Targets SAP Build Work Zone.

## Key Commands

```bash
# Install all dependencies
npm install && npm install --prefix srv && npm install --prefix app

# Run backend (localhost:4004, dummy auth)
cd srv && cds watch

# Run frontend (localhost:8080, proxies /api to :4004)
cd app && npm start

# Hybrid testing (real S3, dummy auth) — requires .cdsrc-private.json at root
cds bind --exec --profile hybrid -- cds watch

# Lint UI5
cd app && npx ui5lint

# MTA build + deploy
mbt build
cf deploy mta_archives/object-store-file-manager-agro_1.0.0.mtar
# or: npm run deploy (from root)
```

## Architecture

```
SAPUI5 TypeScript (app/)  →  CAP Node.js REST (srv/)  →  S3 / Object Store
```

- **Frontend** (`app/webapp/`): SAPUI5 1.148.1, namespace `com.presales.objectstorefilemanageragro`, TypeScript with `ui5-tooling-transpile`.
- **Backend** (`srv/`): CAP Node.js with `@protocol: 'rest'` (not OData). No database — Object Store is the only storage.
- **S3 layer** (`srv/lib/s3-client.js`): AWS SDK v3. Credentials come exclusively from `VCAP_SERVICES.objectstore[0].credentials` (CF binding) or local env vars in `default-env.json`.
- **Upload/Download**: Direct Express routes at `/api/files/upload` (multipart) and `/api/files/download` (stream). All other operations go through CDS action handlers.
- **Auth**: XSUAA JWT in production, `dummy` in development. Roles: `FileViewer` (read/download) and `FileManager` (write/delete).

## CF Service Instances (Agro — independent from base project)

| Instance name | Service | Plan |
|---|---|---|
| `object-store-file-manager-agro-xsuaa` | xsuaa | application |
| `object-store-file-manager-agro-objectstore` | objectstore | s3-standard |
| `object-store-file-manager-agro-html5repo` | html5-apps-repo | app-host |
| `object-store-file-manager-agro-dest` | destination | lite |

## Key Identifiers

| Identifier | Value |
|---|---|
| MTA ID | `object-store-file-manager-agro` |
| UI5 namespace | `com.presales.objectstorefilemanageragro` |
| `sap.cloud.service` | `com.presales.objectstorefilemanageragro` |
| `semanticObject` | `ObjectStoreFileManagerAgro` |
| `xsappname` | `object-store-file-manager-agro` |
| CF app (backend) | `object-store-file-manager-agro-srv` |
| HTML5 app ID (cf html5-list) | `compresalesobjectstorefilemanageragro` |

## Important Files

| File | Purpose |
|---|---|
| `srv/file-manager-service.cds` | Service definition (REST, roles, actions) |
| `srv/file-manager-service.js` | CAP handlers + Express upload/download routes |
| `srv/lib/s3-client.js` | All S3 operations (list, get, put, copy, delete) |
| `srv/lib/path-utils.js` | Path sanitization — prevent traversal attacks |
| `app/webapp/model/FileService.ts` | All frontend API calls |
| `app/webapp/controller/Home.controller.ts` | Main UI logic |
| `xs-security.json` | XSUAA roles/scopes definition |
| `mta.yaml` | MTA build descriptor for BTP deployment |
| `default-env.json.example` | Template for local S3 credentials (copy to `default-env.json`, never commit) |
| `.cdsrc-private.json` | Local hybrid profile — objectstore service key binding (never commit) |

## MTA Destination Setup

The `mta.yaml` configures two destination scopes:

- **`content.instance`** (via `object-store-file-manager-agro-dest-content` module): `object-store-file-manager-agro-backend` and `object-store-file-manager-agro-html5repo` — used by Work Zone managed approuter.
- **`init_data.instance`** (via dest service resource config): `ui5` static destination — provides SAPUI5 framework URL.
- **`init_data.subaccount`** (via dest service resource config): `sjoule-studio-grounding` — S3 grounding destination for SAP Joule Studio. Contains placeholder values (`REPLACE_ME_*`) that must be filled manually after deploy.

## Conventions

- Never put S3 credentials in frontend code or committed files.
- `default-env.json` is in `.gitignore` — use `default-env.json.example` as template.
- Backend uses CommonJS (`require`/`module.exports`), not ESM — CAP Node.js works better with CJS.
- Frontend uses TypeScript with ES6 `import` statements (transpiled by `ui5-tooling-transpile`).
- Folder rename/move = copy-all-objects + delete-all-objects under prefix (S3 has no native rename).
- Recursive folder delete requires `recursive: true` flag sent by frontend after confirmation.
- API base URL uses `sap.ui.require.toUrl("com/presales/objectstorefilemanageragro/api")` — resolves correctly both standalone and under Work Zone subpath.

## Tool Usage Rules

- **Always use `cds-mcp`** before modifying `.cds` files, CAP handlers, `package.json` CAP config, or any CAP-related structure.
- **Always use the UI5 plugin** (`run_ui5_linter`, `run_manifest_validation`, `get_api_reference`) when creating or modifying SAPUI5 code.
