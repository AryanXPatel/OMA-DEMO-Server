const express = require("express");
const { google } = require("googleapis");
const dotenv = require("dotenv");
const cors = require("cors");
const {
  RAW_RANGES,
  OUTPUT_SHEETS,
  buildAnalyticsWorkbook,
  buildRecentActivityFeed,
} = require("./analyticsWorkbook");

dotenv.config();

function resolvePort(argv = process.argv.slice(2), env = process.env) {
  const inlinePortArg = argv.find((arg) => arg.startsWith("--port="));
  const portFlagIndex = argv.findIndex(
    (arg) => arg === "-p" || arg === "--port"
  );
  const cliPort = inlinePortArg
    ? inlinePortArg.slice("--port=".length)
    : portFlagIndex !== -1
      ? argv[portFlagIndex + 1]
      : undefined;
  const selectedPort = cliPort || env.PORT || "3000";
  const parsedPort = Number(selectedPort);

  if (!Number.isInteger(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
    throw new Error(`Invalid port: ${selectedPort}`);
  }

  return parsedPort;
}

const app = express();
const port = resolvePort();
const ACTIVITY_CACHE_TTL_MS = 60000;
const activityCache = {
  expiresAt: 0,
  key: "",
  payload: null,
};

function clearActivityCache() {
  activityCache.expiresAt = 0;
  activityCache.key = "";
  activityCache.payload = null;
}

app.use(cors());
app.use(express.json());

// Simple health check endpoint
app.get("/", (req, res) => res.send("Order Management App - DEMO API running"));

// Unified auth client function
async function getAuthClient() {
  try {
    if (process.env.GOOGLE_SERVICE_ACCOUNT) {
      return new google.auth.GoogleAuth({
        credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT),
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      }).getClient();
    }
    if (process.env.SERVICE_ACCOUNT_KEY_PATH) {
      return new google.auth.GoogleAuth({
        keyFile: process.env.SERVICE_ACCOUNT_KEY_PATH,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      }).getClient();
    }
    throw new Error("No credentials provided");
  } catch (error) {
    console.error("Auth error:", error);
    throw error;
  }
}

async function getSheetsContext() {
  const spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error("Spreadsheet ID missing");
  }

  const client = await getAuthClient();
  const sheets = google.sheets({ version: "v4", auth: client });

  return { spreadsheetId, sheets };
}

function ensureValuesMatrix(values) {
  if (!values || !Array.isArray(values)) {
    throw new Error("Invalid values");
  }
}

app.post("/api/sheets/batch-update", async (req, res) => {
  try {
    const { updates, valueInputOption = "USER_ENTERED" } = req.body;

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: "Invalid updates payload" });
    }

    const data = updates.map((update) => {
      if (!update || typeof update.range !== "string") {
        throw new Error("Each update must include a range");
      }

      ensureValuesMatrix(update.values);

      return {
        range: update.range,
        values: update.values,
      };
    });

    const { spreadsheetId, sheets } = await getSheetsContext();
    const response = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      resource: {
        valueInputOption,
        data,
      },
    });

    clearActivityCache();
    res.json(response.data);
  } catch (error) {
    console.error("Error batch updating data:", error);
    res
      .status(500)
      .json({ error: "Batch update failed", details: error.message });
  }
});

app.post("/api/analytics/rebuild", async (req, res) => {
  try {
    const { spreadsheetId, sheets } = await getSheetsContext();

    const [orderResponse, customerResponse, productResponse, ledgerResponse] =
      await Promise.all([
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: RAW_RANGES.orders,
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: RAW_RANGES.customers,
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: RAW_RANGES.products,
        }),
        sheets.spreadsheets.values.get({
          spreadsheetId,
          range: RAW_RANGES.ledger,
        }),
      ]);

    const workbook = buildAnalyticsWorkbook({
      orderValues: orderResponse.data.values || [],
      customerValues: customerResponse.data.values || [],
      productValues: productResponse.data.values || [],
      ledgerValues: ledgerResponse.data.values || [],
      snapshotMoment: new Date(),
    });

    const sheetNames = Object.values(OUTPUT_SHEETS);
    await sheets.spreadsheets.values.batchClear({
      spreadsheetId,
      resource: {
        ranges: sheetNames.map((sheetName) => `${sheetName}!A:ZZ`),
      },
    });

    const response = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      resource: {
        valueInputOption: "USER_ENTERED",
        data: Object.entries(workbook).map(([sheetName, values]) => ({
          range: `${sheetName}!A1`,
          values,
        })),
      },
    });

    clearActivityCache();
    res.json({
      rebuiltSheets: sheetNames,
      updatedCells: response.data.totalUpdatedCells || 0,
      updatedRows: response.data.totalUpdatedRows || 0,
      updatedColumns: response.data.totalUpdatedColumns || 0,
      updatedRanges: response.data.totalUpdatedSheets || 0,
    });
  } catch (error) {
    console.error("Error rebuilding analytics workbook:", error);
    res
      .status(500)
      .json({ error: "Analytics rebuild failed", details: error.message });
  }
});

async function getOptionalSheetValues(sheets, spreadsheetId, range) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });

    return response.data.values || [];
  } catch (error) {
    console.warn(`Optional sheet range unavailable: ${range}`, error.message);
    return [];
  }
}

app.get("/api/activity/recent", async (req, res) => {
  try {
    const requestedLimit = Number.parseInt(req.query.limit || "10", 10);
    const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 10, 25));
    const refresh = req.query.refresh === "1" || req.query.refresh === "true";
    const cacheKey = `recent:${limit}`;
    const now = Date.now();

    if (
      !refresh &&
      activityCache.payload &&
      activityCache.key === cacheKey &&
      activityCache.expiresAt > now
    ) {
      return res.json({
        ...activityCache.payload,
        cached: true,
      });
    }

    const { spreadsheetId, sheets } = await getSheetsContext();
    const [
      orderResponse,
      customerResponse,
      productResponse,
      ledgerResponse,
      attentionValues,
    ] = await Promise.all([
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: RAW_RANGES.orders,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: RAW_RANGES.customers,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: RAW_RANGES.products,
      }),
      sheets.spreadsheets.values.get({
        spreadsheetId,
        range: RAW_RANGES.ledger,
      }),
      getOptionalSheetValues(
        sheets,
        spreadsheetId,
        `${OUTPUT_SHEETS.attentionQueue}!A1:K`
      ),
    ]);

    const activities = buildRecentActivityFeed({
      orderValues: orderResponse.data.values || [],
      customerValues: customerResponse.data.values || [],
      productValues: productResponse.data.values || [],
      ledgerValues: ledgerResponse.data.values || [],
      attentionValues,
      limit,
    });
    const payload = {
      activities,
      generated_at: new Date().toISOString(),
      source: "derived",
    };

    activityCache.key = cacheKey;
    activityCache.payload = payload;
    activityCache.expiresAt = now + ACTIVITY_CACHE_TTL_MS;

    res.json({
      ...payload,
      cached: false,
    });
  } catch (error) {
    console.error("Error building recent activity:", error);
    res
      .status(500)
      .json({ error: "Recent activity failed", details: error.message });
  }
});

// GET spreadsheet data
app.get("/api/sheets/:range", async (req, res) => {
  try {
    const { spreadsheetId, sheets } = await getSheetsContext();
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: req.params.range,
    });

    res.json(response.data);
  } catch (error) {
    console.error("Error fetching data:", error);
    res
      .status(500)
      .json({ error: "Failed to retrieve data", details: error.message });
  }
});

// Update spreadsheet data
app.put("/api/sheets/:range", async (req, res) => {
  try {
    const { values } = req.body;
    if (!values || !Array.isArray(values))
      return res.status(400).json({ error: "Invalid values" });
    const { spreadsheetId, sheets } = await getSheetsContext();
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: req.params.range,
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });

    clearActivityCache();
    res.json(response.data);
  } catch (error) {
    console.error("Error updating data:", error);
    res.status(500).json({ error: "Update failed", details: error.message });
  }
});

// NEW: Add this endpoint for append operations
app.post("/api/sheets/:sheet", async (req, res) => {
  try {
    const { values, operation } = req.body;
    const sheet = req.params.sheet;
    if (!values || !Array.isArray(values))
      return res.status(400).json({ error: "Invalid values" });
    const { spreadsheetId, sheets } = await getSheetsContext();

    if (operation === "append") {
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: sheet,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        resource: { values },
      });

      clearActivityCache();
      res.json(response.data);
    } else {
      return res.status(400).json({ error: "Invalid operation" });
    }
  } catch (error) {
    console.error("Error appending data:", error);
    res.status(500).json({ error: "Append failed", details: error.message });
  }
});

app.listen(port, () => console.log(`Server running on port ${port}`));
