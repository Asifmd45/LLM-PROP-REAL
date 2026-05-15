import "dotenv/config";
import express from "express";
import axios from "axios";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { connectMongo, getMongoStatus } from "./db.js";
import Prediction from "./models/Prediction.js";
import User from "./models/User.js";
import { requireAuth } from "./middleware/auth.js";

const app = express();
const port = process.env.PORT || 5000;
const fastApiBaseUrl =
  process.env.FASTAPI_URL ||
  process.env.FASTAPI_BASE_URL ||
  "http://127.0.0.1:8000";

app.use(express.json());
// allow frontend dev host (or set CLIENT_ORIGIN env) — adjust for production
const clientOrigin = process.env.CLIENT_ORIGIN || "*";
app.use(cors({ origin: clientOrigin }));

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "express-server",
    mongo: getMongoStatus(),
  });
});

app.post("/api/auth/signup", async (req, res) => {
  try {
    const name = req.body?.name?.trim();
    const email = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password;

    if (!name || !email || !password) {
      return res.status(400).json({
        detail: "Name, email, and password are required",
      });
    }

    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      return res.status(409).json({
        detail: "User already exists with this email",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    return res.status(201).json({
      message: "Signup successful",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (_error) {
    return res.status(500).json({
      detail: "Could not complete signup",
    });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try {
    const email = req.body?.email?.trim().toLowerCase();
    const password = req.body?.password;

    if (!email || !password) {
      return res.status(400).json({
        detail: "Email and password are required",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        detail: "Invalid email or password",
      });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        detail: "Invalid email or password",
      });
    }

    const jwtSecret = process.env.JWT_SECRET || "dev_jwt_secret_change_me";
    const token = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        name: user.name,
      },
      jwtSecret,
      { expiresIn: "7d" }
    );

    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (_error) {
    return res.status(500).json({
      detail: "Could not complete login",
    });
  }
});

app.post("/api/predict", requireAuth, async (req, res) => {
  try {
    const inputText = req.body?.text?.trim();
    if (!inputText) {
      return res.status(400).json({ detail: "Text input is required" });
    }

    const response = await fetch(`${fastApiBaseUrl}/predict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: inputText }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(response.status).json({
        detail: data.detail || "Prediction request failed",
      });
    }

    const savedPrediction = await Prediction.create({
      userId: req.user.userId,
      inputText,
      prediction: {
        is_gap_direct: data.is_gap_direct,
        energy_per_atom: data.energy_per_atom,
        formation_energy_per_atom: data.formation_energy_per_atom,
        band_gap: data.band_gap,
        e_above_hull: data.e_above_hull,
        volume: data.volume,
      },
    });

    return res.json({
      ...data,
      predictionId: savedPrediction._id,
      createdAt: savedPrediction.createdAt,
    });
  } catch (_error) {
    return res.status(502).json({
      detail: "Could not complete prediction pipeline",
    });
  }
});

app.get("/api/predictions", requireAuth, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);

    const history = await Prediction.find({ userId: req.user.userId }, { __v: 0 })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return res.json(history);
  } catch (_error) {
    return res.status(500).json({
      detail: "Could not fetch prediction history",
    });
  }
});

app.delete("/api/predictions", requireAuth, async (req, res) => {
  try {
    const result = await Prediction.deleteMany({ userId: req.user.userId });

    return res.json({
      message: "Prediction history cleared",
      deletedCount: result.deletedCount ?? 0,
    });
  } catch (_error) {
    return res.status(500).json({
      detail: "Could not clear prediction history",
    });
  }
});

// Proxy Materials Project description lookup to avoid browser CORS and hide API key
app.post("/api/mp/description", async (req, res) => {
  try {
    // normalize unicode subscripts/superscripts to ASCII digits
    const rawFormula = String(req.body?.formula || "").trim();
    const subs = { '\u2080':'0','\u2081':'1','\u2082':'2','\u2083':'3','\u2084':'4','\u2085':'5','\u2086':'6','\u2087':'7','\u2088':'8','\u2089':'9' };
    const sups = { '\u2070':'0','\u00B9':'1','\u00B2':'2','\u00B3':'3','\u2074':'4','\u2075':'5','\u2076':'6','\u2077':'7','\u2078':'8','\u2079':'9' };
    const formula = Array.from(rawFormula).map(ch => subs[ch] || sups[ch] || ch).join('');
    if (!formula) return res.status(400).json({ error: "formula is required" });

    const mpKey = process.env.MP_API_KEY || process.env.REACT_APP_MP_API_KEY;
    if (!mpKey) return res.status(500).json({ error: "Materials Project API key not configured on server" });

    const headers = {
      "x-api-key": mpKey,
      Accept: "application/json",
      "User-Agent": "LLMProp/1.0 (+https://materialsproject.org)",
    };

    // 1) search summary by formula
    const summaryResp = await axios.get("https://api.materialsproject.org/materials/summary/", {
      params: { formula },
      headers,
      timeout: 10000,
    });

    const candidates = summaryResp?.data?.data || [];
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return res.status(404).json({ error: `No Materials Project entry found for ${formula}` });
    }

    const normalizedFormula = formula.replace(/\s+/g, "").toLowerCase();
    const match = candidates.find((item) => String(item?.formula_pretty || "").replace(/\s+/g, "").toLowerCase() === normalizedFormula) || candidates[0];
    const materialId = match?.material_id;
    if (!materialId) return res.status(404).json({ error: `No material_id found for ${formula}` });

    // 2) fetch robocrys details
    const roboResp = await axios.get("https://api.materialsproject.org/materials/robocrys/", {
      params: { material_ids: materialId, _all_fields: true },
      headers,
      timeout: 10000,
    });

    const record = roboResp?.data?.data?.[0] || null;
    const description = record?.description ?? null;
    if (!description) return res.status(404).json({ error: "Materials Project did not return a description for this formula" });

    return res.json({ description });
  } catch (err) {
    console.error("MP proxy error:", err?.message || err);
    return res.status(500).json({ error: "Materials Project fetch failed" });
  }
});

async function startServer() {
  try {
    await connectMongo();
    console.log("MongoDB connected");

    app.listen(port, () => {
      console.log(`Express server listening on http://127.0.0.1:${port}`);
    });
  } catch (error) {
    console.error("Failed to start Express server:", error.message);
    process.exit(1);
  }
}

startServer();
