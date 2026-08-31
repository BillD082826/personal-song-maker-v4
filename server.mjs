import express from "express";
import OpenAI from "openai";
import pg from "pg";

const app = express();
const port = process.env.PORT || 3000;
const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com";
const TEST_PRICE = "1.00";

function requireAdmin(req, res, next) {
const username = process.env.ADMIN_USERNAME;
const password = process.env.ADMIN_PASSWORD;
const authHeader = req.headers.authorization || "";
if (!username || !password) {
return res.status(503).json({ error: "Admin login is not configured." });
}
if (!authHeader.startsWith("Basic ")) {
res.set("WWW-Authenticate", 'Basic realm="Personal Song Maker Admin"');
return res.status(401).json({ error: "Admin login required." });
}
const encoded = authHeader.slice(6);
const decoded = Buffer.from(encoded, "base64").toString("utf8");
const separator = decoded.indexOf(":");
if (separator === -1) {
res.set("WWW-Authenticate", 'Basic realm="Personal Song Maker Admin"');
return res.status(401).json({ error: "Invalid admin login." });
}
const suppliedUsername = decoded.slice(0, separator);
const suppliedPassword = decoded.slice(separator + 1);
if (suppliedUsername !== username || suppliedPassword !== password) {
res.set("WWW-Authenticate", 'Basic realm="Personal Song Maker Admin"');
return res.status(401).json({ error: "Invalid admin login." });
}
return next();
}


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

  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_order_id TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT`);
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ`);

  console.log("Orders database ready");
}

initializeDatabase().catch((error) => {
  console.error("Database initialization error:", error);
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
    console.error("PayPal token error:", data);
    throw new Error("Could not authenticate with PayPal.");
  }
  return data.access_token;
}

app.get("/api/paypal/config", (_req, res) => {
  if (!process.env.PAYPAL_CLIENT_ID) {
    return res.status(503).json({ error: "PayPal is not configured." });
  }
  res.json({
    clientId: process.env.PAYPAL_CLIENT_ID,
    currency: "USD",
    amount: TEST_PRICE,
    sandbox: true
  });
});

app.post("/api/paypal/create-order", async (req, res) => {
  try {
    const { localOrderId } = req.body;
    if (!localOrderId || !pool) {
      return res.status(400).json({ error: "A valid song order is required." });
    }

    const result = await pool.query(
      "SELECT id, status FROM orders WHERE id = $1",
      [localOrderId]
    );
    if (!result.rowCount) {
      return res.status(404).json({ error: "Song order not found." });
    }
    if (result.rows[0].status === "Paid") {
      return res.status(409).json({ error: "This order is already paid." });
    }

    const accessToken = await getPayPalAccessToken();
    const paypalResponse = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "PayPal-Request-Id": `create-${localOrderId}-${Date.now()}`
      },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{
          reference_id: localOrderId,
          custom_id: localOrderId,
          description: "Personal Song Maker - Custom Song (Sandbox Test)",
          amount: {
            currency_code: "USD",
            value: TEST_PRICE
          }
        }]
      })
    });

    const data = await paypalResponse.json();
    if (!paypalResponse.ok) {
      console.error("PayPal create-order error:", data);
      return res.status(paypalResponse.status).json({
        error: "PayPal could not create the test payment."
      });
    }

    await pool.query(
      "UPDATE orders SET paypal_order_id = $1 WHERE id = $2",
      [data.id, localOrderId]
    );

    res.json({ id: data.id });
  } catch (error) {
    console.error("PayPal create error:", error);
    res.status(500).json({ error: error.message || "Could not create PayPal order." });
  }
});

app.post("/api/paypal/capture-order/:paypalOrderId", async (req, res) => {
  try {
    const { paypalOrderId } = req.params;
    const { localOrderId } = req.body;
    if (!paypalOrderId || !localOrderId || !pool) {
      return res.status(400).json({ error: "Payment information is incomplete." });
    }

    const orderResult = await pool.query(
      "SELECT id, status, paypal_order_id FROM orders WHERE id = $1",
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
      console.error("PayPal capture error:", data);
      return res.status(paypalResponse.status).json({
        error: "PayPal could not capture the test payment."
      });
    }

    if (data.status !== "COMPLETED") {
      return res.status(400).json({ error: `Payment status is ${data.status}.` });
    }

    const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id || null;

    await pool.query(
      `UPDATE orders
       SET status = 'Paid', paypal_capture_id = $1, paid_at = NOW()
       WHERE id = $2`,
      [captureId, localOrderId]
    );

    console.log("Song order paid:", localOrderId, "PayPal:", paypalOrderId);
    res.json({ ok: true, status: data.status, localOrderId, captureId });
  } catch (error) {
    console.error("PayPal capture error:", error);
    res.status(500).json({ error: error.message || "Could not capture PayPal payment." });
  }
});

app.post("/api/song", async (req, res) => {
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
    console.error("Song generation error:", error);
    res.status(500).json({ error: error?.message || "Could not create lyrics." });
  }
});

app.post("/api/music", async (req, res) => {
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
      const text = await elevenResponse.text();
      console.error("ElevenLabs error:", elevenResponse.status, text);
      return res.status(elevenResponse.status).send(text || "Music generation failed.");
    }
    const arrayBuffer = await elevenResponse.arrayBuffer();
    res.setHeader("Content-Type", "audio/mpeg");
    res.send(Buffer.from(arrayBuffer));
  } catch (error) {
    console.error("Music generation error:", error);
    res.status(500).json({ error: error?.message || "Could not create music." });
  }
});

app.post("/api/order", async (req, res) => {
  try {
    const { customerName, email, person, occasion, style, mood, story, message } = req.body;
    if (!customerName || !email || !person || !occasion || !style || !mood || !story) {
      return res.status(400).json({ error: "Please complete all required order fields." });
    }
    if (!pool) return res.status(503).json({ error: "Order database is not configured." });
    const orderId = `PSM-${Date.now()}`;
    await pool.query(
      `INSERT INTO orders (id, customer_name, email, person, occasion, style, mood, story, message, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'New')`,
      [orderId, customerName, email, person, occasion, style, mood, story, message || ""]
    );
    console.log("New song order saved:", orderId);
    res.json({ ok: true, orderId, message: "Your song order has been received." });
  } catch (error) {
    console.error("Order error:", error);
    res.status(500).json({ error: "Could not submit the order." });
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
        mood,
        story,
        message,
        status,
        created_at,
        paid_at
      FROM orders
      ORDER BY created_at DESC
    `);

    res.json({ orders: result.rows });
  } catch (error) {
    console.error("Admin orders error:", error);
    res.status(500).json({ error: "Could not load orders." });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(port, "0.0.0.0", () => console.log(`Personal Song Maker V5 test running on port ${port}`));
