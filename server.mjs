import express from "express";
import OpenAI from "openai";
import os from "os";

const app = express();
const port = process.env.PORT || 3000;
const openai = new OpenAI();

app.use(express.json({ limit: "200kb" }));
app.use(express.static("public"));

app.post("/api/song", async (req, res) => {
  try {
    const { person, occasion, story, music, mood, message, mentions } = req.body;

    if (!person || !occasion || !story || !music || !mood) {
      return res.status(400).json({ error: "Please complete the required fields." });
    }

    const prompt = `Create an original personalized song from these inputs.

Person: ${person}
Occasion: ${occasion}
Story/memories: ${story}
Music era/style: ${music}
Mood: ${mood}
Special message: ${message || "None"}
People/things to mention: ${mentions || "None"}

Write a complete, singable song with:
- A catchy original title
- Verse 1
- Chorus
- Verse 2
- Bridge
- Final chorus

Capture the requested era and musical characteristics without copying or closely imitating any specific artist or existing song.
Make the personal details feel natural and memorable.
Return only the song, with clear section headings.`;

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",
      input: prompt
    });

    res.json({ song: response.output_text });
  } catch (error) {
    console.error("OpenAI error:", error);
    res.status(500).json({ error: error?.message || "The song could not be created." });
  }
});

app.post("/api/music", async (req, res) => {
  try {
    const key = process.env.ELEVENLABS_API_KEY;
    if (!key) {
      return res.status(500).json({ error: "ELEVENLABS_API_KEY is not set." });
    }

    const { lyrics, musicStyle, mood, lengthMs = 90000 } = req.body;
    if (!lyrics) {
      return res.status(400).json({ error: "No lyrics were provided." });
    }

    const prompt = `Create a complete original song using these lyrics.

STYLE: ${musicStyle || "classic pop"}
MOOD: ${mood || "happy"}
VOCALS: warm, expressive lead vocal
ARRANGEMENT: full band, catchy melody, polished production
IMPORTANT: Use the supplied lyrics as the song lyrics. Do not imitate any specific artist or existing song.

LYRICS:
${lyrics}`.slice(0, 4000);

    const response = await fetch(
      "https://api.elevenlabs.io/v1/music?output_format=mp3_48000_192",
      {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          prompt,
          music_length_ms: Math.max(30000, Math.min(240000, Number(lengthMs) || 90000)),
          model_id: "music_v2",
          force_instrumental: false
        })
      }
    );

    if (!response.ok) {
      const details = await response.text();
      console.error("ElevenLabs error:", response.status, details);
      return res.status(response.status).json({
        error: `Music generation failed (${response.status}). ${details}`.slice(0, 700)
      });
    }

    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Disposition", 'inline; filename="personal-song.mp3"');
    res.send(audio);
  } catch (error) {
    console.error("Music error:", error);
    res.status(500).json({ error: error?.message || "The music could not be generated." });
  }
});

function localIPv4Addresses() {
  const nets = os.networkInterfaces();
  const addresses = [];
  for (const entries of Object.values(nets)) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal) addresses.push(entry.address);
    }
  }
  return [...new Set(addresses)];
}

app.listen(port, "0.0.0.0", () => {
  console.log(`Personal Song Maker V3 running on your Mac: http://localhost:${port}`);
  const ips = localIPv4Addresses();
  if (ips.length) {
    console.log("On an iPad connected to the same Wi-Fi, try:");
    for (const ip of ips) console.log(`  http://${ip}:${port}`);
  }
});
