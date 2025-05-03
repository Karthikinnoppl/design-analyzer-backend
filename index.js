// ✅ index.js (backend)
const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { OpenAI } = require("openai");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const DesignResultSchema = new mongoose.Schema({
  url: String,
  pageType: String,
  score: Number,
  createdAt: { type: Date, default: Date.now },
});
const DesignResult = mongoose.model("DesignResult", DesignResultSchema);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post("/analyze", async (req, res) => {
  let { url, pageType } = req.body;
  if (!pageType) pageType = "Homepage";
  if (url && !/^https?:\/\//i.test(url)) {
    url = "https://" + url;
  }
  if (!url || !url.startsWith("http")) {
    return res.status(400).json({ error: "❌ Invalid URL provided" });
  }

  try {
    const html = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
    }).then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
      return res.text();
    });

    const limitedHtml = html.substring(0, 15000);

    const prompt = `
You are a senior UX/UI design expert.

The user has provided a webpage HTML for analysis.
The page type is: ${pageType}.

Please return your analysis in the following clearly separated sections:

1. A line like: "Design Score: [score]/100"
2. Then a section titled "## Recommendations", listing 5 actionable recommendations for UX/UI improvement on the given ${pageType}.
3. Then a section titled "## Advanced UX Checklist" formatted strictly as a markdown table with two columns:

| Category | Status |
|----------|--------|
| Navigation clarity and consistency | ✅ Pass |
| Visual hierarchy and layout alignment | ⚠️ Needs Improvement |
| CTA clarity and visibility | ✅ Pass |
| Mobile responsiveness | ⚠️ Needs Improvement |
| Accessibility | ✅ Pass |
| Page performance and speed | ⚠️ Needs Improvement |

Do not include any introduction or explanation outside these sections. Only the analysis result.

Website HTML:
${limitedHtml}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const analysis = completion.choices[0].message.content;
    const scoreMatch = analysis.match(/Design Score: (\d+)/);
    const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;

    // ✅ Save to DB
    if (score !== null) {
      await DesignResult.create({ url, pageType, score });
    }

    res.json({ analysis });
  } catch (error) {
    console.error("❌ Error during analysis:", error.message);
    res.status(500).json({ error: "Internal server error. Please try again later." });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
});
