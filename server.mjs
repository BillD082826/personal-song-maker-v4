import express from "express";
import OpenAI from "openai";
import pg from "pg";
import crypto from "crypto";

const app = express();
const port = process.env.PORT || 3000;
const PAYPAL_BASE_URL = "https://api-m.sandbox.paypal.com";

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
    INSERT INTO store_settings (setting_key, setting_value)
    VALUES ('song_price', '20.00')
    ON CONFLICT (setting_key) DO NOTHING
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
      console.error("Could not load PayPal store price:", error);
    }
  }
  res.json({
    clientId: process.env.PAYPAL_CLIENT_ID,
    currency: "USD",
    amount: songPrice,
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
      "SELECT id, status, price_amount FROM orders WHERE id = $1",
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
          description: "StorySong - Custom Song (Sandbox Test)",
          amount: {
            currency_code: "USD",
            value: Number(result.rows[0].price_amount || 20).toFixed(2)
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
      console.error("PayPal capture error:", data);
      return res.status(paypalResponse.status).json({
        error: "PayPal could not capture the test payment."
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
    console.error("PayPal capture error:", error);
    res.status(500).json({ error: error.message || "Could not capture PayPal payment." });
  }
});

app.post("/api/song", requireAdmin, async (req, res) => {
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

app.post("/api/music", requireAdmin, async (req, res) => {
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
    const { customerName, email, person, occasion, style, vocalGender, vocalStyle, tempo, duet, instruments, mood, story, message } = req.body;
    if (!customerName || !email || !person || !occasion || !style || !mood || !story) {
      return res.status(400).json({ error: "Please complete all required order fields." });
    }
    if (!pool) return res.status(503).json({ error: "Order database is not configured." });
    const orderId = `PSM-${Date.now()}`;
    const deliveryToken = crypto.randomBytes(32).toString("hex");

    const priceResult = await pool.query(
      `SELECT setting_value FROM store_settings WHERE setting_key = 'song_price'`
    );
    const songPrice = priceResult.rows[0]?.setting_value || "20.00";

    await pool.query(
      `INSERT INTO orders (id, customer_name, email, person, occasion, style, vocal_gender, vocal_style, tempo, duet, instruments, mood, story, message, status, delivery_token, price_amount)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'New',$15,$16)`,
      [orderId, customerName, email, person, occasion, style, vocalGender || "Any", vocalStyle || "Warm and expressive", tempo || "Medium", duet || "No duet", Array.isArray(instruments) ? instruments.join(", ") : "", mood, story, message || "", deliveryToken, songPrice]
    );
    console.log("New song order saved:", orderId);
    res.json({ ok: true, orderId, message: "Your song order has been received." });
  } catch (error) {
    console.error("Order error:", error);
    res.status(500).json({ error: "Could not submit the order." });
 }
});

async function sendDeliveryEmail(order) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Resend is not configured.");
  }

  const deliveryUrl = `https://personal-song-maker-v5-test.onrender.com/delivery.html?token=${encodeURIComponent(order.delivery_token)}`;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      from: "StorySong <onboarding@resend.dev>",
      to: [order.email],
      subject: `Your personalized song is ready: ${order.song_title || "Your Song"}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #222;">
          <h2>Your personalized song is ready!</h2>
          <p>Hi ${order.customer_name || "there"},</p>
          <p>Your custom song <strong>${order.song_title || "Your Song"}</strong> is ready to enjoy.</p>
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
    console.error("Delivery email error:", error);
    res.status(500).json({ error: error?.message || "Could not send delivery email." });
  }
});

app.get("/api/store-settings", async (_req, res) => {
  try {
    if (!pool) {
      return res.json({ songPrice: "20.00" });
    }

    const result = await pool.query(
      `SELECT setting_value FROM store_settings WHERE setting_key = 'song_price'`
    );

    res.json({
      songPrice: result.rows[0]?.setting_value || "20.00"
    });
  } catch (error) {
    console.error("Public store settings error:", error);
    res.json({ songPrice: "20.00" });
  }
});

app.get("/api/admin/store-settings", requireAdmin, async (_req, res) => {
  try {
    if (!pool) {
      return res.status(503).json({ error: "Order database is not configured." });
    }

    const result = await pool.query(
      `SELECT setting_value FROM store_settings WHERE setting_key = 'song_price'`
    );

    res.json({
      songPrice: result.rows[0]?.setting_value || "20.00"
    });
  } catch (error) {
    console.error("Store settings error:", error);
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

    await pool.query(
      `INSERT INTO store_settings (setting_key, setting_value)
       VALUES ('song_price', $1)
       ON CONFLICT (setting_key)
       DO UPDATE SET setting_value = EXCLUDED.setting_value`,
      [formattedPrice]
    );

    res.json({
      ok: true,
      songPrice: formattedPrice
    });
  } catch (error) {
    console.error("Store settings update error:", error);
    res.status(500).json({ error: "Could not save store settings." });
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
        (music_data IS NOT NULL) AS has_music
      FROM orders
      ORDER BY created_at DESC
    `);

    res.json({ orders: result.rows });
  } catch (error) {
    console.error("Admin orders error:", error);
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
    console.error("Admin song save error:", error);
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
console.error("Admin status update error:", error);
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
      const errorText = await elevenResponse.text();
      console.error("Admin music generation error:", elevenResponse.status, errorText);
      await pool.query("UPDATE orders SET music_generation_started_at = NULL WHERE id = $1", [order.id]);
      return res.status(elevenResponse.status).send(errorText || "Music generation failed.");
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
        console.error("Admin music generation lock release error:", releaseError);
      }
    }
    console.error("Admin music save error:", error);
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
    console.error("Admin music retrieval error:", error);
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

    res.json({
      id: order.id,
      status: order.status,
      songTitle: order.song_title,
      lyrics: order.lyrics
    });
  } catch (error) {
    console.error("Delivery order error:", error);
    res.status(500).json({ error: "Could not retrieve the song." });
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

    res.setHeader("Content-Disposition", "inline");
    res.send(order.music_data);
  } catch (error) {
    console.error("Delivery music error:", error);
    res.status(500).json({ error: "Could not retrieve the song." });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));
app.listen(port, "0.0.0.0", () => console.log(`StorySong V5 test running on port ${port}`));
