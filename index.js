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

// 🔥 POST /analyze route
app.post("/analyze", async (req, res) => {
  let { url } = req.body;

  // ✅ If URL doesn't start with http/https, add https:// automatically
  if (url && !/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  if (!url || !url.startsWith("http")) {
    return res.status(400).json({ error: "❌ Invalid URL provided" });
  }

  try {
    // ✅ Fetch website HTML
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

    // ✅ Limit HTML to avoid GPT token limit (safe ~15000 characters)
    const limitedHtml = html.substring(0, 15000);

    // ✅ Prepare prompt
    const prompt = `
You are a senior UX/UI designer. 
Analyze the website HTML below and provide:
1. A Design Score out of 100
2. 5 specific UX/UI improvement recommendations

Website HTML:
${limitedHtml}
    `;

    // ✅ Call OpenAI (gpt-3.5-turbo)
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
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

// 🚀 Dynamic PORT for local + Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
});
