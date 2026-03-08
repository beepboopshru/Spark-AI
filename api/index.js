require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path'); // Added for better path handling

const app = express();
app.use(cors());
app.use(express.json());

// Vercel serves static files from the 'public' folder by default
// if you follow the project structure I gave you earlier.
app.use(express.static(path.join(__dirname, '../public')));

app.post('/api/generate', async (req, res) => {
    const models = [
        "openrouter/free",
        "google/gemini-2.0-flash:free",
        "meta-llama/llama-3.3-70b-instruct:free"
    ];

    let lastError = null;

    for (const model of models) {
        try {
            // REDUCED TIMEOUT: Vercel free tier limit is 10s total.
            // We give each model 4s so we can try at least two.
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 4000);

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                signal: controller.signal,
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "https://spark-ai.vercel.app", // Use your real URL
                    "X-Title": "Spark AI"
                },
                body: JSON.stringify({
                    "model": model,
                    "messages": [
                        { "role": "system", "content": "Return ONLY JSON: {\"name\":\"\", \"pitch\":\"\", \"features\":[]}" },
                        { "role": "user", "content": `Niche: ${req.body.niche}` }
                    ]
                })
            });

            clearTimeout(timeout);
            const data = await response.json();

            if (data.error) {
                lastError = data.error.message;
                continue;
            }

            let content = data.choices[0].message.content;
            content = content.replace(/```json/g, "").replace(/```/g, "").trim();

            JSON.parse(content);
            return res.json({ content: JSON.parse(content) });

        } catch (error) {
            lastError = error.message;
            if (error.name === 'AbortError') console.log(`${model} timed out.`);
        }
    }

    res.status(500).json({ error: `Connection too slow or models busy. Error: ${lastError}` });
});

// IMPORTANT FOR VERCEL: Export the app, don't use app.listen()
module.exports = app;