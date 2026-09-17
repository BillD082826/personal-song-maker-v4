import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import OpenAI from "openai";
import pg from "pg";
import crypto from "crypto";
import QRCode from "qrcode";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "child_process";

const app = express();
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));
const port = process.env.PORT || 3000;
const PAYPAL_ENVIRONMENT = (process.env.PAYPAL_ENVIRONMENT || "sandbox").toLowerCase();
const PAYPAL_BASE_URL = PAYPAL_ENVIRONMENT === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "https://personal-song-maker-v5-test.onrender.com").replace(/\/+$/, "");

function createPreviewClip(audioBuffer, startSeconds = 15, durationSeconds = 30) {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath, [
      "-hide_banner",
      "-loglevel", "error",
      "-ss", String(startSeconds),
      "-i", "pipe:0",
      "-t", String(durationSeconds),
      "-f", "mp3",
      "-codec:a", "libmp3lame",
      "-b:a", "192k",
      "pipe:1"
    ]);

    const chunks = [];
    let errorText = "";

    ffmpeg.stdout.on("data", chunk => chunks.push(chunk));
    ffmpeg.stderr.on("data", chunk => {
      errorText += chunk.toString();
    });

    ffmpeg.on("error", reject);

    ffmpeg.stdin.on("error", error => {
      if (error.code !== "EPIPE") {
        reject(error);
      }
    });

    ffmpeg.on("close", code => {
      if (code !== 0) {
        return reject(new Error(errorText || `FFmpeg exited with code ${code}.`));
      }

      resolve(Buffer.concat(chunks));
    });

    ffmpeg.stdin.end(audioBuffer);
  });
}

function logError(label, error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(label, message);
}

function isValidReportDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function requireAdmin(req, res, next) {
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
const authHeader = req.headers.authorization || "";
if (!username || !password) {
return res.status(503).json({ error: "Admin login is not configured." });
}
if (!authHeader.startsWith("Basic ")) {
res.set("WWW-Authenticate", 'Basic realm="StorySong Admin"');
return res.status(401).json({ error: "Admin login required." });
}
const encoded = authHeader.slice(6);
const decoded = Buffer.from(encoded, "base64").toString("utf8");
const separator = decoded.indexOf(":");
if (separator === -1) {
res.set("WWW-Authenticate", 'Basic realm="StorySong Admin"');
return res.status(401).json({ error: "Invalid admin login." });
}
const suppliedUsername = decoded.slice(0, separator);
const suppliedPassword = decoded.slice(separator + 1);
if (suppliedUsername !== username || suppliedPassword !== password) {
res.set("WWW-Authenticate", 'Basic realm="StorySong Admin"');
return res.status(401).json({ error: "Invalid admin login." });
}
return next();
}


const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many order attempts. Please wait a few minutes and try again." }
});

const previewLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many preview attempts. Please wait a few minutes and try again." }
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many payment attempts. Please wait a few minutes and try again." }
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "Too many admin requests. Please wait a few minutes and try again." }
});

app.use("/api/admin", adminLimiter);

app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const { Pool } = pg;
const pool = process.env.DATABASE_URL
  ? new Pool({ connectionString: process.env.DATABASE_URL })
  : null;

async function initializeDatabase() {
  if (!pool) {
    console.log("DATABASE_URL is not set; order database is disabled.");
    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_name TEXT NOT NULL,
      email TEXT NOT NULL,
      person TEXT NOT NULL,
      occasion TEXT NOT NULL,
      style TEXT NOT NULL,
      mood TEXT NOT NULL,
      story TEXT NOT NULL,
      message TEXT,
      status TEXT NOT NULL DEFAULT 'New',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_settings (
      setting_key TEXT PRIMARY KEY,
      setting_value TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS customer_marketing_preferences (
      email TEXT PRIMARY KEY,
      customer_name TEXT,
      unsubscribe_token TEXT UNIQUE,
      marketing_opt_out BOOLEAN NOT NULL DEFAULT FALSE,
      opted_out_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS marketing_email_history (
      id BIGSERIAL PRIMARY KEY,
      recipient_email TEXT NOT NULL,
      recipient_name TEXT,
      subject TEXT NOT NULL,
      message TEXT NOT NULL,
      send_status TEXT NOT NULL DEFAULT 'sent',
      provider_message_id TEXT,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reviews (
      id BIGSERIAL PRIMARY KEY,
      order_id TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
      review_text TEXT NOT NULL,
      display_name TEXT,
      approved BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    INSERT INTO store_settings (setting_key, setting_value)
    VALUES
      ('song_price', '19.99'),
      ('ordering_open', 'true'),
      ('turnaround_message', 'Your custom StorySong will typically be ready within 2–3 days.'),
      ('announcement_enabled', 'false'),
      ('announcement_message', ''),
      ('reviews_enabled', 'true')
    ON CONFLICT (setting_key) DO NOTHING
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sellers (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      referral_code TEXT NOT NULL UNIQUE,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vendors (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      contact_name TEXT,
      email TEXT,
      phone TEXT,
      website_url TEXT,
      address_line1 TEXT,
      address_line2 TEXT,
      city TEXT,
      state_region TEXT,
      postal_code TEXT,
      country TEXT,
      account_reference TEXT,
      notes TEXT,
      active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS accounts_payable (
      id BIGSERIAL PRIMARY KEY,
      vendor_id BIGINT REFERENCES vendors(id) ON DELETE SET NULL,
      category TEXT,
      description TEXT NOT NULL,
      amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
      due_date DATE,
      status TEXT NOT NULL DEFAULT 'Unpaid'
        CHECK (status IN ('Unpaid', 'Paid')),
      paid_date DATE,
      reference_number TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS generation_costs (
      id BIGSERIAL PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      generation_type TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT,
      version_number INTEGER,
      duration_seconds INTEGER,
      input_tokens INTEGER,
      output_tokens INTEGER,
      input_rate_per_million NUMERIC(10,6),
      output_rate_per_million NUMERIC(10,6),
      rate_per_minute NUMERIC(10,6),
      estimated_cost NUMERIC(12,6) NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS seller_id BIGINT REFERENCES sellers(id) ON DELETE SET NULL
  `);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) NOT NULL DEFAULT 20.00`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS email TEXT`);
  await pool.query(`ALTER TABLE sellers ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE`);

  const sellersMissingPortalToken = await pool.query(`
    SELECT id
    FROM sellers
    WHERE portal_token IS NULL
  `);

  for (const seller of sellersMissingPortalToken.rows) {
    await pool.query(
      `
        UPDATE sellers
        SET portal_token = $1
        WHERE id = $2
      `,
      [crypto.randomBytes(32).toString("hex"), seller.id]
    );
  }
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_commission_rate NUMERIC(5,2)`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS seller_commission_amount NUMERIC(10,2)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS seller_payouts (
      id BIGSERIAL PRIMARY KEY,
      seller_id BIGINT NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
      amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
      paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      payment_method TEXT,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS seller_payout_id BIGINT REFERENCES seller_payouts(id) ON DELETE SET NULL
  `);

  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`
    UPDATE orders o
    SET
      seller_commission_rate = s.commission_rate,
      seller_commission_amount = ROUND((o.price_amount * s.commission_rate / 100)::numeric, 2)
    FROM sellers s
    WHERE o.seller_id = s.id
      AND o.paid_at IS NOT NULL
      AND o.is_test = FALSE
      AND o.status = 'Delivered'
      AND o.seller_commission_rate IS NULL
      AND o.seller_commission_amount IS NULL
  `);

  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_order_id TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS song_title TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS lyrics TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS music_data BYTEA`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS music_content_type TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_token TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS preview_token TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_amount NUMERIC(10,2)`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS selected_version_number INTEGER`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS includes_extra_version BOOLEAN NOT NULL DEFAULT FALSE`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS extra_version_number INTEGER`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS extra_version_price NUMERIC(10,2) NOT NULL DEFAULT 0.00`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS vocal_gender TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS vocal_style TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tempo TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS duet TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS instruments TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS music_generation_started_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS elevenlabs_song_id TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS song_length INTEGER`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS song_versions (
      id BIGSERIAL PRIMARY KEY,
      order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      song_title TEXT,
      lyrics TEXT,
      music_style TEXT,
      music_data BYTEA,
      music_content_type TEXT,
      elevenlabs_song_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (order_id, version_number)
    )
  `);

  await pool.query(`ALTER TABLE song_versions ADD COLUMN IF NOT EXISTS music_style TEXT`);

  await pool.query(`UPDATE orders SET price_amount = 20.00 WHERE price_amount IS NULL`);

  const missingTokens = await pool.query(
    `SELECT id FROM orders WHERE delivery_token IS NULL`
  );

  for (const row of missingTokens.rows) {
    const token = crypto.randomBytes(32).toString("hex");
    await pool.query(
      `UPDATE orders SET delivery_token = $1 WHERE id = $2`,
      [token, row.id]
    );
  }

  const missingPreviewTokens = await pool.query(
    `SELECT id FROM orders WHERE preview_token IS NULL OR preview_token = ''`
  );

  for (const row of missingPreviewTokens.rows) {
    const token = crypto.randomBytes(32).toString("hex");
    await pool.query(
      `UPDATE orders SET preview_token = $1 WHERE id = $2`,
      [token, row.id]
    );
  }

  await pool.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS orders_delivery_token_idx
     ON orders (delivery_token)
     WHERE delivery_token IS NOT NULL`
  );

  console.log("Orders database ready");
}

initializeDatabase().catch((error) => {
  logError("Database initialization error:", error);
});

async function getPayPalAccessToken() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    throw new Error("PayPal credentials are not configured.");
  }

  const auth = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString("base64");

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials"
  });

  const data = await response.json();
  if (!response.ok) {
    console.error("PayPal token error:", response.status);
    throw new Error("Could not authenticate with PayPal.");
  }
  return data.access_token;
}

app.get("/api/paypal/config", async (_req, res) => {
  if (!process.env.PAYPAL_CLIENT_ID) {
    return res.status(503).json({ error: "PayPal is not configured." });
  }

  let songPrice = "19.99";

  if (pool) {
    try {
      const result = await pool.query(
        `SELECT setting_value FROM store_settings WHERE setting_key = 'song_price'`
      );
      songPrice = result.rows[0]?.setting_value || "19.99";
    } catch (error) {
      logError("Could not load PayPal store price:", error);
    }
  }
  res.json({
    clientId: process.env.PAYPAL_CLIENT_ID,
    currency: "USD",
    amount: songPrice,
    sandbox: PAYPAL_ENVIRONMENT !== "live"
  });
});

app.post("/api/paypal/create-order", paymentLimiter, async (req, res) => {
  try {
    const { localOrderId } = req.body;
    if (!localOrderId || !pool) {
      return res.status(400).json({ error: "A valid song order is required." });
    }

    const result = await pool.query(
      "SELECT id, status, price_amount FROM orders WHERE id = $1",
      [localOrderId]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "Song order not found." });
    }
    if (result.rows[0].status !== "New") {
      return res.status(409).json({ error: "This order can no longer start a new payment." });
    }

    const orderingResult = await pool.query(
      `SELECT setting_value FROM store_settings WHERE setting_key = 'ordering_open'`
    );
    const orderingOpen = (orderingResult.rows[0]?.setting_value ?? "true") === "true";

    if (!orderingOpen) {
      return res.status(503).json({
        error: "StorySong ordering is temporarily paused. Payment cannot be started right now."
      });
    }

    const accessToken = await getPayPalAccessToken();
    const paypalResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `create-${localOrderId}`
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: localOrderId,
          custom_id: localOrderId,
          description: "StorySong - Custom Song",
          amount: {
            currency_code: "USD",
            value: Number(result.rows[0].price_amount || 20).toFixed(2)
          }
        }]
      })
    });

    const data = await paypalResponse.json();
    if (!paypalResponse.ok) {
      console.error("PayPal create-order error:", paypalResponse.status);
      return res.status(paypalResponse.status).json({
        error: "PayPal could not create the payment."
      });
    }

    await pool.query(
      "UPDATE orders SET paypal_order_id = $1 WHERE id = $2",
      [data.id, localOrderId]
    );

    res.json({ id: data.id });
  } catch (error) {
    logError("PayPal create error:", error);
    res.status(500).json({ error: error.message || "Could not create PayPal order." });
  }
});

app.post("/api/paypal/capture-order/:paypalOrderId", paymentLimiter, async (req, res) => {
  try {
    const { paypalOrderId } = req.params;
    const { localOrderId } = req.body;
    if (!paypalOrderId || !localOrderId || !pool) {
      return res.status(400).json({ error: "Payment information is incomplete." });
    }

    const orderResult = await pool.query(
      "SELECT id, status, paypal_order_id, price_amount FROM orders WHERE id = $1",
      [localOrderId]
    );
    if (!orderResult.rowCount) {
      return res.status(404).json({ error: "Song order not found." });
    }
    if (orderResult.rows[0].paypal_order_id !== paypalOrderId) {
      return res.status(400).json({ error: "PayPal order does not match song order." });
    }
    if (orderResult.rows[0].status === "Paid") {
      return res.json({ ok: true, status: "COMPLETED", localOrderId });
    }

    const accessToken = await getPayPalAccessToken();
    const paypalResponse = await fetch(
      `${PAYPAL_BASE_URL}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": `capture-${paypalOrderId}`
        }
      }
    );

    const data = await paypalResponse.json();
    if (!paypalResponse.ok) {
      console.error("PayPal capture error:", paypalResponse.status);
      return res.status(paypalResponse.status).json({
        error: "PayPal could not capture the payment."
      });
    }

    if (data.status !== "COMPLETED") {
      return res.status(400).json({ error: `Payment status is ${data.status}.` });
    }

    const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;
    const capture = data.purchase_units?.[0]?.payments?.captures?.[0] || null;
    const capturedAmount = capture?.amount?.value || null;
    const capturedCurrency = capture?.amount?.currency_code || null;
    const expectedAmount = Number(orderResult.rows[0].price_amount).toFixed(2);

    if (!capture || capturedCurrency !== "USD" || Number(capturedAmount).toFixed(2) !== expectedAmount) {
      console.error("PayPal amount verification failed:", { localOrderId, expectedAmount, capturedAmount, capturedCurrency });
      return res.status(400).json({ error: "Captured payment amount does not match the StorySong order." });
    }

    await pool.query(
      `UPDATE orders
       SET status = CASE WHEN music_data IS NOT NULL THEN 'Ready' ELSE 'Paid' END,
           paypal_capture_id = $1,
           paid_at = NOW()
       WHERE id = $2`,
      [captureId, localOrderId]
    );

    console.log("Song order paid:", localOrderId, "PayPal:", paypalOrderId);
    res.json({ ok: true, status: data.status, localOrderId, captureId });
  } catch (error) {
    logError("PayPal capture error:", error);
    res.status(500).json({ error: error.message || "Could not capture PayPal payment." });
  }
});

app.post("/api/song", requireAdmin, adminLimiter, async (req, res) => {
  try {
    const {
      person, occasion, story, music, mood,
      vocalGender, vocalStyle, tempo, duet, instruments,
      message, mentions, orderId
    } = req.body;

    if (!person || !occasion || !story || !music || !mood) {
      return res.status(400).json({ error: "Please complete all required fields." });
    }

    const prompt = `Write a complete, original personalized song.\n\nPerson: ${person}\nOccasion: ${occasion}\nStory / memories: ${story}\nMusic era / style: ${music}\nMood: ${mood}\nLead vocal preference: ${vocalGender || "Any"}\nVocal style: ${vocalStyle || "Warm and expressive"}\nTempo: ${tempo || "Medium"}\nDuet preference: ${duet || "No duet"}\nInstrument preferences: ${instruments || "No preference"}\nSpecial message: ${message || "None"}\nNames / people to mention: ${mentions || "None"}\n\nRequirements:\n- Write an original song inspired by the requested style, without copying any existing song or artist.\n- Include a memorable song title on the first line.\n- Use clear section headings such as [Verse 1], [Chorus], [Verse 2], and [Bridge] when appropriate.\n- Make the personal details feel natural and memorable.\n- If a duet is requested, write natural alternating or shared vocal parts where appropriate.\n- Match the lyrical rhythm and energy to the requested tempo.\n- Return only the song, with the title on the first line followed by clear section headings.`;

    const response = await openai.responses.create({ model: "gpt-5.6-luna", input: prompt });

    if (orderId) {
      const inputTokens = Number(response.usage?.input_tokens || 0);
      const outputTokens = Number(response.usage?.output_tokens || 0);
      const openAiInputRatePerMillion = 0.20;
      const openAiOutputRatePerMillion = 1.20;
      const openAiEstimatedCost =
        (inputTokens / 1000000) * openAiInputRatePerMillion +
        (outputTokens / 1000000) * openAiOutputRatePerMillion;

      try {
        await pool.query(
          `INSERT INTO generation_costs
           (order_id, generation_type, provider, model, input_tokens, output_tokens,
            input_rate_per_million, output_rate_per_million, estimated_cost)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            orderId,
            "lyrics",
            "OpenAI",
            "gpt-5.6-luna",
            inputTokens,
            outputTokens,
            openAiInputRatePerMillion,
            openAiOutputRatePerMillion,
            openAiEstimatedCost
          ]
        );
      } catch (costError) {
        logError("Admin generic lyrics cost tracking error:", costError);
      }
    }

    const song = response.output_text;
    const firstLine = (song || "").split(/\r?\n/).map(s => s.trim()).find(Boolean) || "Personal Song";
    const title = firstLine.replace(/^#{1,6}\s*/, "").replace(/^\*+|\*+$/g, "").replace(/^title\s*:\s*/i, "").trim() || "Personal Song";
    res.json({ title, song });
  } catch (error) {
    logError("Song generation error:", error);
    res.status(500).json({ error: error?.message || "Could not create lyrics." });
  }
});

app.post("/api/music", requireAdmin, adminLimiter, async (req, res) => {
  try {
    const { lyrics, musicStyle, mood, vocalGender, vocalStyle, tempo, duet, instruments, lengthMs = 90000 } = req.body;
    if (!lyrics) return res.status(400).json({ error: "Create lyrics first." });
    const safeLength = Math.max(3000, Math.min(600000, Number(lengthMs) || 90000));
    const musicPrompt = `Create a fully produced original song with vocals using these lyrics.\n\nSTYLE: ${musicStyle || "pop"}\nMOOD: ${mood || "happy"}\nTEMPO: ${tempo || "Medium"}\nLEAD VOCAL: ${vocalGender || "Any"}; ${vocalStyle || "warm and expressive"}\nDUET: ${duet || "No duet"}\nINSTRUMENT PREFERENCES: ${instruments || "No preference"}\n\nARRANGEMENT: full, polished production with a catchy original melody. Feature the requested instruments naturally when possible.\n\nLYRICS:\n${lyrics}\n\nDo not imitate a specific living artist or copy an existing song.`;
    const elevenResponse = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_48000_192", {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: musicPrompt.slice(0, 4100), music_length_ms: safeLength, model_id: "music_v2", force_instrumental: false })
    });
    if (!elevenResponse.ok) {
      console.error("ElevenLabs error:", elevenResponse.status);
      return res.status(elevenResponse.status).json({ error: "Music generation failed." });
    }
    const arrayBuffer = await elevenResponse.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    logError("Music generation error:", error);
    res.status(500).json({ error: error?.message || "Could not create music." });
  }
});

app.post("/api/order", orderLimiter, async (req, res) => {
  try {
    const { customerName, email, person, occasion, style, songLength, vocalGender, vocalStyle, tempo, duet, instruments, mood, story, message, referralCode } = req.body;
    if (
      !customerName || !email || !person || !occasion || !style || !mood || !story ||
      [customerName, email, person, occasion, style, mood, story].some(
        value => typeof value === "string" && !value.trim()
      )
    ) {
      return res.status(400).json({ error: "Please complete all required order fields." });
    }
    const stringFields = [
      customerName, email, person, occasion, style, vocalGender,
      vocalStyle, tempo, duet, mood, story, message, referralCode
    ];

    if (stringFields.some(value => value !== undefined && value !== null && typeof value !== "string")) {
      return res.status(400).json({ error: "One or more order fields have an invalid type." });
    }

    if (instruments !== undefined && !Array.isArray(instruments)) {
      return res.status(400).json({ error: "Instrument selections must be provided as a list." });
    }

    if (Array.isArray(instruments) && instruments.some(value => typeof value !== "string")) {
      return res.status(400).json({ error: "One or more instrument selections are invalid." });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }

    if (
      String(customerName).length > 100 ||
      String(email).length > 254 ||
      String(person).length > 100 ||
      String(vocalStyle || "").length > 100 ||
      (Array.isArray(instruments) ? instruments.join(", ").length : String(instruments || "").length) > 250 ||
      String(story).length > 4000 ||
      String(message || "").length > 1000 ||
      String(referralCode || "").length > 30
    ) {
      return res.status(400).json({ error: "One or more order fields are too long." });
    }
    const allowedOccasions = new Set([
      "Birthday", "Anniversary", "Wedding", "Retirement", "Graduation",
      "Mother's Day", "Father's Day", "Christmas", "Valentine's Day",
      "Congratulations", "Thank You", "Memorial / Tribute", "Just for Fun", "Other"
    ]);

    const allowedStyles = new Set([
      "1950s Rock & Roll", "1960s Pop / Rock", "1970s Classic Rock",
      "1980s Pop", "1990s Pop / Rock", "Classic Rock", "Country",
      "Modern Country", "Motown-inspired Soul", "Blues", "Jazz",
      "R&B / Soul", "Pop", "Rock", "Folk / Acoustic", "Ballad",
      "Dance / Party", "Other"
    ]);

    const allowedMoods = new Set([
      "Happy / Upbeat / Fun", "Heartfelt / Emotional", "Romantic",
      "Funny / Playful", "Energetic / Exciting", "Warm / Nostalgic",
      "Inspirational", "Celebratory", "Relaxed / Easygoing", "Soulful",
      "Powerful / Dramatic"
    ]);

    const allowedVocalGenders = new Set(["Any", "Male", "Female"]);
    const allowedTempos = new Set(["Slow", "Medium", "Upbeat", "Fast"]);
    const allowedDuets = new Set([
      "No duet", "Male and female duet", "Two male voices",
      "Two female voices", "Any two contrasting voices"
    ]);

    const allowedSongLengths = new Set([90, 120, 150]);

    const validOccasion =
      allowedOccasions.has(occasion) ||
      (typeof occasion === "string" && occasion.trim().length > 0);

    const validStyle =
      allowedStyles.has(style) ||
      (typeof style === "string" && style.trim().length > 0);

    if (
      !validOccasion ||
      !validStyle ||
      !allowedSongLengths.has(Number(songLength)) ||
      !allowedMoods.has(mood) ||
      !allowedVocalGenders.has(vocalGender || "Any") ||
      !allowedTempos.has(tempo || "Medium") ||
      !allowedDuets.has(duet || "No duet")
    ) {
      return res.status(400).json({ error: "One or more order selections are invalid." });
    }

    if (!pool) return res.status(503).json({ error: "Order database is not configured." });

    const orderingResult = await pool.query(
      `SELECT setting_value FROM store_settings WHERE setting_key = 'ordering_open'`
    );
    const orderingOpen = (orderingResult.rows[0]?.setting_value ?? "true") === "true";

    if (!orderingOpen) {
      return res.status(503).json({
        error: "StorySong ordering is temporarily paused. Please check back soon."
      });
    }

    let sellerId = null;
    const normalizedReferralCode = String(referralCode || "").trim().toUpperCase();

    if (normalizedReferralCode) {
      const sellerResult = await pool.query(
        `
          SELECT id
          FROM sellers
          WHERE referral_code = $1
            AND active = TRUE
          LIMIT 1
        `,
        [normalizedReferralCode]
      );

      if (sellerResult.rows.length === 0) {
        return res.status(400).json({
          error: "That referral code is not valid or is no longer active."
        });
      }

      sellerId = sellerResult.rows[0].id;
    }

    const orderId = `SS-${Date.now()}`;
    const deliveryToken = crypto.randomBytes(32).toString("hex");
    const previewToken = crypto.randomBytes(32).toString("hex");

    const priceResult = await pool.query(
      `SELECT setting_value FROM store_settings WHERE setting_key = 'song_price'`
    );
    const songPrice = priceResult.rows[0]?.setting_value || "19.99";

    await pool.query(
      `INSERT INTO orders (id, customer_name, email, person, occasion, style, song_length, vocal_gender, vocal_style, tempo, duet, instruments, mood, story, message, status, delivery_token, preview_token, price_amount, seller_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'New',$16,$17,$18,$19)`,
      [orderId, customerName.trim(), email.trim(), person.trim(), occasion, style, Number(songLength), vocalGender || "Any", (vocalStyle || "Warm and expressive").trim(), tempo || "Medium", duet || "No duet", Array.isArray(instruments) ? instruments.map(value => value.trim()).join(", ") : "", mood, story.trim(), (message || "").trim(), deliveryToken, previewToken, songPrice, sellerId]
    );
    console.log("New song order saved:", orderId);
    res.json({ ok: true, orderId, previewToken, songPrice, message: "Your song order has been received." });
  } catch (error) {
    logError("Order error:", error);
    res.status(500).json({ error: "Could not submit the order." });
 }
});

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeEmailSubject(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").trim();
}

function createMarketingUnsubscribeToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function sendMarketingEmail(recipient) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Resend is not configured.");
  }

  const unsubscribeUrl = `${PUBLIC_BASE_URL}/api/marketing/unsubscribe?token=${encodeURIComponent(recipient.unsubscribe_token)}`;
  const safeCustomerName = escapeHtml(recipient.customer_name || "there");
  const safeSubject = sanitizeEmailSubject(recipient.subject);
  const safeMessage = escapeHtml(recipient.message).split("\n").join("<br>");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "StorySong <onboarding@resend.dev>",
      to: [recipient.email],
      subject: safeSubject,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#222;max-width:620px;margin:0 auto;padding:20px;">
          <p>Hi ${safeCustomerName},</p>
          <p>${safeMessage}</p>
          <p style="margin-top:32px;font-size:13px;color:#666;">
            You are receiving this email because you are a StorySong customer.
            <a href="${unsubscribeUrl}">Unsubscribe from StorySong marketing emails</a>.
          </p>
          <p style="font-size:13px;color:#666;">
            Transactional emails, such as song delivery messages, are not affected.
          </p>
        </div>
      `
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Could not send marketing email.");
  }

  return data;
}

async function sendDeliveryEmail(order) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Resend is not configured.");
  }

  const deliveryUrl = `${PUBLIC_BASE_URL}/delivery.html?token=${encodeURIComponent(order.delivery_token)}`;
  const safeCustomerName = escapeHtml(order.customer_name || "there");
  const safeSongTitle = escapeHtml(order.song_title || "Your Song");
  const safeOrderId = escapeHtml(order.id || "");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "StorySong <onboarding@resend.dev>",
      to: [order.email],
      subject: `Your personalized song is ready: ${sanitizeEmailSubject(order.song_title) || "Your Song"}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
          <h2>Your personalized song is ready!</h2>
          <p>Hi ${safeCustomerName},</p>
          <p>Your custom song <strong>${safeSongTitle}</strong> is ready to enjoy.</p>
          <p><strong>StorySong Order #: ${safeOrderId}</strong><br>
          Please keep this order number for your records and include it if you contact StorySong for assistance.</p>
          <p>
            <a href="${deliveryUrl}" style="display:inline-block;padding:12px 20px;background:#6d4aff;color:white;text-decoration:none;border-radius:8px;">
              Listen to Your Song
            </a>
          </p>
          <p>This private link gives you access to your song, lyrics, and MP3 download.</p>
          <p>Thank you for choosing StorySong!</p>
        </div>
      `
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Could not send email.");
  }

  return data;
}

app.post("/api/admin/orders/:id/send-email", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(
      `SELECT id, customer_name, email, song_title, delivery_token, status, (music_data IS NOT NULL) AS has_music
       FROM orders
       WHERE id = $1`,
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Order not found." });
    }

    const order = result.rows[0];

    if (!order.has_music || !["Ready", "Delivered"].includes(order.status)) {
      return res.status(400).json({ error: "Song must be ready before sending the delivery email." });
    }

    if (!order.email || !order.delivery_token) {
      return res.status(400).json({ error: "Customer email or delivery link is missing." });
    }

    const emailResult = await sendDeliveryEmail(order);

    res.json({
      ok: true,
      message: "Delivery email sent.",
      emailId: emailResult?.id || null
    });
  } catch (error) {
    logError("Delivery email error:", error);
    res.status(500).json({ error: error?.message || "Could not send delivery email." });
  }
});

async function sendSellerPortalEmail(seller) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Resend is not configured.");
  }

  const portalUrl = `${PUBLIC_BASE_URL}/seller.html#token=${seller.portal_token}`;
  const safeSellerName = escapeHtml(seller.name || "there");
  const safeReferralCode = escapeHtml(seller.referral_code || "");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "StorySong <onboarding@resend.dev>",
      to: [seller.email],
      subject: "Your StorySong Seller Portal",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
          <h2>StorySong Seller Portal</h2>
          <p>Hi ${safeSellerName},</p>
          <p>Your private StorySong Seller Portal is ready.</p>
          <p>
            <a href="${portalUrl}" style="display:inline-block;padding:12px 20px;background:#6d4aff;color:white;text-decoration:none;border-radius:8px;">
              Open Seller Portal
            </a>
          </p>
          <p>Your referral code is <strong>${safeReferralCode}</strong>.</p>
          <p>Inside your portal you can view your referral activity, commission totals, and payout history.</p>
          <p><strong>Please keep this private access link secure and do not share it.</strong></p>
          <p>If you lose the link, contact StorySong and we can resend it.</p>
          <p>StorySong — Every story deserves a song.</p>
        </div>
      `
    })
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || data?.error || "Could not send seller portal email.");
  }

  return data;
}

app.post("/api/admin/sellers/:id/send-portal-email", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const sellerId = String(req.params.id || "").trim();

    if (!/^\d+$/.test(sellerId)) {
      return res.status(400).json({ error: "Invalid seller ID." });
    }

    const result = await pool.query(
      `
        SELECT
          id,
          name,
          email,
          referral_code,
          portal_token
        FROM sellers
        WHERE id = $1
      `,
      [sellerId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Seller not found." });
    }

    const seller = result.rows[0];

    if (!seller.email) {
      return res.status(400).json({ error: "Seller email is missing." });
    }

    if (!seller.portal_token) {
      return res.status(400).json({ error: "Seller portal link is missing." });
    }

    const emailResult = await sendSellerPortalEmail(seller);

    res.json({
      ok: true,
      message: "Seller portal email sent.",
      emailId: emailResult?.id || null
    });
  } catch (error) {
    logError("Seller portal email error:", error);
    res.status(500).json({ error: error?.message || "Could not send seller portal email." });
  }
});

app.get("/api/store-settings", async (_req, res) => {
  const defaults = {
    songPrice: "19.99",
    orderingOpen: true,
    turnaroundMessage: "Your custom StorySong will typically be ready within 2–3 days.",
    announcementEnabled: false,
    announcementMessage: "",
    reviewsEnabled: true
  };

  try {
    if (!pool) {
      return res.json(defaults);
    }

    const result = await pool.query(
      `SELECT setting_key, setting_value
       FROM store_settings
       WHERE setting_key IN (
         'song_price',
         'ordering_open',
         'turnaround_message',
         'announcement_enabled',
         'announcement_message',
         'reviews_enabled'
       )`
    );

    const settings = Object.fromEntries(
      result.rows.map(row => [row.setting_key, row.setting_value])
    );

    res.json({
      songPrice: settings.song_price || defaults.songPrice,
      orderingOpen: (settings.ordering_open ?? "true") === "true",
      turnaroundMessage: settings.turnaround_message ?? defaults.turnaroundMessage,
      announcementEnabled: (settings.announcement_enabled ?? "false") === "true",
      announcementMessage: settings.announcement_message ?? "",
      reviewsEnabled: (settings.reviews_enabled ?? "true") === "true"
    });
  } catch (error) {
    logError("Public store settings error:", error);
    res.json(defaults);
  }
});



app.get("/api/seller/portal", async (req, res) => {
  try {
    const authorization = String(req.get("authorization") || "");
    const match = authorization.match(/^Bearer\s+([a-f0-9]{64})$/i);

    if (!match) {
      return res.status(401).json({ error: "Seller access link is not valid." });
    }

    const portalToken = match[1].toLowerCase();

    const sellerResult = await pool.query(
      `
        SELECT
          id,
          name,
          referral_code,
          active,
          commission_rate
        FROM sellers
        WHERE portal_token = $1
        LIMIT 1
      `,
      [portalToken]
    );

    if (!sellerResult.rows.length) {
      return res.status(401).json({ error: "Seller access link is not valid." });
    }

    const seller = sellerResult.rows[0];

    const summaryResult = await pool.query(
      `
        SELECT
          COUNT(id) FILTER (
            WHERE paid_at IS NOT NULL
            AND status IN ('Paid', 'Creating', 'Ready')
          )::int AS pending_order_count,

          COALESCE(SUM(price_amount) FILTER (
            WHERE paid_at IS NOT NULL
            AND status IN ('Paid', 'Creating', 'Ready')
          ), 0)::numeric AS pending_sales_total,

          COUNT(id) FILTER (
            WHERE paid_at IS NOT NULL
            AND status = 'Delivered'
          )::int AS earned_order_count,

          COALESCE(SUM(price_amount) FILTER (
            WHERE paid_at IS NOT NULL
            AND status = 'Delivered'
          ), 0)::numeric AS earned_sales_total,

          COALESCE(SUM(seller_commission_amount) FILTER (
            WHERE paid_at IS NOT NULL
            AND status = 'Delivered'
          ), 0)::numeric AS commission_earned,

          COALESCE(SUM(seller_commission_amount) FILTER (
            WHERE paid_at IS NOT NULL
            AND status = 'Delivered'
            AND seller_commission_amount IS NOT NULL
            AND seller_payout_id IS NULL
          ), 0)::numeric AS commission_owed

        FROM orders
        WHERE seller_id = $1
          AND is_test = FALSE
      `,
      [seller.id]
    );

    const payoutResult = await pool.query(
      `
        SELECT
          p.amount,
          p.paid_at,
          p.payment_method,
          p.note,
          COUNT(o.id)::int AS order_count
        FROM seller_payouts p
        LEFT JOIN orders o ON o.seller_payout_id = p.id
        WHERE p.seller_id = $1
        GROUP BY p.id
        ORDER BY p.paid_at DESC, p.id DESC
      `,
      [seller.id]
    );

    const summary = summaryResult.rows[0];

    res.set("Cache-Control", "private, no-store");

    res.json({
      seller: {
        name: seller.name,
        referralCode: seller.referral_code,
        referralLink: `${PUBLIC_BASE_URL}/order.html?ref=${encodeURIComponent(seller.referral_code)}`,
        active: seller.active,
        commissionRate: Number(seller.commission_rate || 0)
      },
      summary: {
        pendingOrders: Number(summary.pending_order_count || 0),
        pendingSales: Number(summary.pending_sales_total || 0),
        earnedOrders: Number(summary.earned_order_count || 0),
        earnedSales: Number(summary.earned_sales_total || 0),
        commissionEarned: Number(summary.commission_earned || 0),
        commissionOwed: Number(summary.commission_owed || 0)
      },
      payouts: payoutResult.rows.map(payout => ({
        amount: Number(payout.amount || 0),
        paidAt: payout.paid_at,
        paymentMethod: payout.payment_method || "",
        note: payout.note || "",
        orderCount: Number(payout.order_count || 0)
      }))
    });
  } catch (error) {
    logError("Seller portal access error:", error);
    res.status(500).json({ error: "Could not load seller portal." });
  }
});


app.get("/api/admin/store-display/qr", requireAdmin, async (_req, res) => {
  try {
    const orderLink = `${PUBLIC_BASE_URL}/order.html`;

    const qrBuffer = await QRCode.toBuffer(orderLink, {
      type: "png",
      width: 700,
      margin: 2,
      errorCorrectionLevel: "M"
    });

    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "private, no-store");
    res.send(qrBuffer);
  } catch (error) {
    logError("Store display QR code error:", error);
    res.status(500).json({ error: "Could not generate store display QR code." });
  }
});

app.get("/api/admin/sellers/:referralCode/qr", requireAdmin, async (req, res) => {
  try {
    const referralCode = String(req.params.referralCode || "").trim().toUpperCase();

    if (!/^[A-Z0-9_-]{3,30}$/.test(referralCode)) {
      return res.status(400).json({ error: "Invalid referral code." });
    }

    const result = await pool.query(
      `
        SELECT referral_code
        FROM sellers
        WHERE referral_code = $1
        LIMIT 1
      `,
      [referralCode]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Seller not found." });
    }

    const referralLink = `${PUBLIC_BASE_URL}/order.html?ref=${encodeURIComponent(referralCode)}`;

    const qrBuffer = await QRCode.toBuffer(referralLink, {
      type: "png",
      width: 700,
      margin: 2,
      errorCorrectionLevel: "M"
    });

    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "private, no-store");
    res.send(qrBuffer);
  } catch (error) {
    logError("Seller QR code error:", error);
    res.status(500).json({ error: "Could not generate seller QR code." });
  }
});

app.get("/api/admin/sellers", requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.referral_code,
        s.active,
        s.commission_rate,
        s.email,
        s.portal_token,
        s.created_at,
        COUNT(o.id)::int AS order_count,
        COALESCE(SUM(CASE WHEN o.paid_at IS NOT NULL THEN o.price_amount ELSE 0 END), 0)::numeric AS sales_total
      FROM sellers s
      LEFT JOIN orders o
        ON o.seller_id = s.id
        AND o.is_test = FALSE
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);

    res.json({
      sellers: result.rows.map(seller => {
        const { portal_token, ...safeSeller } = seller;

        return {
          ...safeSeller,
          portal_link: portal_token
            ? `${PUBLIC_BASE_URL}/seller.html#token=${portal_token}`
            : ""
        };
      })
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load sellers." });
  }
});

app.post("/api/admin/sellers", requireAdmin, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const referralCode = String(req.body?.referralCode || "")
    .trim()
    .toUpperCase();
  const commissionRate = Number(req.body?.commissionRate ?? 20);
  const email = String(req.body?.email || "").trim().toLowerCase() || null;

  if (!name) {
    return res.status(400).json({ error: "Seller name is required." });
  }

  if (name.length > 100) {
    return res.status(400).json({ error: "Seller name must be 100 characters or fewer." });
  }

  if (email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email) || email.length > 254) {
      return res.status(400).json({ error: "Please enter a valid seller email address." });
    }
  }

  if (!/^[A-Z0-9_-]{3,30}$/.test(referralCode)) {
    return res.status(400).json({
      error: "Referral code must be 3–30 characters using letters, numbers, hyphens, or underscores."
    });
  }

  if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100) {
    return res.status(400).json({
      error: "Commission rate must be between 0 and 100."
    });
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO sellers (name, referral_code, commission_rate, email, portal_token)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, name, referral_code, active, commission_rate, email, created_at
      `,
      [name, referralCode, commissionRate, email, crypto.randomBytes(32).toString("hex")]
    );

    res.status(201).json({ seller: result.rows[0] });
  } catch (error) {
    console.error(error);

    if (error.code === "23505") {
      return res.status(409).json({
        error: "That referral code is already in use."
      });
    }

    res.status(500).json({ error: "Could not create seller." });
  }
});


app.get("/api/admin/vendors", requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        id,
        name,
        contact_name,
        email,
        phone,
        website_url,
        address_line1,
        address_line2,
        city,
        state_region,
        postal_code,
        country,
        account_reference,
        notes,
        active,
        created_at,
        updated_at
      FROM vendors
      ORDER BY active DESC, name ASC, created_at DESC
    `);

    res.json({ vendors: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load vendors." });
  }
});

app.post("/api/admin/vendors", requireAdmin, async (req, res) => {
  const name = String(req.body?.name || "").trim();
  const contactName = String(req.body?.contactName || "").trim() || null;
  const email = String(req.body?.email || "").trim().toLowerCase() || null;
  const phone = String(req.body?.phone || "").trim() || null;
  const websiteUrl = String(req.body?.websiteUrl || "").trim() || null;
  const addressLine1 = String(req.body?.addressLine1 || "").trim() || null;
  const addressLine2 = String(req.body?.addressLine2 || "").trim() || null;
  const city = String(req.body?.city || "").trim() || null;
  const stateRegion = String(req.body?.stateRegion || "").trim() || null;
  const postalCode = String(req.body?.postalCode || "").trim() || null;
  const country = String(req.body?.country || "").trim() || null;
  const accountReference = String(req.body?.accountReference || "").trim() || null;
  const notes = String(req.body?.notes || "").trim() || null;

  if (!name) {
    return res.status(400).json({ error: "Vendor name is required." });
  }

  if (name.length > 150) {
    return res.status(400).json({ error: "Vendor name must be 150 characters or fewer." });
  }

  if (email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email) || email.length > 254) {
      return res.status(400).json({ error: "Please enter a valid vendor email address." });
    }
  }

  if (websiteUrl) {
    try {
      const parsedUrl = new URL(websiteUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Unsupported protocol");
      }
    } catch {
      return res.status(400).json({
        error: "Please enter a valid vendor website URL beginning with http:// or https://."
      });
    }
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO vendors (
          name,
          contact_name,
          email,
          phone,
          website_url,
          address_line1,
          address_line2,
          city,
          state_region,
          postal_code,
          country,
          account_reference,
          notes
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, $10, $11, $12, $13
        )
        RETURNING *
      `,
      [
        name,
        contactName,
        email,
        phone,
        websiteUrl,
        addressLine1,
        addressLine2,
        city,
        stateRegion,
        postalCode,
        country,
        accountReference,
        notes
      ]
    );

    res.status(201).json({ vendor: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create vendor." });
  }
});

app.patch("/api/admin/vendors/:id", requireAdmin, async (req, res) => {
  const vendorId = String(req.params.id || "").trim();

  if (!/^\d+$/.test(vendorId)) {
    return res.status(400).json({ error: "Invalid vendor ID." });
  }

  const fieldMap = {
    name: "name",
    contactName: "contact_name",
    email: "email",
    phone: "phone",
    websiteUrl: "website_url",
    addressLine1: "address_line1",
    addressLine2: "address_line2",
    city: "city",
    stateRegion: "state_region",
    postalCode: "postal_code",
    country: "country",
    accountReference: "account_reference",
    notes: "notes",
    active: "active"
  };

  const updates = [];
  const values = [];

  for (const [bodyField, column] of Object.entries(fieldMap)) {
    if (req.body?.[bodyField] === undefined) continue;

    let value = req.body[bodyField];

    if (bodyField === "active") {
      if (typeof value !== "boolean") {
        return res.status(400).json({ error: "Vendor active status must be true or false." });
      }
    } else {
      value = String(value || "").trim();

      if (bodyField === "name" && !value) {
        return res.status(400).json({ error: "Vendor name is required." });
      }

      if (bodyField === "name" && value.length > 150) {
        return res.status(400).json({ error: "Vendor name must be 150 characters or fewer." });
      }

      if (bodyField === "email" && value) {
        value = value.toLowerCase();
        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailPattern.test(value) || value.length > 254) {
          return res.status(400).json({ error: "Please enter a valid vendor email address." });
        }
      }

      if (bodyField === "websiteUrl" && value) {
        try {
          const parsedUrl = new URL(value);
          if (!["http:", "https:"].includes(parsedUrl.protocol)) {
            throw new Error("Unsupported protocol");
          }
        } catch {
          return res.status(400).json({
            error: "Please enter a valid vendor website URL beginning with http:// or https://."
          });
        }
      }

      if (!value) value = null;
    }

    values.push(value);
    updates.push(`${column} = $${values.length}`);
  }

  if (!updates.length) {
    return res.status(400).json({ error: "No vendor changes were provided." });
  }

  values.push(vendorId);

  try {
    const result = await pool.query(
      `
        UPDATE vendors
        SET
          ${updates.join(", ")},
          updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING *
      `,
      values
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Vendor not found." });
    }

    res.json({ vendor: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not update vendor." });
  }
});


app.get("/api/admin/accounts-payable", requireAdmin, async (_req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(`
      SELECT
        ap.id,
        ap.vendor_id,
        v.name AS vendor_name,
        ap.category,
        ap.description,
        ap.amount,
        ap.due_date,
        ap.status,
        ap.paid_date,
        ap.reference_number,
        ap.notes,
        ap.created_at,
        ap.updated_at
      FROM accounts_payable ap
      LEFT JOIN vendors v ON v.id = ap.vendor_id
      ORDER BY
        CASE WHEN ap.status = 'Unpaid' THEN 0 ELSE 1 END,
        ap.due_date NULLS LAST,
        ap.created_at DESC
    `);

    res.json({ accountsPayable: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load accounts payable." });
  }
});


app.post("/api/admin/accounts-payable", requireAdmin, async (req, res) => {
  const vendorIdRaw = String(req.body?.vendorId ?? "").trim();
  const category = String(req.body?.category ?? "").trim() || null;
  const description = String(req.body?.description ?? "").trim();
  const amount = Number(req.body?.amount);
  const dueDate = String(req.body?.dueDate ?? "").trim() || null;
  const status = String(req.body?.status ?? "Unpaid").trim();
  const paidDate = String(req.body?.paidDate ?? "").trim() || null;
  const referenceNumber = String(req.body?.referenceNumber ?? "").trim() || null;
  const notes = String(req.body?.notes ?? "").trim() || null;

  const vendorId = vendorIdRaw ? Number(vendorIdRaw) : null;

  if (vendorIdRaw && (!Number.isInteger(vendorId) || vendorId <= 0)) {
    return res.status(400).json({ error: "Invalid vendor." });
  }

  if (!description) {
    return res.status(400).json({ error: "Description is required." });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: "Amount must be greater than zero." });
  }

  if (!["Unpaid", "Paid"].includes(status)) {
    return res.status(400).json({ error: "Status must be Unpaid or Paid." });
  }

  if (status === "Paid" && !paidDate) {
    return res.status(400).json({ error: "Paid date is required when status is Paid." });
  }

  try {
    if (vendorId !== null) {
      const vendorResult = await pool.query(
        `SELECT id FROM vendors WHERE id = $1`,
        [vendorId]
      );

      if (!vendorResult.rows.length) {
        return res.status(400).json({ error: "Vendor not found." });
      }
    }

    const result = await pool.query(
      `
        INSERT INTO accounts_payable (
          vendor_id,
          category,
          description,
          amount,
          due_date,
          status,
          paid_date,
          reference_number,
          notes
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `,
      [
        vendorId,
        category,
        description,
        amount,
        dueDate,
        status,
        status === "Paid" ? paidDate : null,
        referenceNumber,
        notes
      ]
    );

    res.status(201).json({ accountPayable: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not create accounts payable entry." });
  }
});


app.patch("/api/admin/accounts-payable/:id", requireAdmin, async (req, res) => {
  const entryId = String(req.params.id || "").trim();

  if (!/^\d+$/.test(entryId)) {
    return res.status(400).json({ error: "Invalid accounts payable ID." });
  }

  const fieldMap = {
    vendorId: "vendor_id",
    category: "category",
    description: "description",
    amount: "amount",
    dueDate: "due_date",
    status: "status",
    paidDate: "paid_date",
    referenceNumber: "reference_number",
    notes: "notes"
  };

  const updates = [];
  const values = [];

  for (const [bodyField, column] of Object.entries(fieldMap)) {
    if (req.body?.[bodyField] === undefined) continue;

    let value = req.body[bodyField];

    if (bodyField === "vendorId") {
      const raw = String(value ?? "").trim();

      if (!raw) {
        value = null;
      } else {
        const vendorId = Number(raw);

        if (!Number.isInteger(vendorId) || vendorId <= 0) {
          return res.status(400).json({ error: "Invalid vendor." });
        }

        value = vendorId;
      }
    } else if (bodyField === "amount") {
      value = Number(value);

      if (!Number.isFinite(value) || value <= 0) {
        return res.status(400).json({ error: "Amount must be greater than zero." });
      }
    } else {
      value = String(value ?? "").trim();

      if (bodyField === "description" && !value) {
        return res.status(400).json({ error: "Description is required." });
      }

      if (bodyField === "status" && !["Unpaid", "Paid"].includes(value)) {
        return res.status(400).json({ error: "Status must be Unpaid or Paid." });
      }

      if (!value) value = null;
    }

    values.push(value);
    updates.push(`${column} = $${values.length}`);
  }

  if (!updates.length) {
    return res.status(400).json({ error: "No accounts payable changes were provided." });
  }

  try {
    if (req.body?.vendorId !== undefined) {
      const rawVendorId = String(req.body.vendorId ?? "").trim();

      if (rawVendorId) {
        const vendorResult = await pool.query(
          `SELECT id FROM vendors WHERE id = $1`,
          [Number(rawVendorId)]
        );

        if (!vendorResult.rows.length) {
          return res.status(400).json({ error: "Vendor not found." });
        }
      }
    }

    const currentResult = await pool.query(
      `
        SELECT status, paid_date
        FROM accounts_payable
        WHERE id = $1
      `,
      [entryId]
    );

    if (!currentResult.rows.length) {
      return res.status(404).json({ error: "Accounts payable entry not found." });
    }

    const finalStatus =
      req.body?.status !== undefined
        ? String(req.body.status).trim()
        : currentResult.rows[0].status;

    const finalPaidDate =
      req.body?.paidDate !== undefined
        ? (String(req.body.paidDate ?? "").trim() || null)
        : currentResult.rows[0].paid_date;

    if (finalStatus === "Paid" && !finalPaidDate) {
      return res.status(400).json({ error: "Paid date is required when status is Paid." });
    }

    if (finalStatus === "Unpaid" && req.body?.paidDate === undefined) {
      values.push(null);
      updates.push(`paid_date = $${values.length}`);
    }

    values.push(entryId);

    const result = await pool.query(
      `
        UPDATE accounts_payable
        SET
          ${updates.join(", ")},
          updated_at = NOW()
        WHERE id = $${values.length}
        RETURNING *
      `,
      values
    );

    res.json({ accountPayable: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not update accounts payable entry." });
  }
});


app.post("/api/admin/sellers/:id/payouts", requireAdmin, async (req, res) => {
  const sellerId = String(req.params.id || "").trim();
  const paymentMethod = String(req.body?.paymentMethod || "").trim() || null;
  const note = String(req.body?.note || "").trim() || null;

  if (!/^\d+$/.test(sellerId)) {
    return res.status(400).json({ error: "Invalid seller ID." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const sellerResult = await client.query(
      `
        SELECT id, name
        FROM sellers
        WHERE id = $1
        FOR UPDATE
      `,
      [sellerId]
    );

    if (sellerResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "Seller not found." });
    }

    const ordersResult = await client.query(
      `
        SELECT id, seller_commission_amount
        FROM orders
        WHERE seller_id = $1
          AND paid_at IS NOT NULL
          AND is_test = FALSE
          AND status = 'Delivered'
          AND seller_commission_amount IS NOT NULL
          AND seller_payout_id IS NULL
        ORDER BY created_at, id
        FOR UPDATE
      `,
      [sellerId]
    );

    if (ordersResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "This seller does not currently have any unpaid commission."
      });
    }

    const amount = ordersResult.rows.reduce(
      (sum, order) => sum + Number(order.seller_commission_amount || 0),
      0
    );

    if (!Number.isFinite(amount) || amount <= 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        error: "This seller does not currently have any commission to pay."
      });
    }

    const payoutResult = await client.query(
      `
        INSERT INTO seller_payouts (
          seller_id,
          amount,
          payment_method,
          note
        )
        VALUES ($1, $2, $3, $4)
        RETURNING id, seller_id, amount, paid_at, payment_method, note, created_at
      `,
      [sellerId, amount, paymentMethod, note]
    );

    const orderIds = ordersResult.rows.map(order => order.id);

    await client.query(
      `
        UPDATE orders
        SET seller_payout_id = $1
        WHERE id = ANY($2::text[])
          AND seller_payout_id IS NULL
      `,
      [payoutResult.rows[0].id, orderIds]
    );

    await client.query("COMMIT");

    res.status(201).json({
      payout: payoutResult.rows[0],
      seller: sellerResult.rows[0],
      orderCount: orderIds.length
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error(error);
    res.status(500).json({ error: "Could not record seller payout." });
  } finally {
    client.release();
  }
});

app.get("/api/admin/sellers/:id/payouts", requireAdmin, async (req, res) => {
  const sellerId = String(req.params.id || "").trim();

  if (!/^\d+$/.test(sellerId)) {
    return res.status(400).json({ error: "Invalid seller ID." });
  }

  try {
    const sellerResult = await pool.query(
      `
        SELECT id, name, referral_code
        FROM sellers
        WHERE id = $1
      `,
      [sellerId]
    );

    if (sellerResult.rows.length === 0) {
      return res.status(404).json({ error: "Seller not found." });
    }

    const payoutResult = await pool.query(
      `
        SELECT
          p.id,
          p.amount,
          p.paid_at,
          p.payment_method,
          p.note,
          COUNT(o.id)::int AS order_count
        FROM seller_payouts p
        LEFT JOIN orders o ON o.seller_payout_id = p.id
        WHERE p.seller_id = $1
        GROUP BY p.id
        ORDER BY p.paid_at DESC, p.id DESC
      `,
      [sellerId]
    );

    res.json({
      seller: sellerResult.rows[0],
      payouts: payoutResult.rows
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not load seller payout history." });
  }
});

app.patch("/api/admin/sellers/:id", requireAdmin, async (req, res) => {
  const sellerId = String(req.params.id || "").trim();

  const hasActive = typeof req.body?.active === "boolean";
  const hasCommissionRate = req.body?.commissionRate !== undefined;
  const hasName = req.body?.name !== undefined;
  const hasEmail = req.body?.email !== undefined;

  const active = req.body?.active;
  const commissionRate = hasCommissionRate ? Number(req.body.commissionRate) : null;
  const name = hasName ? String(req.body.name || "").trim() : null;
  const email = hasEmail
    ? (String(req.body.email || "").trim().toLowerCase() || null)
    : null;

  if (!/^\d+$/.test(sellerId)) {
    return res.status(400).json({ error: "Invalid seller ID." });
  }

  if (!hasActive && !hasCommissionRate && !hasName && !hasEmail) {
    return res.status(400).json({ error: "No seller changes were provided." });
  }

  if (hasName && !name) {
    return res.status(400).json({ error: "Seller name is required." });
  }

  if (hasName && name.length > 100) {
    return res.status(400).json({ error: "Seller name must be 100 characters or fewer." });
  }

  if (hasEmail && email) {
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(email) || email.length > 254) {
      return res.status(400).json({ error: "Please enter a valid seller email address." });
    }
  }

  if (
    hasCommissionRate &&
    (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > 100)
  ) {
    return res.status(400).json({
      error: "Commission rate must be between 0 and 100."
    });
  }

  try {
    const result = await pool.query(
      `
        UPDATE sellers
        SET
          active = CASE WHEN $1::boolean IS NULL THEN active ELSE $1 END,
          commission_rate = CASE WHEN $2::numeric IS NULL THEN commission_rate ELSE $2 END,
          name = CASE WHEN $3::text IS NULL THEN name ELSE $3 END,
          email = CASE
            WHEN $5::boolean = FALSE THEN email
            ELSE $4
          END
        WHERE id = $6
        RETURNING
          id,
          name,
          referral_code,
          active,
          commission_rate,
          email,
          created_at
      `,
      [
        hasActive ? active : null,
        hasCommissionRate ? commissionRate : null,
        hasName ? name : null,
        email,
        hasEmail,
        sellerId
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Seller not found." });
    }

    res.json({ seller: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Could not update seller." });
  }
});

app.get("/api/admin/reports/sales", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const startDate = String(req.query.start || "").trim();
    const endDate = String(req.query.end || "").trim();

    if (!isValidReportDate(startDate) || !isValidReportDate(endDate)) {
      return res.status(400).json({ error: "Valid start and end dates are required." });
    }

    if (startDate > endDate) {
      return res.status(400).json({ error: "Start date cannot be after end date." });
    }

    const result = await pool.query(
      `
        SELECT
          o.id,
          o.customer_name,
          o.email,
          o.price_amount,
          o.created_at,
          o.paid_at,
          s.name AS seller_name,
          s.referral_code AS seller_referral_code
        FROM orders o
        LEFT JOIN sellers s ON s.id = o.seller_id
        WHERE o.paid_at IS NOT NULL
          AND o.is_test = FALSE
          AND (o.paid_at AT TIME ZONE 'America/New_York')::date >= $1::date
          AND (o.paid_at AT TIME ZONE 'America/New_York')::date <= $2::date
        ORDER BY o.paid_at DESC
      `,
      [startDate, endDate]
    );

    const paidOrders = result.rows;
    const totalSales = paidOrders.reduce(
      (sum, order) => sum + Number(order.price_amount || 0),
      0
    );
    const averageOrderValue = paidOrders.length
      ? totalSales / paidOrders.length
      : 0;

    res.json({
      startDate,
      endDate,
      paidOrderCount: paidOrders.length,
      totalSales,
      averageOrderValue,
      orders: paidOrders
    });
  } catch (error) {
    logError("Admin sales report error:", error);
    res.status(500).json({ error: "Could not load sales report." });
  }
});


app.get("/api/admin/reports/customers", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const startDate = String(req.query.start || "").trim();
    const endDate = String(req.query.end || "").trim();

    if (!isValidReportDate(startDate) || !isValidReportDate(endDate)) {
      return res.status(400).json({ error: "Valid start and end dates are required." });
    }

    if (startDate > endDate) {
      return res.status(400).json({ error: "Start date cannot be after end date." });
    }

    const result = await pool.query(
      `
        WITH period_customers AS (
          SELECT DISTINCT LOWER(TRIM(email)) AS normalized_email
          FROM orders
          WHERE paid_at IS NOT NULL
            AND is_test = FALSE
            AND email IS NOT NULL
            AND TRIM(email) <> ''
            AND (paid_at AT TIME ZONE 'America/New_York')::date >= $1::date
            AND (paid_at AT TIME ZONE 'America/New_York')::date <= $2::date
        )
        SELECT
          LOWER(TRIM(o.email)) AS email,
          (ARRAY_AGG(o.customer_name ORDER BY o.paid_at DESC))[1] AS customer_name,
          COUNT(o.id)::int AS paid_order_count,
          COALESCE(SUM(o.price_amount), 0)::numeric AS total_spent,
          MIN(o.paid_at) AS first_purchase_at,
          MAX(o.paid_at) AS last_purchase_at
        FROM orders o
        INNER JOIN period_customers pc
          ON pc.normalized_email = LOWER(TRIM(o.email))
        WHERE o.paid_at IS NOT NULL
          AND o.is_test = FALSE
        GROUP BY LOWER(TRIM(o.email))
        ORDER BY paid_order_count DESC, total_spent DESC, email ASC
      `,
      [startDate, endDate]
    );

    const customers = result.rows.map(customer => ({
      ...customer,
      returning: Number(customer.paid_order_count || 0) >= 2
    }));

    const returningCustomers = customers.filter(customer => customer.returning);
    const returningRevenue = returningCustomers.reduce(
      (sum, customer) => sum + Number(customer.total_spent || 0),
      0
    );

    res.json({
      startDate,
      endDate,
      uniqueCustomers: customers.length,
      returningCustomers: returningCustomers.length,
      repeatCustomerRate: customers.length
        ? (returningCustomers.length / customers.length) * 100
        : 0,
      returningRevenue,
      customers
    });
  } catch (error) {
    logError("Admin customer report error:", error);
    res.status(500).json({ error: "Could not load customer report." });
  }
});

// ==============================
// Customer Marketing
// ==============================

app.get("/api/marketing/unsubscribe", async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).send("StorySong marketing preferences are unavailable.");
    }

    const token = String(req.query.token || "").trim();

    if (!token || !/^[a-f0-9]{64}$/i.test(token)) {
      return res.status(400).send("This unsubscribe link is invalid.");
    }

    const result = await pool.query(
      `
        UPDATE customer_marketing_preferences
        SET
          marketing_opt_out = TRUE,
          opted_out_at = NOW(),
          updated_at = NOW()
        WHERE unsubscribe_token = $1
        RETURNING email
      `,
      [token]
    );

    if (!result.rows.length) {
      return res.status(404).send("This unsubscribe link is invalid or has expired.");
    }

    res.send(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width,initial-scale=1">
          <title>StorySong Unsubscribe</title>
        </head>
        <body style="font-family:Arial,sans-serif;max-width:620px;margin:60px auto;padding:24px;color:#222;text-align:center;">
          <h1>You’re unsubscribed</h1>
          <p>You will no longer receive StorySong marketing emails.</p>
          <p>Your transactional emails, such as song delivery messages, are not affected.</p>
        </body>
      </html>
    `);
  } catch (error) {
    logError("Marketing unsubscribe error:", error);
    res.status(500).send("Could not process your unsubscribe request.");
  }
});

app.post("/api/admin/marketing/send", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const email = String(req.body?.email || "").trim().toLowerCase();
    const subject = sanitizeEmailSubject(req.body?.subject);
    const message = String(req.body?.message || "").trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "A valid customer email is required." });
    }

    if (!subject) {
      return res.status(400).json({ error: "Email subject is required." });
    }

    if (!message) {
      return res.status(400).json({ error: "Email message is required." });
    }

    const customerResult = await pool.query(
      `
        SELECT
          LOWER(TRIM(o.email)) AS email,
          (ARRAY_AGG(o.customer_name ORDER BY o.paid_at DESC))[1] AS customer_name,
          COALESCE(mp.unsubscribe_token, NULL) AS unsubscribe_token,
          COALESCE(mp.marketing_opt_out, FALSE) AS marketing_opt_out
        FROM orders o
        LEFT JOIN customer_marketing_preferences mp
          ON mp.email = LOWER(TRIM(o.email))
        WHERE LOWER(TRIM(o.email)) = $1
          AND o.paid_at IS NOT NULL
          AND o.is_test = FALSE
        GROUP BY
          LOWER(TRIM(o.email)),
          mp.unsubscribe_token,
          mp.marketing_opt_out
        LIMIT 1
      `,
      [email]
    );

    if (!customerResult.rows.length) {
      return res.status(404).json({ error: "That email is not an eligible StorySong customer." });
    }

    const customer = customerResult.rows[0];

    if (customer.marketing_opt_out) {
      return res.status(403).json({ error: "This customer has opted out of StorySong marketing emails." });
    }

    let unsubscribeToken = customer.unsubscribe_token;

    if (!unsubscribeToken) {
      unsubscribeToken = createMarketingUnsubscribeToken();

      await pool.query(
        `
          INSERT INTO customer_marketing_preferences (
            email,
            customer_name,
            unsubscribe_token
          )
          VALUES ($1, $2, $3)
          ON CONFLICT (email) DO UPDATE
          SET
            customer_name = COALESCE(customer_marketing_preferences.customer_name, EXCLUDED.customer_name),
            unsubscribe_token = COALESCE(customer_marketing_preferences.unsubscribe_token, EXCLUDED.unsubscribe_token),
            updated_at = NOW()
        `,
        [customer.email, customer.customer_name || null, unsubscribeToken]
      );

      customer.unsubscribe_token = unsubscribeToken;
    }

    const emailResult = await sendMarketingEmail({
      email: customer.email,
      customer_name: customer.customer_name,
      unsubscribe_token: customer.unsubscribe_token,
      subject,
      message
    });

    await pool.query(
      `
        INSERT INTO marketing_email_history (
          recipient_email,
          recipient_name,
          subject,
          message,
          send_status,
          provider_message_id
        )
        VALUES ($1, $2, $3, $4, $5, $6)
      `,
      [
        customer.email,
        customer.customer_name || null,
        subject,
        message,
        "sent",
        emailResult?.id || null
      ]
    );

    res.json({
      ok: true,
      message: "Marketing email sent.",
      emailId: emailResult?.id || null
    });
  } catch (error) {
    logError("Marketing email send error:", error);
    res.status(500).json({ error: error?.message || "Could not send marketing email." });
  }
});

app.get("/api/admin/marketing/customers", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(`
      SELECT
        LOWER(TRIM(o.email)) AS email,
        (ARRAY_AGG(o.customer_name ORDER BY o.paid_at DESC))[1] AS customer_name,
        COUNT(o.id)::int AS paid_order_count,
        COALESCE(SUM(o.price_amount), 0)::numeric AS total_spent,
        MIN(o.paid_at) AS first_purchase_at,
        MAX(o.paid_at) AS last_purchase_at,
        mp.unsubscribe_token,
        COALESCE(mp.marketing_opt_out, FALSE) AS marketing_opt_out,
        mp.opted_out_at
      FROM orders o
      LEFT JOIN customer_marketing_preferences mp
        ON mp.email = LOWER(TRIM(o.email))
      WHERE o.paid_at IS NOT NULL
        AND o.is_test = FALSE
        AND o.email IS NOT NULL
        AND TRIM(o.email) <> ''
      GROUP BY
        LOWER(TRIM(o.email)),
        mp.unsubscribe_token,
        mp.marketing_opt_out,
        mp.opted_out_at
      ORDER BY last_purchase_at DESC, email ASC
    `);

    const customers = [];

    for (const customer of result.rows) {
      let unsubscribeToken = customer.unsubscribe_token;

      if (!unsubscribeToken) {
        unsubscribeToken = createMarketingUnsubscribeToken();

        await pool.query(
          `
            INSERT INTO customer_marketing_preferences (
              email,
              customer_name,
              unsubscribe_token
            )
            VALUES ($1, $2, $3)
            ON CONFLICT (email) DO UPDATE
            SET
              customer_name = COALESCE(customer_marketing_preferences.customer_name, EXCLUDED.customer_name),
              unsubscribe_token = COALESCE(customer_marketing_preferences.unsubscribe_token, EXCLUDED.unsubscribe_token),
              updated_at = NOW()
          `,
          [customer.email, customer.customer_name || null, unsubscribeToken]
        );
      }

      customers.push({
        ...customer,
        unsubscribe_token: unsubscribeToken,
        returning: Number(customer.paid_order_count || 0) >= 2,
        marketingEligible: !customer.marketing_opt_out
      });
    }

    res.json({
      customerCount: customers.length,
      eligibleCount: customers.filter(customer => customer.marketingEligible).length,
      optedOutCount: customers.filter(customer => customer.marketing_opt_out).length,
      customers
    });
  } catch (error) {
    logError("Admin marketing customer list error:", error);
    res.status(500).json({ error: "Could not load marketing customers." });
  }
});

app.post("/api/admin/marketing/send-all", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const subject = sanitizeEmailSubject(req.body?.subject);
    const message = String(req.body?.message || "").trim();

    if (!subject) {
      return res.status(400).json({ error: "Email subject is required." });
    }

    if (!message) {
      return res.status(400).json({ error: "Email message is required." });
    }

    const result = await pool.query(`
      SELECT
        LOWER(TRIM(o.email)) AS email,
        (ARRAY_AGG(o.customer_name ORDER BY o.paid_at DESC))[1] AS customer_name,
        mp.unsubscribe_token
      FROM orders o
      LEFT JOIN customer_marketing_preferences mp
        ON mp.email = LOWER(TRIM(o.email))
      WHERE o.paid_at IS NOT NULL
        AND o.is_test = FALSE
        AND o.email IS NOT NULL
        AND TRIM(o.email) <> ''
        AND COALESCE(mp.marketing_opt_out, FALSE) = FALSE
      GROUP BY
        LOWER(TRIM(o.email)),
        mp.unsubscribe_token
      ORDER BY email ASC
    `);

    if (!result.rows.length) {
      return res.status(400).json({ error: "There are no customers available for marketing email." });
    }

    let sentCount = 0;
    const failed = [];

    for (const customer of result.rows) {
      try {
        let unsubscribeToken = customer.unsubscribe_token;

        if (!unsubscribeToken) {
          unsubscribeToken = createMarketingUnsubscribeToken();

          const preferenceResult = await pool.query(
            `
              INSERT INTO customer_marketing_preferences (
                email,
                customer_name,
                unsubscribe_token
              )
              VALUES ($1, $2, $3)
              ON CONFLICT (email) DO UPDATE
              SET
                customer_name = COALESCE(customer_marketing_preferences.customer_name, EXCLUDED.customer_name),
                unsubscribe_token = COALESCE(customer_marketing_preferences.unsubscribe_token, EXCLUDED.unsubscribe_token),
                updated_at = NOW()
              RETURNING unsubscribe_token
            `,
            [customer.email, customer.customer_name || null, unsubscribeToken]
          );

          unsubscribeToken = preferenceResult.rows[0]?.unsubscribe_token || unsubscribeToken;
        }

        const emailResult = await sendMarketingEmail({
          email: customer.email,
          customer_name: customer.customer_name,
          unsubscribe_token: unsubscribeToken,
          subject,
          message
        });

        await pool.query(
          `
            INSERT INTO marketing_email_history (
              recipient_email,
              recipient_name,
              subject,
              message,
              send_status,
              provider_message_id
            )
            VALUES ($1, $2, $3, $4, $5, $6)
          `,
          [
            customer.email,
            customer.customer_name || null,
            subject,
            message,
            "sent",
            emailResult?.id || null
          ]
        );

        sentCount += 1;
      } catch (error) {
        logError(`Marketing bulk email failed for ${customer.email}:`, error);
        failed.push(customer.email);
      }
    }

    res.json({
      ok: failed.length === 0,
      message: failed.length
        ? `Marketing email sent to ${sentCount} customer(s); ${failed.length} failed.`
        : `Marketing email sent to ${sentCount} customer(s).`,
      sentCount,
      failedCount: failed.length
    });
  } catch (error) {
    logError("Marketing bulk email send error:", error);
    res.status(500).json({ error: error?.message || "Could not send marketing email." });
  }
});

app.get("/api/admin/reports/sellers", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const startDate = String(req.query.start || "").trim();
    const endDate = String(req.query.end || "").trim();

    if (!isValidReportDate(startDate) || !isValidReportDate(endDate)) {
      return res.status(400).json({ error: "Valid start and end dates are required." });
    }

    if (startDate > endDate) {
      return res.status(400).json({ error: "Start date cannot be after end date." });
    }

    const result = await pool.query(
      `
        SELECT
          s.id,
          s.name,
          s.referral_code,
          s.active,
          s.commission_rate,
          COUNT(o.id) FILTER (WHERE o.status IN ('Paid', 'Creating', 'Ready'))::int AS pending_order_count,
          COALESCE(SUM(o.price_amount) FILTER (WHERE o.status IN ('Paid', 'Creating', 'Ready')), 0)::numeric AS pending_sales_total,
          COUNT(o.id) FILTER (WHERE o.status = 'Delivered')::int AS earned_order_count,
          COALESCE(SUM(o.price_amount) FILTER (WHERE o.status = 'Delivered'), 0)::numeric AS earned_sales_total,
          COALESCE(SUM(o.seller_commission_amount) FILTER (WHERE o.status = 'Delivered'), 0)::numeric AS commission_earned
        FROM sellers s
        LEFT JOIN orders o
          ON o.seller_id = s.id
          AND o.paid_at IS NOT NULL
          AND o.is_test = FALSE
          AND (o.paid_at AT TIME ZONE 'America/New_York')::date >= $1::date
          AND (o.paid_at AT TIME ZONE 'America/New_York')::date <= $2::date
        GROUP BY s.id
        ORDER BY earned_sales_total DESC, pending_sales_total DESC, s.name ASC
      `,
      [startDate, endDate]
    );

    const sellers = result.rows;

    const owedResult = await pool.query(`
      SELECT
        s.id AS seller_id,
        COALESCE(SUM(o.seller_commission_amount), 0)::numeric AS commission_owed
      FROM sellers s
      LEFT JOIN orders o
        ON o.seller_id = s.id
        AND o.paid_at IS NOT NULL
        AND o.is_test = FALSE
        AND o.status = 'Delivered'
        AND o.seller_commission_amount IS NOT NULL
        AND o.seller_payout_id IS NULL
      GROUP BY s.id
    `);

    const owedBySeller = new Map(
      owedResult.rows.map(row => [
        String(row.seller_id),
        Number(row.commission_owed || 0)
      ])
    );

    for (const seller of sellers) {
      seller.commission_owed = owedBySeller.get(String(seller.id)) || 0;
    }

    const sellerPendingOrders = sellers.reduce(
      (sum, seller) => sum + Number(seller.pending_order_count || 0),
      0
    );

    const sellerPendingSales = sellers.reduce(
      (sum, seller) => sum + Number(seller.pending_sales_total || 0),
      0
    );

    const sellerEarnedOrders = sellers.reduce(
      (sum, seller) => sum + Number(seller.earned_order_count || 0),
      0
    );

    const sellerEarnedSales = sellers.reduce(
      (sum, seller) => sum + Number(seller.earned_sales_total || 0),
      0
    );

    const sellerCommissionEarned = sellers.reduce(
      (sum, seller) => sum + Number(seller.commission_earned || 0),
      0
    );

    const sellerCommissionOwed = sellers.reduce(
      (sum, seller) => sum + Number(seller.commission_owed || 0),
      0
    );

    res.json({
      startDate,
      endDate,
      sellerCount: sellers.length,
      sellerPendingOrders,
      sellerPendingSales,
      sellerEarnedOrders,
      sellerEarnedSales,
      sellerCommissionEarned,
      sellerCommissionOwed,
      sellers
    });
  } catch (error) {
    logError("Admin seller report error:", error);
    res.status(500).json({ error: "Could not load seller report." });
  }
});


app.get("/api/admin/accounting-summary", requireAdmin, async (_req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const expensesResult = await pool.query(`
      SELECT
        COALESCE(SUM(amount) FILTER (WHERE status = 'Unpaid'), 0)::numeric AS unpaid_bills,
        COALESCE(SUM(amount) FILTER (WHERE status = 'Paid'), 0)::numeric AS paid_costs_all_time,
        COALESCE(
          SUM(amount) FILTER (
            WHERE status = 'Paid'
              AND paid_date >= date_trunc('month', CURRENT_DATE)::date
              AND paid_date <= CURRENT_DATE
          ),
          0
        )::numeric AS paid_costs_month,
        COALESCE(
          SUM(amount) FILTER (
            WHERE status = 'Paid'
              AND paid_date >= date_trunc('year', CURRENT_DATE)::date
              AND paid_date <= CURRENT_DATE
          ),
          0
        )::numeric AS paid_costs_ytd
      FROM accounts_payable
    `);

    const salesResult = await pool.query(`
      SELECT
        COALESCE(SUM(price_amount), 0)::numeric AS sales_ytd
      FROM orders
      WHERE paid_at IS NOT NULL
        AND is_test = FALSE
        AND (paid_at AT TIME ZONE 'America/New_York')::date
          >= date_trunc('year', CURRENT_DATE)::date
        AND (paid_at AT TIME ZONE 'America/New_York')::date
          <= CURRENT_DATE
    `);

    const commissionResult = await pool.query(`
      SELECT
        COALESCE(
          SUM(seller_commission_amount) FILTER (
            WHERE status = 'Delivered'
              AND paid_at IS NOT NULL
              AND is_test = FALSE
              AND (paid_at AT TIME ZONE 'America/New_York')::date
                >= date_trunc('year', CURRENT_DATE)::date
              AND (paid_at AT TIME ZONE 'America/New_York')::date
                <= CURRENT_DATE
          ),
          0
        )::numeric AS commission_earned_ytd,
        COALESCE(
          SUM(seller_commission_amount) FILTER (
            WHERE status = 'Delivered'
              AND paid_at IS NOT NULL
              AND is_test = FALSE
              AND seller_commission_amount IS NOT NULL
              AND seller_payout_id IS NULL
          ),
          0
        )::numeric AS commission_owed
      FROM orders
    `);

    const generationCostResult = await pool.query(`
      SELECT
        COALESCE(SUM(gc.estimated_cost), 0)::numeric AS tracked_ai_generation_cost,
        COALESCE(
          SUM(gc.estimated_cost) FILTER (
            WHERE o.paid_at IS NOT NULL
              AND o.is_test = FALSE
          ),
          0
        )::numeric AS paid_order_generation_cost,
        COALESCE(
          SUM(gc.estimated_cost) FILTER (
            WHERE o.paid_at IS NOT NULL
              AND o.is_test = FALSE
              AND o.status = 'Delivered'
          ),
          0
        )::numeric AS delivered_order_generation_cost,
        COUNT(DISTINCT gc.order_id) FILTER (
          WHERE o.paid_at IS NOT NULL
            AND o.is_test = FALSE
        )::integer AS paid_orders_with_generation_cost,
        COALESCE(
          SUM(
            CASE
              WHEN o.paid_at IS NOT NULL
                AND o.is_test = FALSE
                AND o.status = 'Delivered'
                THEN CASE WHEN o.includes_extra_version THEN 2 ELSE 1 END
              ELSE 0
            END
          ) FILTER (
            WHERE gc.id = (
              SELECT MIN(gc2.id)
              FROM generation_costs gc2
              WHERE gc2.order_id = gc.order_id
            )
          ),
          0
        )::integer AS delivered_versions_with_generation_cost
      FROM generation_costs gc
      LEFT JOIN orders o ON o.id = gc.order_id
    `);

    const expenses = expensesResult.rows[0] || {};
    const sales = salesResult.rows[0] || {};
    const commissions = commissionResult.rows[0] || {};
    const generationCosts = generationCostResult.rows[0] || {};

    const unpaidBills = Number(expenses.unpaid_bills || 0);
    const paidCostsAllTime = Number(expenses.paid_costs_all_time || 0);
    const paidCostsMonth = Number(expenses.paid_costs_month || 0);
    const paidCostsYtd = Number(expenses.paid_costs_ytd || 0);
    const salesYtd = Number(sales.sales_ytd || 0);
    const commissionEarnedYtd = Number(commissions.commission_earned_ytd || 0);
    const commissionOwed = Number(commissions.commission_owed || 0);
    const trackedAiGenerationCost =
      Number(generationCosts.tracked_ai_generation_cost || 0);
    const paidOrderGenerationCost =
      Number(generationCosts.paid_order_generation_cost || 0);
    const paidOrdersWithGenerationCost =
      Number(generationCosts.paid_orders_with_generation_cost || 0);
    const deliveredOrderGenerationCost =
      Number(generationCosts.delivered_order_generation_cost || 0);
    const deliveredVersionsWithGenerationCost =
      Number(generationCosts.delivered_versions_with_generation_cost || 0);
    const avgAiCostPerPaidOrder =
      paidOrdersWithGenerationCost > 0
        ? paidOrderGenerationCost / paidOrdersWithGenerationCost
        : 0;
    const avgAiCostPerDeliveredVersion =
      deliveredVersionsWithGenerationCost > 0
        ? deliveredOrderGenerationCost / deliveredVersionsWithGenerationCost
        : 0;

    const estimatedNetYtd =
      salesYtd - paidCostsYtd - commissionEarnedYtd;

    res.json({
      unpaidBills,
      paidCostsAllTime,
      paidCostsMonth,
      paidCostsYtd,
      salesYtd,
      commissionEarnedYtd,
      commissionOwed,
      trackedAiGenerationCost,
      avgAiCostPerPaidOrder,
      avgAiCostPerDeliveredVersion,
      estimatedNetYtd
    });
  } catch (error) {
    logError("Admin accounting summary error:", error);
    res.status(500).json({ error: "Could not load accounting summary." });
  }
});


app.get("/api/admin/generation-costs/:orderId", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const orderId = String(req.params.orderId || "").trim();

    if (!orderId) {
      return res.status(400).json({ error: "Order ID is required." });
    }

    const result = await pool.query(
      `SELECT
         order_id,
         generation_type,
         provider,
         model,
         version_number,
         duration_seconds,
         input_tokens,
         output_tokens,
         input_rate_per_million,
         output_rate_per_million,
         rate_per_minute,
         estimated_cost,
         created_at
       FROM generation_costs
       WHERE order_id = $1
       ORDER BY created_at ASC`,
      [orderId]
    );

    const totalEstimatedCost = result.rows.reduce(
      (sum, row) => sum + Number(row.estimated_cost || 0),
      0
    );

    res.json({
      orderId,
      totalEstimatedCost,
      generationCosts: result.rows
    });
  } catch (error) {
    logError("Admin generation costs error:", error);
    res.status(500).json({ error: "Could not load generation costs." });
  }
});


app.get("/api/admin/store-settings", requireAdmin, async (_req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(
      `SELECT setting_key, setting_value FROM store_settings`
    );

    const settings = Object.fromEntries(
      result.rows.map(row => [row.setting_key, row.setting_value])
    );

    res.json({
      songPrice: settings.song_price || "19.99",
      orderingOpen: (settings.ordering_open ?? "true") === "true",
      turnaroundMessage: settings.turnaround_message ?? "Your custom StorySong will typically be ready within 2–3 days.",
      announcementEnabled: (settings.announcement_enabled ?? "false") === "true",
      announcementMessage: settings.announcement_message ?? "",
      reviewsEnabled: (settings.reviews_enabled ?? "true") === "true"
    });
  } catch (error) {
    logError("Store settings error:", error);
    res.status(500).json({ error: "Could not load store settings." });
  }
});

app.patch("/api/admin/store-settings", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const rawPrice = String(req.body?.songPrice ?? "").trim();
    const price = Number(rawPrice);

    if (!Number.isFinite(price) || price <= 0 || price > 1000) {
      return res.status(400).json({ error: "Enter a valid song price." });
    }

    const formattedPrice = price.toFixed(2);
    const orderingOpen = req.body?.orderingOpen === true;
    const turnaroundMessage = String(req.body?.turnaroundMessage ?? "").trim();
    const announcementEnabled = req.body?.announcementEnabled === true;
    const announcementMessage = String(req.body?.announcementMessage ?? "").trim();
    const reviewsEnabled = req.body?.reviewsEnabled === true;

    if (!turnaroundMessage || turnaroundMessage.length > 300) {
      return res.status(400).json({
        error: "Turnaround message must be between 1 and 300 characters."
      });
    }

    if (announcementMessage.length > 500) {
      return res.status(400).json({
        error: "Announcement message cannot exceed 500 characters."
      });
    }

    const settings = [
      ["song_price", formattedPrice],
      ["ordering_open", String(orderingOpen)],
      ["turnaround_message", turnaroundMessage],
      ["announcement_enabled", String(announcementEnabled)],
      ["announcement_message", announcementMessage],
      ["reviews_enabled", String(reviewsEnabled)]
    ];

    for (const [key, value] of settings) {
      await pool.query(
        `INSERT INTO store_settings (setting_key, setting_value)
         VALUES ($1, $2)
         ON CONFLICT (setting_key)
         DO UPDATE SET setting_value = EXCLUDED.setting_value`,
        [key, value]
      );
    }

    res.json({
      ok: true,
      songPrice: formattedPrice,
      orderingOpen,
      turnaroundMessage,
      announcementEnabled,
      announcementMessage,
      reviewsEnabled
    });
  } catch (error) {
    logError("Store settings update error:", error);
    res.status(500).json({ error: "Could not save store settings." });
  }
});

app.get("/api/admin/reviews", requireAdmin, async (_req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(`
      SELECT
        reviews.id,
        reviews.order_id,
        reviews.rating,
        reviews.review_text,
        reviews.display_name,
        reviews.approved,
        reviews.created_at,
        orders.customer_name,
        orders.song_title
      FROM reviews
      JOIN orders ON orders.id = reviews.order_id
      ORDER BY reviews.created_at DESC
    `);

    res.json({ reviews: result.rows });
  } catch (error) {
    logError("Admin reviews retrieval error:", error);
    res.status(500).json({ error: "Could not retrieve customer reviews." });
  }
});

app.patch("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    if (typeof req.body?.approved !== "boolean") {
      return res.status(400).json({ error: "Approved must be true or false." });
    }

    const result = await pool.query(
      `UPDATE reviews
       SET approved = $1
       WHERE id = $2
       RETURNING id, approved`,
      [req.body.approved, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Review not found." });
    }

    res.json({
      ok: true,
      id: result.rows[0].id,
      approved: result.rows[0].approved
    });
  } catch (error) {
    logError("Admin review update error:", error);
    res.status(500).json({ error: "Could not update customer review." });
  }
});

app.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(
      "DELETE FROM reviews WHERE id = $1 RETURNING id",
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Review not found." });
    }

    res.json({ ok: true });
  } catch (error) {
    logError("Admin review deletion error:", error);
    res.status(500).json({ error: "Could not delete customer review." });
  }
});

app.post("/api/admin/create-song", requireAdmin, async (req, res) => {
  let claimedOrderId = null;

  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const {
      customerName,
      email,
      person,
      occasion,
      style,
      mood,
      vocalGender,
      vocalStyle,
      tempo,
      duet,
      instruments,
      story,
      message,
      songLength
    } = req.body;

    if (!customerName || !email || !person || !occasion || !style || !mood || !story) {
      return res.status(400).json({ error: "Please complete all required song fields." });
    }

    const allowedSongLengths = [90, 120, 150];
    const selectedSongLength = Number(songLength);

    if (!allowedSongLengths.includes(selectedSongLength)) {
      return res.status(400).json({ error: "Please choose a valid song length." });
    }

    const musicLengthMs = selectedSongLength * 1000;

    const orderId = `SS-${Date.now()}`;
    const deliveryToken = crypto.randomBytes(32).toString("hex");
    const previewToken = crypto.randomBytes(32).toString("hex");

    await pool.query(
      `INSERT INTO orders (
        id,
        customer_name,
        email,
        person,
        occasion,
        style,
        song_length,
        vocal_gender,
        vocal_style,
        tempo,
        duet,
        instruments,
        mood,
        story,
        message,
        status,
        delivery_token,
        preview_token,
        price_amount
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'Creating',$16,$17,0
      )`,
      [
        orderId,
        String(customerName).trim(),
        String(email).trim(),
        String(person).trim(),
        occasion,
        style,
        selectedSongLength,
        vocalGender || "Any",
        vocalStyle || "Warm and expressive",
        tempo || "Medium",
        duet || "No duet",
        String(instruments || "").trim(),
        mood,
        String(story).trim(),
        String(message || "").trim(),
        deliveryToken,
        previewToken
      ]
    );

    const prompt = `Write a complete, original personalized song.

Person: ${person}

Occasion: ${occasion}

Story / memories: ${story}

Music era / style: ${style}

Mood: ${mood}

Lead vocal preference: ${vocalGender || "Any"}

Vocal style: ${vocalStyle || "Warm and expressive"}

Tempo: ${tempo || "Medium"}

Duet preference: ${duet || "No duet"}

Instrument preferences: ${instruments || "No preference"}

Special message: ${message || "None"}

Requirements:

- Write an original song inspired by the requested style, without copying any existing song or artist.

- Include a memorable song title on the first line.

- Use clear section headings such as [Verse 1], [Chorus], [Verse 2], and [Bridge] when appropriate.

- Make the personal details feel natural and memorable.

- Match the lyrical rhythm and energy to the requested tempo.

- Return only the song, with the title on the first line followed by clear section headings.`;

    const lyricsResponse = await openai.responses.create({
      model: "gpt-5.6-luna",
      input: prompt
    });

    const inputTokens = Number(lyricsResponse.usage?.input_tokens || 0);
    const outputTokens = Number(lyricsResponse.usage?.output_tokens || 0);
    const openAiInputRatePerMillion = 0.20;
    const openAiOutputRatePerMillion = 1.20;
    const openAiEstimatedCost =
      (inputTokens / 1000000) * openAiInputRatePerMillion +
      (outputTokens / 1000000) * openAiOutputRatePerMillion;

    try {
      await pool.query(
        `INSERT INTO generation_costs
         (order_id, generation_type, provider, model, input_tokens, output_tokens,
          input_rate_per_million, output_rate_per_million, estimated_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          orderId,
          "lyrics",
          "OpenAI",
          "gpt-5.6-luna",
          inputTokens,
          outputTokens,
          openAiInputRatePerMillion,
          openAiOutputRatePerMillion,
          openAiEstimatedCost
        ]
      );
    } catch (costError) {
      logError("OpenAI generation cost tracking error:", costError);
    }

    const lyrics = lyricsResponse.output_text;

    if (!lyrics?.trim()) {
      throw new Error("Lyrics generation returned no song.");
    }

    const firstLine =
      lyrics.split(/\r?\n/).map(value => value.trim()).find(Boolean) || "Personal Song";

    const songTitle =
      firstLine
        .replace(/^#{1,6}\s*/, "")
        .replace(/^\*+|\*+$/g, "")
        .replace(/^title\s*:\s*/i, "")
        .trim() || "Personal Song";

    await pool.query(
      "UPDATE orders SET song_title = $1, lyrics = $2 WHERE id = $3",
      [songTitle, lyrics, orderId]
    );

    const claimResult = await pool.query(
      `UPDATE orders
       SET music_generation_started_at = NOW()
       WHERE id = $1
         AND music_data IS NULL
         AND (
           music_generation_started_at IS NULL
           OR music_generation_started_at < NOW() - INTERVAL '15 minutes'
         )
       RETURNING id`,
      [orderId]
    );

    if (!claimResult.rows.length) {
      return res.status(409).json({ error: "Song generation is already in progress." });
    }

    claimedOrderId = orderId;

    const musicPrompt = `Create a fully produced original song with vocals using these lyrics.

STYLE: ${style || "pop"}

MOOD: ${mood || "happy"}

TEMPO: ${tempo || "Medium"}

LEAD VOCAL: ${vocalGender || "Any"}; ${vocalStyle || "Warm and expressive"}

DUET: ${duet || "No duet"}

INSTRUMENT PREFERENCES: ${instruments || "No preference"}

ARRANGEMENT: full, polished production with a catchy original melody.

LYRICS:

${lyrics}

Do not imitate a specific living artist or copy an existing song.`;

    const elevenResponse = await fetch(
      "https://api.elevenlabs.io/v1/music?output_format=mp3_48000_192",
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: musicPrompt.slice(0, 4100),
          music_length_ms: musicLengthMs,
          model_id: "music_v2",
          force_instrumental: false,
          store_for_inpainting: true
        })
      }
    );

    if (!elevenResponse.ok) {
      await pool.query(
        "UPDATE orders SET music_generation_started_at = NULL WHERE id = $1",
        [orderId]
      );

      claimedOrderId = null;

      return res.status(elevenResponse.status).json({
        error: "Music generation failed."
      });
    }

    const elevenlabsSongId = elevenResponse.headers.get("song-id");
    const arrayBuffer = await elevenResponse.arrayBuffer();
    const musicBuffer = Buffer.from(arrayBuffer);

    await pool.query(
      `UPDATE orders
       SET music_data = $1,
           music_content_type = $2,
           elevenlabs_song_id = $3,
           status = 'Preview',
           music_generation_started_at = NULL
       WHERE id = $4`,
      [musicBuffer, "audio/mpeg", elevenlabsSongId, orderId]
    );

    const elevenLabsRatePerMinute = 0.15;
    const elevenLabsEstimatedCost =
      (selectedSongLength / 60) * elevenLabsRatePerMinute;

    try {
      await pool.query(
        `INSERT INTO generation_costs
         (order_id, generation_type, provider, model, version_number,
          duration_seconds, rate_per_minute, estimated_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          orderId,
          "original_music",
          "ElevenLabs",
          "music_v2",
          1,
          selectedSongLength,
          elevenLabsRatePerMinute,
          elevenLabsEstimatedCost
        ]
      );
    } catch (costError) {
      logError("ElevenLabs original music cost tracking error:", costError);
    }

    claimedOrderId = null;

    res.json({
      ok: true,
      orderId,
      previewToken,
      songTitle,
      songLength: selectedSongLength,
      status: "Preview"
    });
  } catch (error) {
    if (claimedOrderId) {
      try {
        await pool.query(
          "UPDATE orders SET music_generation_started_at = NULL WHERE id = $1",
          [claimedOrderId]
        );
      } catch (releaseError) {
        logError("Admin create song lock release error:", releaseError);
      }
    }

    logError("Admin create song error:", error);
    res.status(500).json({
      error: error?.message || "Could not create the StorySong."
    });
  }
});



app.post("/api/admin/create-song/:orderId/retry-preview", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(503).json({ error: "Music generation is not configured." });
    }

    const style = String(req.body?.style || "").trim();
    const mood = String(req.body?.mood || "").trim();
    const vocalGender = String(req.body?.vocalGender || "").trim();
    const vocalStyle = String(req.body?.vocalStyle || "").trim();
    const tempo = String(req.body?.tempo || "").trim();
    const duet = String(req.body?.duet || "").trim();
    const instruments = String(req.body?.instruments || "").trim();

    if (!style) {
      return res.status(400).json({ error: "Please choose a music style." });
    }

    const orderResult = await pool.query(
      `SELECT id, status, preview_token, song_title, lyrics, style, mood,
              vocal_gender, vocal_style, tempo, duet, instruments,
              song_length, music_data, music_content_type,
              elevenlabs_song_id,
              music_data IS NOT NULL AS has_music
       FROM orders
       WHERE id = $1`,
      [req.params.orderId]
    );

    if (!orderResult.rows.length) {
      return res.status(404).json({ error: "Order not found." });
    }

    const order = orderResult.rows[0];

    if (order.status !== "Preview") {
      return res.status(400).json({
        error: "Only a song still in Preview can create another preview."
      });
    }

    if (!order.has_music || !order.lyrics) {
      return res.status(400).json({
        error: "The original preview must be ready before creating another preview."
      });
    }

    await pool.query(
      `INSERT INTO song_versions
       (order_id, version_number, song_title, lyrics, music_style,
        music_data, music_content_type, elevenlabs_song_id)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (order_id, version_number) DO NOTHING`,
      [
        order.id,
        order.song_title,
        order.lyrics,
        order.style,
        order.music_data,
        order.music_content_type,
        order.elevenlabs_song_id
      ]
    );

    const versionResult = await pool.query(
      `INSERT INTO song_versions
       (order_id, version_number, song_title, lyrics, music_style)
       VALUES (
         $1,
         COALESCE(
           (SELECT MAX(version_number) + 1
            FROM song_versions
            WHERE order_id = $1),
           2
         ),
         $2,
         $3,
         $4
       )
       RETURNING id, version_number`,
      [
        order.id,
        order.song_title,
        order.lyrics,
        style
      ]
    );

    const version = versionResult.rows[0];

    const musicPrompt = `Create a fully produced original song with vocals using these exact lyrics.

STYLE: ${style}

MOOD: ${mood || order.mood || "happy"}

TEMPO: ${tempo || order.tempo || "Medium"}

LEAD VOCAL: ${vocalGender || order.vocal_gender || "Any"}; ${vocalStyle || order.vocal_style || "Warm and expressive"}

DUET: ${duet || order.duet || "No duet"}

INSTRUMENT PREFERENCES: ${instruments || order.instruments || "No preference"}

ARRANGEMENT: Create a fresh musical interpretation in the requested style with a catchy original melody. Keep the lyrics exactly as provided. Do not rewrite, shorten, expand, or reorder the lyrics.

LYRICS:

${order.lyrics}

Do not imitate a specific living artist or copy an existing song.`;

    const elevenResponse = await fetch(
      "https://" + "api.elevenlabs.io" + "/v1/music?output" + "_format=mp3" + "_48000" + "_192",
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: musicPrompt.slice(0, 4100),
          music_length_ms: (order.song_length || 90) * 1000,
          model_id: "music_v2",
          force_instrumental: false,
          store_for_inpainting: true
        })
      }
    );

    if (!elevenResponse.ok) {
      const errorText = await elevenResponse.text();

      await pool.query(
        "DELETE FROM song_versions WHERE id = $1",
        [version.id]
      );

      throw new Error(
        `Admin preview retry generation failed (${elevenResponse.status}): ${errorText}`
      );
    }

    const elevenlabsSongId = elevenResponse.headers.get("song-id");
    const arrayBuffer = await elevenResponse.arrayBuffer();
    const musicBuffer = Buffer.from(arrayBuffer);

    await pool.query(
      `UPDATE song_versions
       SET music_data = $1,
           music_content_type = $2,
           elevenlabs_song_id = $3
       WHERE id = $4`,
      [
        musicBuffer,
        "audio/mpeg",
        elevenlabsSongId,
        version.id
      ]
    );

    const durationSeconds = order.song_length || 90;
    const ratePerMinute = 0.15;
    const estimatedCost = (durationSeconds / 60) * ratePerMinute;

    try {
      await pool.query(
        `INSERT INTO generation_costs
         (order_id, generation_type, provider, model, version_number,
          duration_seconds, rate_per_minute, estimated_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          order.id,
          "alternate_music",
          "ElevenLabs",
          "music_v2",
          version.version_number,
          durationSeconds,
          ratePerMinute,
          estimatedCost
        ]
      );
    } catch (costError) {
      logError("Admin preview retry cost tracking error:", costError);
    }

    await pool.query(
      `UPDATE orders
       SET style = $1,
           mood = $2,
           vocal_gender = $3,
           vocal_style = $4,
           tempo = $5,
           duet = $6,
           instruments = $7
       WHERE id = $8`,
      [
        style,
        mood || order.mood,
        vocalGender || order.vocal_gender,
        vocalStyle || order.vocal_style,
        tempo || order.tempo,
        duet || order.duet,
        instruments || order.instruments,
        order.id
      ]
    );

    res.json({
      ok: true,
      ready: true,
      orderId: order.id,
      previewToken: order.preview_token,
      versionNumber: version.version_number,
      songTitle: order.song_title || "StorySong",
      songLength: durationSeconds,
      musicStyle: style
    });
  } catch (error) {
    logError("Admin preview retry generation error:", error);

    res.status(500).json({
      error: error?.message || "Could not create another preview."
    });
  }
});

app.post("/api/admin/create-song/:orderId/approve", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(
      `UPDATE orders
       SET status = 'Ready'
       WHERE id = $1
         AND status = 'Preview'
         AND music_data IS NOT NULL
       RETURNING id, song_title`,
      [req.params.orderId]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "Preview song was not found or is not ready to approve."
      });
    }

    res.json({
      ok: true,
      orderId: result.rows[0].id,
      songTitle: result.rows[0].song_title || "Your StorySong",
      status: "Ready"
    });
  } catch (error) {
    logError("Admin approve song error:", error);
    res.status(500).json({
      error: error?.message || "Could not approve the StorySong."
    });
  }
});


app.get("/api/admin/orders", requireAdmin, async (_req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(`
      SELECT
        orders.id,
        customer_name,
        orders.email AS email,
        person,
        occasion,
        style,
        song_length,
        vocal_gender,
        vocal_style,
        tempo,
        duet,
        instruments,
        mood,
        story,
        message,
        status,
        is_test,
        price_amount,
        selected_version_number,
        includes_extra_version,
        extra_version_number,
        extra_version_price,
        orders.created_at,
        paid_at,
        song_title,
        lyrics,
        delivery_token,
        (music_data IS NOT NULL) AS has_music,
        (elevenlabs_song_id IS NOT NULL) AS can_revise,
        (SELECT COUNT(*)::int FROM song_versions WHERE song_versions.order_id = orders.id) AS version_count,
        sellers.name AS seller_name,
        sellers.referral_code AS seller_referral_code
      FROM orders
      LEFT JOIN sellers ON sellers.id = orders.seller_id
      ORDER BY orders.created_at DESC
    `);

    res.json({ orders: result.rows });
  } catch (error) {
    logError("Admin orders error:", error);
    res.status(500).json({ error: "Could not load orders." });
  }
});



app.patch("/api/admin/orders/:id/song", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const songTitle = String(req.body?.songTitle || "").trim();
    const lyrics = String(req.body?.lyrics || "").trim();

    if (!songTitle || !lyrics) {
      return res.status(400).json({ error: "Song title and lyrics are required." });
    }

    const result = await pool.query(
      "UPDATE orders SET song_title = $1, lyrics = $2 WHERE id = $3 RETURNING id, song_title, lyrics",
      [songTitle, lyrics, req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Order not found." });
    }

    res.json({ ok: true, order: result.rows[0] });
  } catch (error) {
    logError("Admin song save error:", error);
    res.status(500).json({ error: "Could not save song." });
  }
});

app.patch("/api/admin/orders/:id/status", requireAdmin, async (req, res) => {
try {
if (!pool) {
return res.status(503).json({ error: "Order database is not configured." });
}
const allowedStatuses = ["New", "Paid", "Creating", "Ready", "Delivered"];
const status = String(req.body?.status || "");
if (!allowedStatuses.includes(status)) {
return res.status(400).json({ error: "Invalid order status." });
}
let result;

if (status === "Delivered") {
  result = await pool.query(
    `
      UPDATE orders o
      SET
        status = $1,
        seller_commission_rate = CASE
          WHEN o.seller_id IS NOT NULL
            AND o.paid_at IS NOT NULL
            AND o.seller_commission_rate IS NULL
          THEN s.commission_rate
          ELSE o.seller_commission_rate
        END,
        seller_commission_amount = CASE
          WHEN o.seller_id IS NOT NULL
            AND o.paid_at IS NOT NULL
            AND o.seller_commission_amount IS NULL
          THEN ROUND((o.price_amount * s.commission_rate / 100)::numeric, 2)
          ELSE o.seller_commission_amount
        END
      FROM sellers s
      WHERE o.id = $2
        AND o.seller_id = s.id
      RETURNING o.id, o.status
    `,
    [status, req.params.id]
  );

  if (!result.rows.length) {
    result = await pool.query(
      "UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status",
      [status, req.params.id]
    );
  }
} else {
  result = await pool.query(
    "UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status",
    [status, req.params.id]
  );
}
if (!result.rows.length) {
return res.status(404).json({ error: "Order not found." });
}
res.json({ ok: true, order: result.rows[0] });
} catch (error) {
logError("Admin status update error:", error);
res.status(500).json({ error: "Could not update order status." });
}
});



app.patch("/api/admin/orders/:id/test-status", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }
    if (typeof req.body?.isTest !== "boolean") {
      return res.status(400).json({ error: "isTest must be true or false." });
    }
    const result = await pool.query(
      "UPDATE orders SET is_test = $1 WHERE id = $2 RETURNING id, is_test",
      [req.body.isTest, req.params.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ error: "Order not found." });
    }
    res.json({ ok: true, order: result.rows[0] });
  } catch (error) {
    logError("Admin test order update error:", error);
    res.status(500).json({ error: "Could not update test order status." });
  }
});


app.post("/api/admin/orders/:id/revise-lyrics", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const instructions = String(req.body?.instructions || "").trim();

    if (!instructions) {
      return res.status(400).json({ error: "Revision instructions are required." });
    }

    const orderResult = await pool.query(
      `SELECT id, song_title, lyrics, style, music_data, music_content_type, elevenlabs_song_id
       FROM orders
       WHERE id = $1`,
      [req.params.id]
    );

    if (!orderResult.rows.length) {
      return res.status(404).json({ error: "Order not found." });
    }

    const order = orderResult.rows[0];

    if (!order.lyrics || !order.music_data || !order.elevenlabs_song_id) {
      return res.status(400).json({ error: "This song is not ready for revision." });
    }

    await pool.query(
      `INSERT INTO song_versions
       (order_id, version_number, song_title, lyrics, music_style, music_data, music_content_type, elevenlabs_song_id)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (order_id, version_number) DO NOTHING`,
      [
        order.id,
        order.song_title,
        order.lyrics,
        order.style,
        order.music_data,
        order.music_content_type,
        order.elevenlabs_song_id
      ]
    );

    const prompt = `Revise this personalized song according to the requested changes.

CRITICAL MUSIC-MATCHING RULES:

- Preserve the exact song structure and section order.
- Preserve the exact number of lyric lines in every section.
- For every changed line, keep the syllable count as close as possible to the original line.
- Preserve the original rhythmic stress pattern and natural word emphasis.
- Keep changed lines similar in length to the original lines.
- Do not add or remove verses, choruses, bridges, pre-choruses, or lyric lines.
- Change only the smallest amount of wording needed to satisfy the revision request.
- Leave every unaffected line exactly unchanged.
- Preserve rhyme placement and rhyme sounds whenever possible.
- Avoid adding extra words, filler words, or longer phrases that would alter the vocal timing.
- Keep clear section headings exactly in the same locations.
- Return the complete revised song.
- Put the song title on the first line.
- Do not include explanations, notes, commentary, syllable counts, or analysis.

REVISION REQUEST:

${instructions}

CURRENT SONG:

${order.lyrics}`;

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",
      input: prompt
    });

    const inputTokens = Number(response.usage?.input_tokens || 0);
    const outputTokens = Number(response.usage?.output_tokens || 0);
    const openAiInputRatePerMillion = 0.20;
    const openAiOutputRatePerMillion = 1.20;
    const openAiEstimatedCost =
      (inputTokens / 1000000) * openAiInputRatePerMillion +
      (outputTokens / 1000000) * openAiOutputRatePerMillion;

    const revisedLyrics = response.output_text;

    if (!revisedLyrics?.trim()) {
      throw new Error("Lyrics revision returned no song.");
    }

    const firstLine =
      revisedLyrics.split(/\r?\n/).map(value => value.trim()).find(Boolean) || order.song_title || "Personal Song";

    const revisedTitle =
      firstLine
        .replace(/^#{1,6}\s*/, "")
        .replace(/^\*+|\*+$/g, "")
        .replace(/^title\s*:\s*/i, "")
        .trim() || order.song_title || "Personal Song";

    const versionResult = await pool.query(
      `INSERT INTO song_versions
       (order_id, version_number, song_title, lyrics)
       VALUES (
         $1,
         COALESCE((SELECT MAX(version_number) + 1 FROM song_versions WHERE order_id = $1), 2),
         $2,
         $3
       )
       RETURNING id, version_number, song_title, lyrics`,
      [order.id, revisedTitle, revisedLyrics]
    );

    try {
      await pool.query(
        `INSERT INTO generation_costs
         (order_id, generation_type, provider, model, version_number,
          input_tokens, output_tokens, input_rate_per_million,
          output_rate_per_million, estimated_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          order.id,
          "lyrics_revision",
          "OpenAI",
          "gpt-5.6-luna",
          versionResult.rows[0].version_number,
          inputTokens,
          outputTokens,
          openAiInputRatePerMillion,
          openAiOutputRatePerMillion,
          openAiEstimatedCost
        ]
      );
    } catch (costError) {
      logError("Admin lyrics revision cost tracking error:", costError);
    }

    res.json({
      ok: true,
      version: versionResult.rows[0]
    });
  } catch (error) {
    logError("Admin lyrics revision error:", error);
    res.status(500).json({ error: error?.message || "Could not revise lyrics." });
  }
});


app.get("/api/admin/orders/:id/versions", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(
      `SELECT id, version_number, song_title, lyrics, music_style,
              (music_data IS NOT NULL) AS has_music,
              created_at
       FROM song_versions
       WHERE order_id = $1
       ORDER BY version_number ASC`,
      [req.params.id]
    );

    const orderResult = await pool.query(
      "SELECT selected_version_number FROM orders WHERE id = $1",
      [req.params.id]
    );

    res.json({
      versions: result.rows,
      selectedVersionNumber: orderResult.rows[0]?.selected_version_number || null
    });
  } catch (error) {
    logError("Admin song versions error:", error);
    res.status(500).json({ error: "Could not load song versions." });
  }
});


app.get("/api/admin/orders/:id/versions/:versionNumber/music", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const versionNumber = Number(req.params.versionNumber);
    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      return res.status(400).json({ error: "Valid song version is required." });
    }

    const result = await pool.query(
      `SELECT music_data, music_content_type
       FROM song_versions
       WHERE order_id = $1 AND version_number = $2`,
      [req.params.id, versionNumber]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Song version not found." });
    }

    const version = result.rows[0];
    if (!version.music_data) {
      return res.status(404).json({ error: "Audio is not available for this song version." });
    }

    res.setHeader("Content-Type", version.music_content_type || "audio/mpeg");
    res.send(version.music_data);
  } catch (error) {
    logError("Admin song version audio error:", error);
    res.status(500).json({ error: "Could not load song version audio." });
  }
});


app.post("/api/admin/orders/:id/versions/:versionNumber/music", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(503).json({ error: "ElevenLabs is not configured." });
    }

    const versionNumber = Number(req.params.versionNumber);

    if (!Number.isInteger(versionNumber) || versionNumber < 2) {
      return res.status(400).json({ error: "A revised song version is required." });
    }

    const orderResult = await pool.query(
      `SELECT id, style, mood, vocal_gender, vocal_style, tempo, duet, instruments,
              song_length, elevenlabs_song_id
       FROM orders
       WHERE id = $1`,
      [req.params.id]
    );

    if (!orderResult.rows.length) {
      return res.status(404).json({ error: "Order not found." });
    }

    const order = orderResult.rows[0];

    if (!order.elevenlabs_song_id) {
      return res.status(400).json({ error: "The original song is not available for revision." });
    }

    const versionResult = await pool.query(
      `SELECT id, version_number, song_title, lyrics, music_data
       FROM song_versions
       WHERE order_id = $1 AND version_number = $2`,
      [order.id, versionNumber]
    );

    if (!versionResult.rows.length) {
      return res.status(404).json({ error: "Song version not found." });
    }

    const version = versionResult.rows[0];

    if (!version.lyrics) {
      return res.status(400).json({ error: "This version does not have revised lyrics." });
    }

    if (version.music_data) {
      return res.status(409).json({ error: "Music has already been generated for this version." });
    }

    const positiveStyles = [
      order.style,
      order.mood,
      order.vocal_gender,
      order.vocal_style,
      order.tempo,
      order.duet,
      order.instruments
    ].filter(Boolean);

    const lyricLines = version.lyrics.split(/\r?\n/);
    const firstSectionIndex = lyricLines.findIndex(line =>
      /^\s*\[[^\]]+\]\s*$/.test(line)
    );

    if (firstSectionIndex > 0) {
      lyricLines.splice(0, firstSectionIndex);
    }

    const lyricSections = [];
    let currentSection = [];

    for (const line of lyricLines) {
      const trimmed = line.trim();
      const isSectionHeading = /^\[[^\]]+\]$/.test(trimmed);

      if (isSectionHeading && currentSection.length) {
        lyricSections.push(currentSection);
        currentSection = [];
      }

      if (trimmed) currentSection.push(line);
    }

    if (currentSection.length) {
      lyricSections.push(currentSection);
    }

    const lyricChunks = [];

    for (const section of lyricSections) {
      for (let i = 0; i < section.length; i += 30) {
        const text = section.slice(i, i + 30).join("\n").trim();
        if (text) lyricChunks.push(text);
      }
    }

    const totalDurationMs = (order.song_length || 90) * 1000;
    const chunkWeights = lyricChunks.map(text => {
      const sungLines = text
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(line => line && !/^\[[^\]]+\]$/.test(line));

      return Math.max(
        sungLines.reduce((sum, line) => sum + line.length, 0),
        1
      );
    });

    const totalWeight = chunkWeights.reduce(
      (sum, weight) => sum + weight,
      0
    );

    let assignedDurationMs = 0;

    const compositionPlan = {
      chunks: lyricChunks.map((text, index) => {
        const isLastChunk = index === lyricChunks.length - 1;

        const durationMs = isLastChunk
          ? totalDurationMs - assignedDurationMs
          : Math.round(
              totalDurationMs *
                (chunkWeights[index] / Math.max(totalWeight, 1))
            );

        assignedDurationMs += durationMs;

        const chunk = {
          text,
          duration_ms: durationMs,
          positive_styles: positiveStyles,
          negative_styles: [],
          context_adherence: "high"
        };

        if (index === 0) {
          chunk.conditioning_ref = {
            song_id: order.elevenlabs_song_id,
            range: { start_ms: 0, end_ms: 30000 }
          };
          chunk.condition_strength = "high";
        }

        return chunk;
      })
    };

    const elevenResponse = await fetch(
      "https://" + "api.elevenlabs.io" + "/v1/music?output" + "_format=mp3" + "_48000" + "_192",
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          composition_plan: compositionPlan,
          model_id: "music_v2",
          store_for_inpainting: true
        })
      }
    );

    if (!elevenResponse.ok) {
      const errorText = await elevenResponse.text();
      throw new Error(`ElevenLabs revision failed (${elevenResponse.status}): ${errorText}`);
    }

    const elevenlabsSongId = elevenResponse.headers.get("song-id");
    const arrayBuffer = await elevenResponse.arrayBuffer();
    const musicBuffer = Buffer.from(arrayBuffer);

    await pool.query(
      `UPDATE song_versions
       SET music_data = $1,
           music_content_type = $2,
           elevenlabs_song_id = $3
       WHERE id = $4`,
      [
        musicBuffer,
        "audio/mpeg",
        elevenlabsSongId,
        version.id
      ]
    );

    const revisionDurationSeconds = order.song_length || 90;
    const revisionRatePerMinute = 0.15;
    const revisionEstimatedCost =
      (revisionDurationSeconds / 60) * revisionRatePerMinute;

    try {
      await pool.query(
        `INSERT INTO generation_costs
         (order_id, generation_type, provider, model, version_number,
          duration_seconds, rate_per_minute, estimated_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          order.id,
          "revision_music",
          "ElevenLabs",
          "music_v2",
          versionNumber,
          revisionDurationSeconds,
          revisionRatePerMinute,
          revisionEstimatedCost
        ]
      );
    } catch (costError) {
      logError("Admin revision music cost tracking error:", costError);
    }

    res.json({
      ok: true,
      version_number: versionNumber,
      message: "Revised song audio created successfully."
    });
  } catch (error) {
    logError("Admin version music preparation error:", error);
    res.status(500).json({ error: error?.message || "Could not prepare revised song." });
  }
});


app.post("/api/admin/orders/:id/alternate-music", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(503).json({ error: "Music generation is not configured." });
    }

    const musicStyle = String(req.body?.musicStyle || "").trim();

    const allowedStyles = new Set([
      "1950s Rock & Roll", "1960s Pop / Rock", "1970s Classic Rock",
      "1980s Pop", "1990s Pop / Rock", "Classic Rock", "Country",
      "Modern Country", "Motown-inspired Soul", "Blues", "Jazz",
      "R&B / Soul", "Pop", "Rock", "Folk / Acoustic", "Ballad",
      "Dance / Party", "Other"
    ]);

    if (!allowedStyles.has(musicStyle)) {
      return res.status(400).json({ error: "Please choose a valid music style." });
    }

    const orderResult = await pool.query(
      `SELECT id, style, mood, vocal_gender, vocal_style, tempo, duet,
              instruments, song_length, song_title, lyrics,
              music_data, music_content_type, elevenlabs_song_id,
              music_data IS NOT NULL AS has_music
       FROM orders
       WHERE id = $1`,
      [req.params.id]
    );

    if (!orderResult.rows.length) {
      return res.status(404).json({ error: "Order not found." });
    }

    const order = orderResult.rows[0];

    if (!order.has_music || !order.lyrics) {
      return res.status(400).json({
        error: "The original song must be ready before creating different music."
      });
    }

    await pool.query(
      `INSERT INTO song_versions
       (order_id, version_number, song_title, lyrics, music_style,
        music_data, music_content_type, elevenlabs_song_id)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (order_id, version_number) DO NOTHING`,
      [
        order.id,
        order.song_title,
        order.lyrics,
        order.style,
        order.music_data,
        order.music_content_type,
        order.elevenlabs_song_id
      ]
    );

    const versionResult = await pool.query(
      `INSERT INTO song_versions
       (order_id, version_number, song_title, lyrics, music_style)
       VALUES (
         $1,
         COALESCE(
           (SELECT MAX(version_number) + 1
            FROM song_versions
            WHERE order_id = $1),
           2
         ),
         $2,
         $3,
         $4
       )
       RETURNING id, version_number`,
      [
        order.id,
        order.song_title,
        order.lyrics,
        musicStyle
      ]
    );

    const version = versionResult.rows[0];

    const musicPrompt = `Create a fully produced original song with vocals using these exact lyrics.

STYLE: ${musicStyle}
MOOD: ${order.mood || "happy"}
TEMPO: ${order.tempo || "Medium"}
LEAD VOCAL: ${order.vocal_gender || "Any"}; ${order.vocal_style || "Warm and expressive"}
DUET: ${order.duet || "No duet"}
INSTRUMENT PREFERENCES: ${order.instruments || "No preference"}

ARRANGEMENT: Create a fresh musical interpretation in the requested style with a catchy original melody. Keep the lyrics exactly as provided. Do not rewrite, shorten, expand, or reorder the lyrics.

LYRICS:
${order.lyrics}

Do not imitate a specific living artist or copy an existing song.`;

    const elevenResponse = await fetch(
      "https://" + "api.elevenlabs.io" + "/v1/music?output" + "_format=mp3" + "_48000" + "_192",
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: musicPrompt.slice(0, 4100),
          music_length_ms: (order.song_length || 90) * 1000,
          model_id: "music_v2",
          force_instrumental: false,
          store_for_inpainting: true
        })
      }
    );

    if (!elevenResponse.ok) {
      const errorText = await elevenResponse.text();

      await pool.query(
        "DELETE FROM song_versions WHERE id = $1",
        [version.id]
      );

      throw new Error(
        `Admin alternate music generation failed (${elevenResponse.status}): ${errorText}`
      );
    }

    const elevenlabsSongId = elevenResponse.headers.get("song-id");
    const arrayBuffer = await elevenResponse.arrayBuffer();
    const musicBuffer = Buffer.from(arrayBuffer);

    await pool.query(
      `UPDATE song_versions
       SET music_data = $1,
           music_content_type = $2,
           elevenlabs_song_id = $3
       WHERE id = $4`,
      [
        musicBuffer,
        "audio/mpeg",
        elevenlabsSongId,
        version.id
      ]
    );

    const alternateDurationSeconds = order.song_length || 90;
    const alternateRatePerMinute = 0.15;
    const alternateEstimatedCost =
      (alternateDurationSeconds / 60) * alternateRatePerMinute;

    try {
      await pool.query(
        `INSERT INTO generation_costs
         (order_id, generation_type, provider, model, version_number,
          duration_seconds, rate_per_minute, estimated_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          order.id,
          "alternate_music",
          "ElevenLabs",
          "music_v2",
          version.version_number,
          alternateDurationSeconds,
          alternateRatePerMinute,
          alternateEstimatedCost
        ]
      );
    } catch (costError) {
      logError("Admin alternate music cost tracking error:", costError);
    }

    res.json({
      ok: true,
      ready: true,
      versionNumber: version.version_number,
      songTitle: order.song_title || "StorySong",
      musicStyle
    });
  } catch (error) {
    logError("Admin alternate music generation error:", error);
    res.status(500).json({
      error: error?.message || "Could not create different music."
    });
  }
});


app.post("/api/admin/orders/:id/select-version", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const versionNumber = Number(req.body?.versionNumber);

    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      return res.status(400).json({ error: "Please choose a valid song version." });
    }

    const result = await pool.query(
      `UPDATE orders
       SET song_title = version.song_title,
           lyrics = version.lyrics,
           style = COALESCE(version.music_style, orders.style),
           music_data = version.music_data,
           music_content_type = version.music_content_type,
           elevenlabs_song_id = version.elevenlabs_song_id,
           selected_version_number = version.version_number
       FROM song_versions AS version
       WHERE orders.id = $1
         AND version.order_id = orders.id
         AND version.version_number = $2
         AND version.music_data IS NOT NULL
       RETURNING orders.id,
                 orders.song_title,
                 orders.style,
                 orders.selected_version_number`,
      [req.params.id, versionNumber]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        error: "That song version was not found or its audio is not ready."
      });
    }

    res.json({
      ok: true,
      versionNumber: result.rows[0].selected_version_number,
      songTitle: result.rows[0].song_title || "StorySong",
      musicStyle: result.rows[0].style
    });
  } catch (error) {
    logError("Admin song version selection error:", error);
    res.status(500).json({
      error: error?.message || "Could not select song version."
    });
  }
});


app.post("/api/admin/orders/:id/music", requireAdmin, async (req, res) => {
  let claimedOrderId = null;
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const orderResult = await pool.query(
      "SELECT id, status, person, style, mood, song_length, vocal_gender, vocal_style, tempo, duet, instruments, music_data IS NOT NULL AS has_music, music_generation_started_at, lyrics FROM orders WHERE id = $1",
      [req.params.id]
    );

    if (!orderResult.rows.length) {
      return res.status(404).json({ error: "Order not found." });
    }

    const order = orderResult.rows[0];

    if (order.has_music) {
      console.log("Admin music generation skipped - music already exists:", order.id);
      return res.status(409).json({ error: "Music has already been generated for this order." });
    }
    if (!["Paid", "Creating"].includes(order.status)) {
      return res.status(400).json({ error: "Order must be Paid or Creating before generating music." });
    }

    if (!order.lyrics) {
      return res.status(400).json({ error: "Create and save lyrics first." });
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(503).json({ error: "ElevenLabs is not configured." });
    }
    const claimResult = await pool.query(
      "UPDATE orders SET music_generation_started_at = NOW() WHERE id = $1 AND music_data IS NULL AND (music_generation_started_at IS NULL OR music_generation_started_at < NOW() - INTERVAL '15 minutes') RETURNING id",
      [order.id]
    );
    if (!claimResult.rows.length) {
      console.log("Admin music generation skipped - already generating:", order.id);
      return res.status(409).json({ error: "Music generation is already in progress for this order." });
    }

    claimedOrderId = order.id;
    console.log("Admin music generation started:", order.id);
    const musicPrompt = `Create a fully produced original song with vocals using these lyrics.

STYLE: ${order.style || "pop"}
MOOD: ${order.mood || "happy"}
TEMPO: ${order.tempo || "Medium"}
LEAD VOCAL: ${order.vocal_gender || "Any"}; ${order.vocal_style || "Warm and expressive"}
DUET: ${order.duet || "No duet"}
INSTRUMENT PREFERENCES: ${order.instruments || "No preference"}

ARRANGEMENT: full, polished production with a catchy original melody. Feature the requested instruments naturally when possible.

LYRICS:
${order.lyrics}

Do not imitate a specific living artist or copy an existing song.`;

    const elevenResponse = await fetch("https://api.elevenlabs.io/v1/music?output_format=mp3_48000_192", {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        prompt: musicPrompt.slice(0, 4100),
        music_length_ms: (order.song_length || 90) * 1000,
        model_id: "music_v2",
        force_instrumental: false,
        store_for_inpainting: true
      })
    });

    if (!elevenResponse.ok) {
      console.error("Admin music generation error:", elevenResponse.status);
      await pool.query("UPDATE orders SET music_generation_started_at = NULL WHERE id = $1", [order.id]);
      return res.status(elevenResponse.status).json({ error: "Music generation failed." });
    }

    const elevenlabsSongId = elevenResponse.headers.get("song-id");

    const arrayBuffer = await elevenResponse.arrayBuffer();
    const musicBuffer = Buffer.from(arrayBuffer);
    console.log("Admin music received:", order.id, musicBuffer.length, "bytes");

    const result = await pool.query(
      "UPDATE orders SET music_data = $1, music_content_type = $2, elevenlabs_song_id = $3, status = 'Ready', music_generation_started_at = NULL WHERE id = $4 RETURNING id, status",
      [musicBuffer, "audio/mpeg", elevenlabsSongId, req.params.id]
    );

    console.log("Admin music saved:", order.id, result.rows[0]);

    const adminMusicDurationSeconds = order.song_length || 90;
    const adminMusicRatePerMinute = 0.15;
    const adminMusicEstimatedCost =
      (adminMusicDurationSeconds / 60) * adminMusicRatePerMinute;

    try {
      await pool.query(
        `INSERT INTO generation_costs
         (order_id, generation_type, provider, model, version_number,
          duration_seconds, rate_per_minute, estimated_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          order.id,
          "original_music",
          "ElevenLabs",
          "music_v2",
          1,
          adminMusicDurationSeconds,
          adminMusicRatePerMinute,
          adminMusicEstimatedCost
        ]
      );
    } catch (costError) {
      logError("Admin original music cost tracking error:", costError);
    }

    res.json({ ok: true, order: result.rows[0] });
  } catch (error) {
    if (claimedOrderId) {
      try {
        await pool.query("UPDATE orders SET music_generation_started_at = NULL WHERE id = $1", [claimedOrderId]);
      } catch (releaseError) {
        logError("Admin music generation lock release error:", releaseError);
      }
    }
    logError("Admin music save error:", error);
    res.status(500).json({ error: error?.message || "Could not create and save music." });
  }
});


app.get("/api/admin/orders/:id/music", requireAdmin, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(
      "SELECT music_data, music_content_type FROM orders WHERE id = $1",
      [req.params.id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Order not found." });
    }

    const order = result.rows[0];

    if (!order.music_data) {
      return res.status(404).json({ error: "No generated music found for this order." });
    }

    res.setHeader("Content-Type", order.music_content_type || "audio/mpeg");
    res.setHeader("Content-Disposition", "inline");
    res.send(order.music_data);
  } catch (error) {
    logError("Admin music retrieval error:", error);
    res.status(500).json({ error: "Could not retrieve the song." });
  }
});




app.post("/api/order/preview/:token/generate", previewLimiter, async (req, res) => {
  let claimedOrderId = null;

  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const orderResult = await pool.query(
      `SELECT id, status, person, occasion, style, song_length, vocal_gender, vocal_style,
              tempo, duet, instruments, mood, story, message, song_title,
              lyrics, music_data IS NOT NULL AS has_music,
              music_generation_started_at
       FROM orders
       WHERE preview_token = $1`,
      [req.params.token]
    );

    if (!orderResult.rows.length) {
      return res.status(404).json({ error: "Preview order not found." });
    }

    const order = orderResult.rows[0];

    if (order.has_music) {
      return res.json({
        ok: true,
        ready: true,
        songTitle: order.song_title || "Your StorySong"
      });
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(503).json({ error: "Music generation is not configured." });
    }

    let lyrics = order.lyrics;
    let songTitle = order.song_title;

    if (!lyrics) {
      const prompt = `Write a complete, original personalized song.

Person: ${order.person}
Occasion: ${order.occasion}
Story / memories: ${order.story}
Music era / style: ${order.style}
Mood: ${order.mood}
Lead vocal preference: ${order.vocal_gender || "Any"}
Vocal style: ${order.vocal_style || "Warm and expressive"}
Tempo: ${order.tempo || "Medium"}
Duet preference: ${order.duet || "No duet"}
Instrument preferences: ${order.instruments || "No preference"}
Special message: ${order.message || "None"}

Requirements:
- Write an original song inspired by the requested style, without copying any existing song or artist.
- Include a memorable song title on the first line.
- Use clear section headings such as [Verse 1], [Chorus], [Verse 2], and [Bridge] when appropriate.
- Make the personal details feel natural and memorable.
- If a duet is requested, write natural alternating or shared vocal parts where appropriate.
- Match the lyrical rhythm and energy to the requested tempo.
- Return only the song, with the title on the first line followed by clear section headings.`;

      const response = await openai.responses.create({
        model: "gpt-5.6-luna",
        input: prompt
      });

      const inputTokens = Number(response.usage?.input_tokens || 0);
      const outputTokens = Number(response.usage?.output_tokens || 0);
      const openAiInputRatePerMillion = 0.20;
      const openAiOutputRatePerMillion = 1.20;
      const openAiEstimatedCost =
        (inputTokens / 1000000) * openAiInputRatePerMillion +
        (outputTokens / 1000000) * openAiOutputRatePerMillion;

      try {
        await pool.query(
          `INSERT INTO generation_costs
           (order_id, generation_type, provider, model, input_tokens, output_tokens,
            input_rate_per_million, output_rate_per_million, estimated_cost)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            order.id,
            "lyrics",
            "OpenAI",
            "gpt-5.6-luna",
            inputTokens,
            outputTokens,
            openAiInputRatePerMillion,
            openAiOutputRatePerMillion,
            openAiEstimatedCost
          ]
        );
      } catch (costError) {
        logError("Customer OpenAI generation cost tracking error:", costError);
      }

      lyrics = response.output_text;

      if (!lyrics?.trim()) {
        throw new Error("Lyrics generation returned no song.");
      }

      const firstLine =
        lyrics.split(/\r?\n/).map(s => s.trim()).find(Boolean) || "Personal Song";

      songTitle =
        firstLine
          .replace(/^#{1,6}\s*/, "")
          .replace(/^\*+|\*+$/g, "")
          .replace(/^title\s*:\s*/i, "")
          .trim() || "Personal Song";

      await pool.query(
        "UPDATE orders SET song_title = $1, lyrics = $2 WHERE id = $3",
        [songTitle, lyrics, order.id]
      );
    }

    const claimResult = await pool.query(
      `UPDATE orders
       SET music_generation_started_at = NOW()
       WHERE id = $1
         AND music_data IS NULL
         AND (
           music_generation_started_at IS NULL
           OR music_generation_started_at < NOW() - INTERVAL '15 minutes'
         )
       RETURNING id`,
      [order.id]
    );

    if (!claimResult.rows.length) {
      return res.status(409).json({
        error: "Your personalized preview is already being created."
      });
    }

    claimedOrderId = order.id;

    const musicPrompt = `Create a fully produced original song with vocals using these lyrics.

STYLE: ${order.style || "pop"}
MOOD: ${order.mood || "happy"}
TEMPO: ${order.tempo || "Medium"}
LEAD VOCAL: ${order.vocal_gender || "Any"}; ${order.vocal_style || "Warm and expressive"}
DUET: ${order.duet || "No duet"}
INSTRUMENT PREFERENCES: ${order.instruments || "No preference"}

ARRANGEMENT: full, polished production with a catchy original melody. Feature the requested instruments naturally when possible.

LYRICS:
${lyrics}

Do not imitate a specific living artist or copy an existing song.`;

    const elevenResponse = await fetch(
      "https://api.elevenlabs.io/v1/music?output_format=mp3_48000_192",
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: musicPrompt.slice(0, 4100),
          music_length_ms: (order.song_length || 90) * 1000,
          model_id: "music_v2",
          force_instrumental: false,
          store_for_inpainting: true
        })
      }
    );

    if (!elevenResponse.ok) {
      console.error("Customer preview music generation error:", elevenResponse.status);

      await pool.query(
        "UPDATE orders SET music_generation_started_at = NULL WHERE id = $1",
        [order.id]
      );

      claimedOrderId = null;

      return res.status(elevenResponse.status).json({
        error: "Music generation failed."
      });
    }

    const elevenlabsSongId = elevenResponse.headers.get("song-id");
    const arrayBuffer = await elevenResponse.arrayBuffer();
    const musicBuffer = Buffer.from(arrayBuffer);

    await pool.query(
      `UPDATE orders
       SET music_data = $1,
           music_content_type = $2,
           elevenlabs_song_id = $3,
           music_generation_started_at = NULL
       WHERE id = $4`,
      [musicBuffer, "audio/mpeg", elevenlabsSongId, order.id]
    );

    const originalDurationSeconds = order.song_length || 90;
    const originalRatePerMinute = 0.15;
    const originalEstimatedCost =
      (originalDurationSeconds / 60) * originalRatePerMinute;

    try {
      await pool.query(
        `INSERT INTO generation_costs
         (order_id, generation_type, provider, model, version_number,
          duration_seconds, rate_per_minute, estimated_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          order.id,
          "original_music",
          "ElevenLabs",
          "music_v2",
          1,
          originalDurationSeconds,
          originalRatePerMinute,
          originalEstimatedCost
        ]
      );
    } catch (costError) {
      logError("Customer ElevenLabs original music cost tracking error:", costError);
    }

    claimedOrderId = null;

    console.log(
      "Customer personalized preview song saved:",
      order.id,
      musicBuffer.length,
      "bytes"
    );

    res.json({
      ok: true,
      ready: true,
      songTitle: songTitle || "Your StorySong"
    });
  } catch (error) {
    if (claimedOrderId) {
      try {
        await pool.query(
          "UPDATE orders SET music_generation_started_at = NULL WHERE id = $1",
          [claimedOrderId]
        );
      } catch (releaseError) {
        logError("Preview music generation lock release error:", releaseError);
      }
    }

    logError("Customer preview generation error:", error);

    res.status(500).json({
      error: error?.message || "Could not create your personalized preview."
    });
  }
});



app.post("/api/order/preview/:token/alternate-style", previewLimiter, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(503).json({ error: "Music generation is not configured." });
    }

    const musicStyle = String(req.body?.musicStyle || "").trim();

    const allowedStyles = new Set([
      "1950s Rock & Roll", "1960s Pop / Rock", "1970s Classic Rock",
      "1980s Pop", "1990s Pop / Rock", "Classic Rock", "Country",
      "Modern Country", "Motown-inspired Soul", "Blues", "Jazz",
      "R&B / Soul", "Pop", "Rock", "Folk / Acoustic", "Ballad",
      "Dance / Party", "Other"
    ]);

    if (!allowedStyles.has(musicStyle)) {
      return res.status(400).json({ error: "Please choose a valid alternate music style." });
    }

    const orderResult = await pool.query(
      `SELECT id, status, paid_at, paypal_order_id,
              style, mood, vocal_gender, vocal_style, tempo, duet, instruments,
              song_length, song_title, lyrics,
              music_data, music_content_type, elevenlabs_song_id,
              music_data IS NOT NULL AS has_music
       FROM orders
       WHERE preview_token = $1`,
      [req.params.token]
    );

    if (!orderResult.rows.length) {
      return res.status(404).json({ error: "Preview order not found." });
    }

    const order = orderResult.rows[0];

    if (order.status !== "New" || order.paid_at || order.paypal_order_id) {
      return res.status(409).json({
        error: "Another music style can no longer be created after checkout has started."
      });
    }

    if (!order.has_music || !order.lyrics) {
      return res.status(400).json({ error: "Your original preview must be ready first." });
    }

    if (musicStyle === order.style) {
      return res.status(400).json({ error: "Please choose a different music style." });
    }

    const existingAlternate = await pool.query(
      `SELECT id, version_number, song_title, music_style,
              (music_data IS NOT NULL) AS has_music
       FROM song_versions
       WHERE order_id = $1
         AND music_style IS NOT NULL
         AND version_number >= 2
       ORDER BY version_number ASC
       LIMIT 1`,
      [order.id]
    );

    if (existingAlternate.rows.length) {
      const version = existingAlternate.rows[0];
      return res.json({
        ok: true,
        ready: version.has_music,
        versionNumber: version.version_number,
        songTitle: version.song_title || order.song_title || "Your StorySong",
        musicStyle: version.music_style
      });
    }

    await pool.query(
      `INSERT INTO song_versions
       (order_id, version_number, song_title, lyrics, music_style, music_data, music_content_type, elevenlabs_song_id)
       VALUES ($1, 1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (order_id, version_number) DO NOTHING`,
      [
        order.id,
        order.song_title,
        order.lyrics,
        order.style,
        order.music_data,
        order.music_content_type,
        order.elevenlabs_song_id
      ]
    );

    const versionResult = await pool.query(
      `INSERT INTO song_versions
       (order_id, version_number, song_title, lyrics, music_style)
       VALUES (
         $1,
         COALESCE((SELECT MAX(version_number) + 1 FROM song_versions WHERE order_id = $1), 2),
         $2,
         $3,
         $4
       )
       RETURNING id, version_number`,
      [
        order.id,
        order.song_title,
        order.lyrics,
        musicStyle
      ]
    );

    const version = versionResult.rows[0];

    const musicPrompt = `Create a fully produced original song with vocals using these exact lyrics.

STYLE: ${musicStyle}
MOOD: ${order.mood || "happy"}
TEMPO: ${order.tempo || "Medium"}
LEAD VOCAL: ${order.vocal_gender || "Any"}; ${order.vocal_style || "Warm and expressive"}
DUET: ${order.duet || "No duet"}
INSTRUMENT PREFERENCES: ${order.instruments || "No preference"}

ARRANGEMENT: Create a fresh musical interpretation in the requested style with a catchy original melody. Keep the lyrics exactly as provided. Do not rewrite, shorten, expand, or reorder the lyrics.

LYRICS:
${order.lyrics}

Do not imitate a specific living artist or copy an existing song.`;

    const elevenResponse = await fetch(
      "https://" + "api.elevenlabs.io" + "/v1/music?output" + "_format=mp3" + "_48000" + "_192",
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt: musicPrompt.slice(0, 4100),
          music_length_ms: (order.song_length || 90) * 1000,
          model_id: "music_v2",
          force_instrumental: false,
          store_for_inpainting: true
        })
      }
    );

    if (!elevenResponse.ok) {
      const errorText = await elevenResponse.text();

      await pool.query(
        "DELETE FROM song_versions WHERE id = $1",
        [version.id]
      );

      throw new Error(`Alternate music generation failed (${elevenResponse.status}): ${errorText}`);
    }

    const elevenlabsSongId = elevenResponse.headers.get("song-id");
    const arrayBuffer = await elevenResponse.arrayBuffer();
    const musicBuffer = Buffer.from(arrayBuffer);

    await pool.query(
      `UPDATE song_versions
       SET music_data = $1,
           music_content_type = $2,
           elevenlabs_song_id = $3
       WHERE id = $4`,
      [
        musicBuffer,
        "audio/mpeg",
        elevenlabsSongId,
        version.id
      ]
    );

    const alternateDurationSeconds = order.song_length || 90;
    const alternateRatePerMinute = 0.15;
    const alternateEstimatedCost =
      (alternateDurationSeconds / 60) * alternateRatePerMinute;

    try {
      await pool.query(
        `INSERT INTO generation_costs
         (order_id, generation_type, provider, model, version_number,
          duration_seconds, rate_per_minute, estimated_cost)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          order.id,
          "alternate_music",
          "ElevenLabs",
          "music_v2",
          version.version_number,
          alternateDurationSeconds,
          alternateRatePerMinute,
          alternateEstimatedCost
        ]
      );
    } catch (costError) {
      logError("ElevenLabs alternate music cost tracking error:", costError);
    }

    res.json({
      ok: true,
      ready: true,
      versionNumber: version.version_number,
      songTitle: order.song_title || "Your StorySong",
      musicStyle
    });

  } catch (error) {
    logError("Customer alternate style generation error:", error);

    res.status(500).json({
      error: error?.message || "Could not create your alternate music preview."
    });
  }
});



app.post("/api/order/preview/:token/select-version", previewLimiter, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const versionNumber = Number(req.body?.versionNumber);

    if (!Number.isInteger(versionNumber) || versionNumber < 1) {
      return res.status(400).json({ error: "Please choose a valid song version." });
    }

    const orderResult = await pool.query(
      `SELECT id, status, paid_at, paypal_order_id
       FROM orders
       WHERE preview_token = $1`,
      [req.params.token]
    );

    if (!orderResult.rows.length) {
      return res.status(404).json({ error: "Preview order not found." });
    }

    const order = orderResult.rows[0];

    if (order.status !== "New" || order.paid_at || order.paypal_order_id) {
      return res.status(409).json({
        error: "Your song version can no longer be changed after checkout has started."
      });
    }

    const versionResult = await pool.query(
      `SELECT version_number, song_title, lyrics, music_style,
              music_data, music_content_type, elevenlabs_song_id
       FROM song_versions
       WHERE order_id = $1
         AND version_number = $2`,
      [order.id, versionNumber]
    );

    if (!versionResult.rows.length) {
      return res.status(404).json({ error: "Song version not found." });
    }

    const version = versionResult.rows[0];

    if (!version.music_data) {
      return res.status(409).json({ error: "That song version is not ready yet." });
    }

    await pool.query(
      `UPDATE orders
       SET song_title = $1,
           lyrics = $2,
           style = $3,
           music_data = $4,
           music_content_type = $5,
           elevenlabs_song_id = $6,
           selected_version_number = $7
       WHERE id = $8`,
      [
        version.song_title,
        version.lyrics,
        version.music_style,
        version.music_data,
        version.music_content_type,
        version.elevenlabs_song_id,
        version.version_number,
        order.id
      ]
    );

    res.json({
      ok: true,
      versionNumber: version.version_number,
      songTitle: version.song_title || "Your StorySong",
      musicStyle: version.music_style
    });

  } catch (error) {
    logError("Customer song version selection error:", error);
    res.status(500).json({ error: "Could not select your song version." });
  }
});


app.post("/api/order/preview/:token/extra-version", previewLimiter, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const includeExtraVersion = req.body?.includeExtraVersion === true;

    const orderResult = await pool.query(
      `SELECT id, status, paid_at, paypal_order_id, price_amount,
              selected_version_number, includes_extra_version,
              extra_version_number, extra_version_price
       FROM orders
       WHERE preview_token = $1`,
      [req.params.token]
    );

    if (!orderResult.rows.length) {
      return res.status(404).json({ error: "Preview order not found." });
    }

    const order = orderResult.rows[0];

    if (order.status !== "New" || order.paid_at || order.paypal_order_id) {
      return res.status(409).json({
        error: "The extra song option can no longer be changed after checkout has started."
      });
    }

    const selectedVersionNumber = Number(order.selected_version_number);

    if (!Number.isInteger(selectedVersionNumber) || selectedVersionNumber < 1) {
      return res.status(409).json({
        error: "Please choose your preferred song version first."
      });
    }

    if (!includeExtraVersion) {
      const currentExtraPrice = Number(order.extra_version_price || 0);

      const updateResult = await pool.query(
        `UPDATE orders
         SET price_amount = GREATEST(price_amount - $1, 0),
             includes_extra_version = FALSE,
             extra_version_number = NULL,
             extra_version_price = 0.00
         WHERE id = $2
         RETURNING price_amount`,
        [currentExtraPrice, order.id]
      );

      return res.json({
        ok: true,
        includesExtraVersion: false,
        extraVersionNumber: null,
        extraVersionPrice: "0.00",
        totalPrice: Number(updateResult.rows[0].price_amount).toFixed(2)
      });
    }

    const versionResult = await pool.query(
      `SELECT version_number
       FROM song_versions
       WHERE order_id = $1
         AND version_number <> $2
         AND music_data IS NOT NULL
       ORDER BY version_number ASC
       LIMIT 1`,
      [order.id, selectedVersionNumber]
    );

    if (!versionResult.rows.length) {
      return res.status(404).json({
        error: "The other song version is not available."
      });
    }

    const extraVersionNumber = versionResult.rows[0].version_number;
    const extraVersionPrice = 5.00;

    const updateResult = await pool.query(
      `UPDATE orders
       SET price_amount = price_amount + CASE
             WHEN includes_extra_version THEN 0
             ELSE $1
           END,
           includes_extra_version = TRUE,
           extra_version_number = $2,
           extra_version_price = $1
       WHERE id = $3
       RETURNING price_amount`,
      [extraVersionPrice, extraVersionNumber, order.id]
    );

    const totalPrice = Number(updateResult.rows[0].price_amount).toFixed(2);

    res.json({
      ok: true,
      includesExtraVersion: true,
      extraVersionNumber,
      extraVersionPrice: extraVersionPrice.toFixed(2),
      totalPrice
    });
  } catch (error) {
    logError("Customer extra song version error:", error);
    res.status(500).json({ error: "Could not update the extra song option." });
  }
});


app.get("/api/order/preview/:token/versions/:versionNumber", async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const versionNumber = Number(req.params.versionNumber);

    if (!Number.isInteger(versionNumber) || versionNumber < 2) {
      return res.status(400).json({ error: "Valid alternate song version is required." });
    }

    const result = await pool.query(
      `SELECT sv.music_data, sv.music_content_type
       FROM song_versions sv
       JOIN orders o ON o.id = sv.order_id
       WHERE o.preview_token = $1
         AND sv.version_number = $2`,
      [req.params.token, versionNumber]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Alternate preview not found." });
    }

    const version = result.rows[0];

    if (!version.music_data) {
      return res.status(404).json({ error: "Alternate preview is not ready yet." });
    }

    const previewBuffer = await createPreviewClip(version.music_data, 15, 30);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "no-store, private");

    res.send(previewBuffer);

  } catch (error) {
    logError("Alternate order preview error:", error);
    res.status(500).json({ error: "Could not create alternate song preview." });
  }
});


app.get("/api/order/preview/:token", async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(
      "SELECT music_data, music_content_type FROM orders WHERE preview_token = $1",
      [req.params.token]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Order not found." });
    }

    const order = result.rows[0];

    if (!order.music_data) {
      return res.status(404).json({ error: "Preview is not ready yet." });
    }

    const previewBuffer = await createPreviewClip(order.music_data, 15, 30);

    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", "inline");
    res.setHeader("Cache-Control", "no-store, private");
    res.send(previewBuffer);
  } catch (error) {
    logError("Order preview error:", error);
    res.status(500).json({ error: "Could not create song preview." });
  }
});

app.get("/api/delivery/:token", async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(
      `SELECT id, status, song_title, lyrics,
              includes_extra_version, extra_version_number
       FROM orders
       WHERE delivery_token = $1`,
      [req.params.token]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Song not found." });
    }

    const order = result.rows[0];

    if (order.status !== "Ready" && order.status !== "Delivered") {
      return res.status(403).json({
        error: "This song is not ready for delivery."
      });
    }

    res.setHeader("Cache-Control", "no-store, private");
    res.json({
      id: order.id,
      status: order.status,
      songTitle: order.song_title,
      lyrics: order.lyrics,
      includesExtraVersion: order.includes_extra_version === true,
      extraVersionNumber: order.extra_version_number || null
    });
  } catch (error) {
    logError("Delivery order error:", error);
    res.status(500).json({ error: "Could not retrieve the song." });
  }
});

app.get("/api/delivery/:token/extra-version", async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(
      `SELECT o.status,
              o.includes_extra_version,
              o.extra_version_number,
              v.song_title,
              v.lyrics
       FROM orders o
       LEFT JOIN song_versions v
         ON v.order_id = o.id
        AND v.version_number = o.extra_version_number
       WHERE o.delivery_token = $1`,
      [req.params.token]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Song not found." });
    }

    const order = result.rows[0];

    if (order.status !== "Ready" && order.status !== "Delivered") {
      return res.status(403).json({
        error: "This song is not ready for delivery."
      });
    }

    if (!order.includes_extra_version || !order.extra_version_number) {
      return res.status(404).json({
        error: "No extra song was purchased with this order."
      });
    }

    if (!order.song_title) {
      return res.status(404).json({
        error: "The extra song is not available."
      });
    }

    res.setHeader("Cache-Control", "no-store, private");

    res.json({
      versionNumber: order.extra_version_number,
      songTitle: order.song_title,
      lyrics: order.lyrics
    });
  } catch (error) {
    logError("Extra delivery song error:", error);
    res.status(500).json({ error: "Could not retrieve the extra song." });
  }
});

app.get("/api/delivery/:token/extra-version/music", async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(
      `SELECT o.status,
              o.includes_extra_version,
              o.extra_version_number,
              v.music_data,
              v.music_content_type
       FROM orders o
       LEFT JOIN song_versions v
         ON v.order_id = o.id
        AND v.version_number = o.extra_version_number
       WHERE o.delivery_token = $1`,
      [req.params.token]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Song not found." });
    }

    const order = result.rows[0];

    if (order.status !== "Ready" && order.status !== "Delivered") {
      return res.status(403).json({
        error: "This song is not ready for delivery."
      });
    }

    if (!order.includes_extra_version || !order.extra_version_number) {
      return res.status(404).json({
        error: "No extra song was purchased with this order."
      });
    }

    if (!order.music_data) {
      return res.status(404).json({
        error: "Extra song audio is not available."
      });
    }

    res.setHeader(
      "Content-Type",
      order.music_content_type || "audio/mpeg"
    );
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Content-Disposition", "inline");
    res.send(order.music_data);
  } catch (error) {
    logError("Extra delivery music error:", error);
    res.status(500).json({ error: "Could not retrieve the extra song." });
  }
});

app.get("/api/delivery/:token/review", async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    res.setHeader("Cache-Control", "no-store, private");

    const orderResult = await pool.query(
      "SELECT id, status FROM orders WHERE delivery_token = $1",
      [req.params.token]
    );

    if (!orderResult.rows.length) {
      return res.status(404).json({ error: "Song not found." });
    }

    const order = orderResult.rows[0];

    if (order.status !== "Ready" && order.status !== "Delivered") {
      return res.status(403).json({ error: "This song is not ready for delivery." });
    }

    const settingsResult = await pool.query(
      `SELECT setting_value FROM store_settings WHERE setting_key = 'reviews_enabled'`
    );
    const reviewsEnabled = (settingsResult.rows[0]?.setting_value ?? "true") === "true";

    const reviewResult = await pool.query(
      `SELECT rating, review_text, display_name, created_at
       FROM reviews
       WHERE order_id = $1`,
      [order.id]
    );

    res.json({
      reviewsEnabled,
      review: reviewResult.rows[0] || null
    });
  } catch (error) {
    logError("Delivery review retrieval error:", error);
    res.status(500).json({ error: "Could not retrieve review information." });
  }
});

app.post("/api/delivery/:token/review", orderLimiter, async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    res.setHeader("Cache-Control", "no-store, private");

    const orderResult = await pool.query(
      "SELECT id, status FROM orders WHERE delivery_token = $1",
      [req.params.token]
    );

    if (!orderResult.rows.length) {
      return res.status(404).json({ error: "Song not found." });
    }

    const order = orderResult.rows[0];

    if (order.status !== "Ready" && order.status !== "Delivered") {
      return res.status(403).json({ error: "This song is not ready for delivery." });
    }

    const settingsResult = await pool.query(
      `SELECT setting_value FROM store_settings WHERE setting_key = 'reviews_enabled'`
    );
    const reviewsEnabled = (settingsResult.rows[0]?.setting_value ?? "true") === "true";

    if (!reviewsEnabled) {
      return res.status(403).json({ error: "Customer reviews are currently disabled." });
    }

    const rating = Number(req.body?.rating);
    const reviewText = typeof req.body?.reviewText === "string" ? req.body.reviewText.trim() : "";
    const displayName = typeof req.body?.displayName === "string" ? req.body.displayName.trim() : "";

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Please choose a rating from 1 to 5 stars." });
    }

    if (!reviewText || reviewText.length > 1000) {
      return res.status(400).json({ error: "Review must be between 1 and 1000 characters." });
    }

    if (displayName.length > 100) {
      return res.status(400).json({ error: "Display name must be 100 characters or fewer." });
    }

    try {
      await pool.query(
        `INSERT INTO reviews (order_id, rating, review_text, display_name)
         VALUES ($1, $2, $3, $4)`,
        [order.id, rating, reviewText, displayName || null]
      );
    } catch (error) {
      if (error?.code === "23505") {
        return res.status(409).json({ error: "A review has already been submitted for this StorySong." });
      }
      throw error;
    }

    res.status(201).json({
      ok: true,
      message: "Thank you! Your StorySong review has been submitted."
    });
  } catch (error) {
    logError("Delivery review submission error:", error);
    res.status(500).json({ error: "Could not submit your review." });
  }
});

app.get("/api/delivery/:token/music", async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(
      "SELECT status, music_data, music_content_type FROM orders WHERE delivery_token = $1",
      [req.params.token]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Song not found." });
    }

    const order = result.rows[0];

    if (order.status !== "Ready" && order.status !== "Delivered") {
      return res.status(403).json({
        error: "This song is not ready for delivery."
      });
    }

    if (!order.music_data) {
      return res.status(404).json({
        error: "Song audio is not available."
      });
    }

    res.setHeader(
      "Content-Type",
      order.music_content_type || "audio/mpeg"
    );

    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Content-Disposition", "inline");
    res.send(order.music_data);
  } catch (error) {
    logError("Delivery music error:", error);
    res.status(500).json({ error: "Could not retrieve the song." });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(port, "0.0.0.0", () => console.log(`StorySong V5 test running on port ${port}`));
