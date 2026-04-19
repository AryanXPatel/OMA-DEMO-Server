# AGENTS.md

## Scope
These instructions apply to the entire repository rooted at `D:\dev\OMA\OMA-DEMO-Server`.

## Mission
This repo is the Express backend for the OMA demo environment. It is the Google Sheets bridge for the Expo frontend and is now also responsible for rebuilding the owner-command-center derived analytics tabs. Preserve the generic sheet read/write behavior unless the task explicitly changes the API contract.

## Required Exploration Workflow
Use `jCodemunch-MCP` for code exploration whenever it is available.

1. Call `resolve_repo` with the current directory first.
2. If the repo is not indexed, call `index_folder`.
3. Before exploring structure, use `get_repo_outline` or `get_file_tree`.
4. Before searching, use `search_symbols` or `search_text`.
5. Before reading a file, use `get_file_outline` or `get_file_content`.

Do not default to shell-based search when `jCodemunch-MCP` is available.

## Project Snapshot
- Runtime: Node.js CommonJS
- Server: Express
- Auth: Google service account via `googleapis`
- Primary file: `index.js`
- Analytics workbook logic: `analyticsWorkbook.js`

## Important Commands
- Start server: `node index.js`
- Syntax check: `node --check index.js`
- Syntax check workbook builder: `node --check analyticsWorkbook.js`

There is no real automated test suite in this repo yet. Do not invent a fake CI lane.

## API Rules
- Keep the generic routes working:
  - `GET /`
  - `GET /api/sheets/:range`
  - `PUT /api/sheets/:range`
  - `POST /api/sheets/:sheet` for append operations
- Current analytics-specific routes:
  - `POST /api/sheets/batch-update`
  - `POST /api/analytics/rebuild`
- Prefer adding reusable helper functions in `analyticsWorkbook.js` instead of growing `index.js` into a monolith.
- Do not break existing `USER_ENTERED` sheet write behavior unless the task explicitly requires it.

## Workbook Rules
- Raw tabs are operational source tabs:
  - `New_Order_Table`
  - `Customer_Master`
  - `Product_Master`
  - `Customer_Ledger_2`
- Derived analytics tabs rebuilt by the server:
  - `Order_Header_Fact`
  - `Customer_Account_Snapshot`
  - `Analytics_KPI_Daily`
  - `AR_Open_Items_Fact`
  - `Attention_Queue_Snapshot`
- Keep raw-tab writes append-only in spirit. Do not assume columns can be inserted in the middle without frontend coordination.
- When changing workbook semantics, update the frontend repo’s analytics docs and `AGENTS.md` in tandem.

## Security And Repo Hygiene
- Never commit `.env`, `key.json`, or service-account secrets.
- Never stage `node_modules/` changes.
- If Git status shows tracked `node_modules` churn, stage only the intended source files explicitly.

## Validation Expectations
For backend changes, report the smallest meaningful checks you ran.

Typical checks:
- `node --check index.js`
- `node --check analyticsWorkbook.js`
- local request to `GET /`
- local request to `POST /api/analytics/rebuild`

## Preferred Agent Output
When finishing work in this repo:
- name the files changed
- state the commands run
- mention any checks you could not run
- call out any remaining risk, especially around Google Sheets schema assumptions or local-vs-remote backend differences
