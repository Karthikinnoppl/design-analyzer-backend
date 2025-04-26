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
  const { url } = req.body;

  // ✅ Validate input
  if (!url || !url.startsWith("http")) {
    return res.status(400).json({ error: "❌ Invalid URL provided" });
  }

  try {
    // ✅ Fetch website HTML
    const html = await fetch(url).then((res) => res.text());

    // ✅ Ask OpenAI to analyze the design
    const prompt = `
You are a UX/UI design expert. Analyze the HTML of the website below and provide:
1. A Design Score out of 100
2. 5 UX improvement recommendations

Website HTML:
${html}
    `;

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const analysis = completion.choices[0].message.content;
    res.json({ analysis });

  } catch (error) {
    console.error("❌ Error during analysis:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Dynamic port for local + Render
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
});
