const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { OpenAI } = require("openai");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 🔍 Analyze endpoint
app.post("/analyze", async (req, res) => {
  const { url } = req.body;

  // ✅ Validate input
  if (!url || !url.startsWith("http")) {
    return res.status(400).json({ error: "❌ Invalid URL provided" });
  }

  try {
    // ✅ Fetch HTML with spoofed browser headers
    const html = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    }).then(res => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} - ${res.statusText}`);
      }
      return res.text();
    });

    // ✅ Generate prompt for ChatGPT
    const prompt = `
You are a UX/UI design expert. Analyze the website HTML below and provide:
1. A Design Score out of 100
2. 5 actionable UX improvement recommendations

Website HTML:
${html}
    `;

    // ✅ Ask OpenAI to analyze
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const analysis = completion.choices[0].message.content;
    res.json({ analysis });

  } catch (error) {
    console.error("❌ Backend error:", error.message);
    res.status(500).json({ error: "Internal server error. Please try again later." });
  }
});

// 🚀 Dynamic port for local + Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
});
