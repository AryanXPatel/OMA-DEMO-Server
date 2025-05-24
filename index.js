const express = require("express");
const { google } = require("googleapis");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

app.use(
  cors({
    origin: ["https://aryanxpatel.github.io", "http://localhost:19006"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
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

// GET spreadsheet data
app.get("/api/sheets/:range", async (req, res) => {
  try {
    const spreadsheetId = process.env.SPREADSHEET_ID;
    if (!spreadsheetId)
      return res.status(500).json({ error: "Spreadsheet ID missing" });

    const client = await getAuthClient();
    google.options({ auth: client });

    const response = await google.sheets("v4").spreadsheets.values.get({
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
    const spreadsheetId = process.env.SPREADSHEET_ID;

    if (!spreadsheetId)
      return res.status(500).json({ error: "Spreadsheet ID missing" });
    if (!values || !Array.isArray(values))
      return res.status(400).json({ error: "Invalid values" });

    const client = await getAuthClient();
    google.options({ auth: client });

    const response = await google.sheets("v4").spreadsheets.values.update({
      spreadsheetId,
      range: req.params.range,
      valueInputOption: "USER_ENTERED",
      resource: { values },
    });

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
    const spreadsheetId = process.env.SPREADSHEET_ID;
    const sheet = req.params.sheet;

    if (!spreadsheetId)
      return res.status(500).json({ error: "Spreadsheet ID missing" });
    if (!values || !Array.isArray(values))
      return res.status(400).json({ error: "Invalid values" });

    const client = await getAuthClient();
    google.options({ auth: client });

    if (operation === "append") {
      // Use the append endpoint
      const response = await google.sheets("v4").spreadsheets.values.append({
        spreadsheetId,
        range: sheet,
        valueInputOption: "USER_ENTERED",
        insertDataOption: "INSERT_ROWS",
        resource: { values },
      });

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
