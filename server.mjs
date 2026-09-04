import express from "express";
import { rateLimit } from "express-rate-limit";
import helmet from "helmet";
import OpenAI from "openai";
import pg from "pg";
import crypto from "crypto";

const app = express();
app.set("trust proxy", 1);
app.use(helmet({
  contentSecurityPolicy: false
}));
const port = process.env.PORT || 3000;
const PAYPAL_ENVIRONMENT = (process.env.PAYPAL_ENVIRONMENT || "sandbox").toLowerCase();
const PAYPAL_BASE_URL = PAYPAL_ENVIRONMENT === "live"
  ? "https://api-m.paypal.com"
  : "https://api-m.sandbox.paypal.com";
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "https://personal-song-maker-v5-test.onrender.com").replace(/\/+$/, "");

function logError(label, error) {
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error(label, message);
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
      ('song_price', '20.00'),
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
    ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS seller_id BIGINT REFERENCES sellers(id) ON DELETE SET NULL
  `);

  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_order_id TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS song_title TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS lyrics TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS music_data BYTEA`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS music_content_type TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_token TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS price_amount NUMERIC(10,2)`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS vocal_gender TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS vocal_style TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS tempo TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS duet TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS instruments TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS music_generation_started_at TIMESTAMPTZ`);
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
    throw new Error("PayPal sandbox credentials are not configured.");
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

  let songPrice = "20.00";

  if (pool) {
    try {
      const result = await pool.query(
        `SELECT setting_value FROM store_settings WHERE setting_key = 'song_price'`
      );
      songPrice = result.rows[0]?.setting_value || "20.00";
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
       SET status = 'Paid', paypal_capture_id = $1, paid_at = NOW()
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
      message, mentions
    } = req.body;

    if (!person || !occasion || !story || !music || !mood) {
      return res.status(400).json({ error: "Please complete all required fields." });
    }

    const prompt = `Write a complete, original personalized song.\n\nPerson: ${person}\nOccasion: ${occasion}\nStory / memories: ${story}\nMusic era / style: ${music}\nMood: ${mood}\nLead vocal preference: ${vocalGender || "Any"}\nVocal style: ${vocalStyle || "Warm and expressive"}\nTempo: ${tempo || "Medium"}\nDuet preference: ${duet || "No duet"}\nInstrument preferences: ${instruments || "No preference"}\nSpecial message: ${message || "None"}\nNames / people to mention: ${mentions || "None"}\n\nRequirements:\n- Write an original song inspired by the requested style, without copying any existing song or artist.\n- Include a memorable song title on the first line.\n- Use clear section headings such as [Verse 1], [Chorus], [Verse 2], and [Bridge] when appropriate.\n- Make the personal details feel natural and memorable.\n- If a duet is requested, write natural alternating or shared vocal parts where appropriate.\n- Match the lyrical rhythm and energy to the requested tempo.\n- Return only the song, with the title on the first line followed by clear section headings.`;

    const response = await openai.responses.create({ model: "gpt-5.6-luna", input: prompt });
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
    const { customerName, email, person, occasion, style, vocalGender, vocalStyle, tempo, duet, instruments, mood, story, message, referralCode } = req.body;
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

    if (
      !allowedOccasions.has(occasion) ||
      !allowedStyles.has(style) ||
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

    const priceResult = await pool.query(
      `SELECT setting_value FROM store_settings WHERE setting_key = 'song_price'`
    );
    const songPrice = priceResult.rows[0]?.setting_value || "20.00";

    await pool.query(
      `INSERT INTO orders (id, customer_name, email, person, occasion, style, vocal_gender, vocal_style, tempo, duet, instruments, mood, story, message, status, delivery_token, price_amount, seller_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'New',$15,$16,$17)`,
      [orderId, customerName.trim(), email.trim(), person.trim(), occasion, style, vocalGender || "Any", (vocalStyle || "Warm and expressive").trim(), tempo || "Medium", duet || "No duet", Array.isArray(instruments) ? instruments.map(value => value.trim()).join(", ") : "", mood, story.trim(), (message || "").trim(), deliveryToken, songPrice, sellerId]
    );
    console.log("New song order saved:", orderId);
    res.json({ ok: true, orderId, songPrice, message: "Your song order has been received." });
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

async function sendDeliveryEmail(order) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Resend is not configured.");
  }

  const deliveryUrl = `${PUBLIC_BASE_URL}/delivery.html?token=${encodeURIComponent(order.delivery_token)}`;
  const safeCustomerName = escapeHtml(order.customer_name || "there");
  const safeSongTitle = escapeHtml(order.song_title || "Your Song");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "StorySong <onboarding@resend.dev>",
      to: [order.email],
      subject: `Your personalized song is ready: ${order.song_title || "Your Song"}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
          <h2>Your personalized song is ready!</h2>
          <p>Hi ${safeCustomerName},</p>
          <p>Your custom song <strong>${safeSongTitle}</strong> is ready to enjoy.</p>
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

app.get("/api/store-settings", async (_req, res) => {
  const defaults = {
    songPrice: "20.00",
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


app.get("/api/admin/sellers", requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.referral_code,
        s.active,
        s.created_at,
        COUNT(o.id)::int AS order_count,
        COALESCE(SUM(CASE WHEN o.paid_at IS NOT NULL THEN o.price_amount ELSE 0 END), 0)::numeric AS sales_total
      FROM sellers s
      LEFT JOIN orders o ON o.seller_id = s.id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `);

    res.json({ sellers: result.rows });
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

  if (!name) {
    return res.status(400).json({ error: "Seller name is required." });
  }

  if (!/^[A-Z0-9_-]{3,30}$/.test(referralCode)) {
    return res.status(400).json({
      error: "Referral code must be 3–30 characters using letters, numbers, hyphens, or underscores."
    });
  }

  try {
    const result = await pool.query(
      `
        INSERT INTO sellers (name, referral_code)
        VALUES ($1, $2)
        RETURNING id, name, referral_code, active, created_at
      `,
      [name, referralCode]
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


app.patch("/api/admin/sellers/:id", requireAdmin, async (req, res) => {
  const sellerId = String(req.params.id || "").trim();
  const active = req.body?.active;

  if (!/^\d+$/.test(sellerId)) {
    return res.status(400).json({ error: "Invalid seller ID." });
  }

  if (typeof active !== "boolean") {
    return res.status(400).json({ error: "Active status must be true or false." });
  }

  try {
    const result = await pool.query(
      `
        UPDATE sellers
        SET active = $1
        WHERE id = $2
        RETURNING id, name, referral_code, active, created_at
      `,
      [active, sellerId]
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
      songPrice: settings.song_price || "20.00",
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

app.get("/api/admin/orders", requireAdmin, async (_req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(`
      SELECT
        id,
        customer_name,
        email,
        person,
        occasion,
        style,
        vocal_gender,
        vocal_style,
        tempo,
        duet,
        instruments,
        mood,
        story,
        message,
        status,
        price_amount,
        created_at,
        paid_at,
        song_title,
        lyrics,
        delivery_token,
        (music_data IS NOT NULL) AS has_music,
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
return res.status(503).json({ error: "Order database is not configured." });
}
const allowedStatuses = ["New", "Paid", "Creating", "Ready", "Delivered"];
const status = String(req.body?.status || "");
if (!allowedStatuses.includes(status)) {
return res.status(400).json({ error: "Invalid order status." });
}
const result = await pool.query("UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status", [status, req.params.id]);
if (!result.rows.length) {
return res.status(404).json({ error: "Order not found." });
}
res.json({ ok: true, order: result.rows[0] });
} catch (error) {
logError("Admin status update error:", error);
res.status(500).json({ error: "Could not update order status." });
}
});



app.post("/api/admin/orders/:id/music", requireAdmin, async (req, res) => {
  let claimedOrderId = null;
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const orderResult = await pool.query(
      "SELECT id, status, person, style, mood, vocal_gender, vocal_style, tempo, duet, instruments, music_data IS NOT NULL AS has_music, music_generation_started_at, lyrics FROM orders WHERE id = $1",
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
        music_length_ms: 90000,
        model_id: "music_v2",
        force_instrumental: false
      })
    });

    if (!elevenResponse.ok) {
      console.error("Admin music generation error:", elevenResponse.status);
      await pool.query("UPDATE orders SET music_generation_started_at = NULL WHERE id = $1", [order.id]);
      return res.status(elevenResponse.status).json({ error: "Music generation failed." });
    }

    const arrayBuffer = await elevenResponse.arrayBuffer();
    const musicBuffer = Buffer.from(arrayBuffer);
    console.log("Admin music received:", order.id, musicBuffer.length, "bytes");

    const result = await pool.query(
      "UPDATE orders SET music_data = $1, music_content_type = $2, status = 'Ready', music_generation_started_at = NULL WHERE id = $3 RETURNING id, status",
      [musicBuffer, "audio/mpeg", req.params.id]
    );

    console.log("Admin music saved:", order.id, result.rows[0]);
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



app.get("/api/delivery/:token", async (req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(
      "SELECT id, status, song_title, lyrics FROM orders WHERE delivery_token = $1",
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
      lyrics: order.lyrics
    });
  } catch (error) {
    logError("Delivery order error:", error);
    res.status(500).json({ error: "Could not retrieve the song." });
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
