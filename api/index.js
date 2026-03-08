require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

app.post('/api/generate', async (req, res) => {
    console.log("\n--- New Request ---");
    console.log("Niche:", req.body.niche);

    // These IDs are the most stable "Public" free models on OpenRouter
    const models = [
        "openrouter/free",              // 🏆 The #1 choice: Auto-selects active free models
        "google/gemini-2.0-flash:free", // Extremely high uptime
        "meta-llama/llama-3.3-70b-instruct:free",
        "mistralai/mistral-small-24b-instruct-2501:free"
    ];

    let lastError = null;

    for (const model of models) {
        try {
            console.log(`Trying: ${model}...`);

            // Abort if the model takes more than 8 seconds
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);

            const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                signal: controller.signal,
                headers: {
                    "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": "http://localhost:3000",
                    "X-Title": "Spark AI Local"
                },
                body: JSON.stringify({
                    "model": model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "Return ONLY a valid JSON object. No intro. Format: {\"name\":\"App Name\", \"pitch\":\"1 sentence\", \"features\":[\"1\",\"2\",\"3\"]}"
                        },
                        { "role": "user", "content": `Generate a startup app idea for the niche: ${req.body.niche}` }
                    ]
                })
            });

            clearTimeout(timeout);
            const data = await response.json();

            if (data.error) {
                console.warn(`❌ ${model} failed: ${data.error.message}`);
                lastError = data.error.message;
                continue;
            }

            let content = data.choices[0].message.content;
            content = content.replace(/```json/g, "").replace(/```/g, "").trim();

            try {
                JSON.parse(content); // Test if it's valid JSON
                data.choices[0].message.content = content;
                console.log(`✅ Success with ${model}!`);
                return res.json(data);
            } catch (jsonErr) {
                console.warn(`⚠️ ${model} sent bad JSON, trying next...`);
                continue;
            }

        } catch (error) {
            console.error(`Skipping ${model} due to error:`, error.message);
            lastError = error.message;
        }
    }

    res.status(500).json({ error: `All models failed. Last error: ${lastError}` });
});