# Personal Song Maker V4 — Online Ready

Version 4 is prepared for deployment as a Render Node/Express web service.

## Included
- Personalized lyrics with OpenAI
- Music and vocals with ElevenLabs
- MP3 save/download
- Regenerate music while keeping lyrics
- Song-length selector
- iPad-friendly interface
- Web app manifest
- Render deployment configuration
- `.gitignore` to keep API keys and `.env` files out of Git

## Local use
Set these environment variables in Terminal:
- OPENAI_API_KEY
- ELEVENLABS_API_KEY

Then:
npm install
npm start

## Render deployment
1. Put this folder in a GitHub repository.
2. In Render, create a new Web Service from that repository, or use the included render.yaml Blueprint.
3. Build command: npm install
4. Start command: npm start
5. Add these secret environment variables in Render:
   - OPENAI_API_KEY
   - ELEVENLABS_API_KEY
6. Never place either API key in GitHub or in browser-side JavaScript.

The server already listens on process.env.PORT and 0.0.0.0, which is compatible with Render.
