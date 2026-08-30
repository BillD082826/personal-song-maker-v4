import express from "express";
import OpenAI from "openai";

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json({ limit: "2mb" }));
app.use(express.static("public"));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
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

    const prompt = `Write a complete, original personalized song.

Person: ${person}
Occasion: ${occasion}
Story / memories: ${story}
Music era / style: ${music}
Mood: ${mood}
Lead vocal preference: ${vocalGender || "Any"}
Vocal style: ${vocalStyle || "Warm and expressive"}
Tempo: ${tempo || "Medium"}
Duet preference: ${duet || "No duet"}
Instrument preferences: ${instruments || "No preference"}
Special message: ${message || "None"}
Names / people to mention: ${mentions || "None"}

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
      input: prompt,
    });

    const song = response.output_text;
    const firstLine = (song || "").split(/\r?\n/).map(s => s.trim()).find(Boolean) || "Personal Song";
    const title = firstLine
      .replace(/^#{1,6}\s*/, "")
      .replace(/^\*+|\*+$/g, "")
      .replace(/^title\s*:\s*/i, "")
      .trim() || "Personal Song";

    res.json({ title, song });
  } catch (error) {
    console.error("Song generation error:", error);
    res.status(500).json({ error: error?.message || "Could not create lyrics." });
  }
});

app.post("/api/music", async (req, res) => {
  try {
    const {
      lyrics, musicStyle, mood,
      vocalGender, vocalStyle, tempo, duet, instruments,
      lengthMs = 90000
    } = req.body;

    if (!lyrics) {
      return res.status(400).json({ error: "Create lyrics first." });
    }

    const safeLength = Math.max(3000, Math.min(600000, Number(lengthMs) || 90000));

    const musicPrompt = `Create a fully produced original song with vocals using these lyrics.

STYLE: ${musicStyle || "pop"}
MOOD: ${mood || "happy"}
TEMPO: ${tempo || "Medium"}
LEAD VOCAL: ${vocalGender || "Any"}; ${vocalStyle || "warm and expressive"}
DUET: ${duet || "No duet"}
INSTRUMENT PREFERENCES: ${instruments || "No preference"}

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
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: musicPrompt.slice(0, 4100),
          music_length_ms: safeLength,
          model_id: "music_v2",
          force_instrumental: false,
        }),
      }
    );

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
    const {
      customerName,
      email,
      person,
      occasion,
      style,
      mood,
      story,
      message
    } = req.body;

    if (!customerName || !email || !person || !occasion || !style || !mood || !story) {
      return res.status(400).json({
        error: "Please complete all required order fields."
      });
    }

    const order = {
      id: `PSM-${Date.now()}`,
      customerName,
      email,
      person,
      occasion,
      style,
      mood,
      story,
      message: message || "",
      status: "New",
      createdAt: new Date().toISOString()
    };

    console.log("New song order:", order);

    res.json({
      ok: true,
      orderId: order.id,
      message: "Your song order has been received."
    });
  } catch (error) {
    console.error("Order error:", error);
    res.status(500).json({
      error: "Could not submit the order."
    });
  }
});
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Personal Song Maker V4 running on port ${port}`);
});
