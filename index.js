require("dotenv").config(); // Load .env first

const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
const { OpenAI } = require("openai");
const mongoose = require("mongoose");

const app = express();

// ✅ Robust Render mode detection
const isRender =
  process.env.RENDER === "true" ||
  process.env.NODE_ENV === "production" ||
  !!process.env.RENDER_EXTERNAL_URL;

// 🐞 Debug logs
console.log("🔍 process.env.RENDER =", process.env.RENDER);
console.log("🔍 process.env.NODE_ENV =", process.env.NODE_ENV);
console.log("🔍 process.env.RENDER_EXTERNAL_URL =", process.env.RENDER_EXTERNAL_URL);
console.log("✅ isRender =", isRender);

// ✅ Dynamic puppeteer engine loading
const puppeteer = isRender ? require("puppeteer-core") : require("puppeteer");
const chromium = isRender ? require("chrome-aws-lambda") : null;




if (!process.env.MONGO_URI || !process.env.OPENAI_API_KEY || !process.env.PAGESPEED_API_KEY) {
  console.error("❌ Required environment variables are missing.");
  process.exit(1);
}

const allowedOrigins = [
  "http://localhost:3000",
  "https://design-score-app.vercel.app"
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn("❌ CORS blocked origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions)); // handle preflight OPTIONS requests


app.use(express.json());

mongoose.connect(process.env.MONGO_URI);
mongoose.connection.once("open", () => console.log("✅ Connected to MongoDB"));
mongoose.connection.on("error", (err) => console.error("❌ MongoDB error:", err));

const DesignResultSchema = new mongoose.Schema({
  url: String,
  pageType: String,
  score: Number,
  pageSpeed: Number,
  analysisSections: Object,
  checklist: Array,
  createdAt: { type: Date, default: Date.now },
});
const DesignResult = mongoose.model("DesignResult", DesignResultSchema);

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function fetchImportantSections(url) {
  console.log("🚀 Launching Puppeteer...");
  let browser;

  try {
    const executablePath = isRender ? await chromium.executablePath : undefined;

    if (isRender) {
      console.log("🧭 Render mode detected");
      console.log("📍 Chromium executablePath =", executablePath);

      if (!executablePath) {
        throw new Error("Chromium executablePath is null on Render. Check if chrome-aws-lambda is installed properly.");
      }
    }

    const launchOptions = isRender
      ? {
          args: chromium.args,
          executablePath: await chromium.executablePath,
          headless: chromium.headless,
          defaultViewport: chromium.defaultViewport,
        }
      : {
          headless: true,
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
          defaultViewport: null,
        };

    browser = await puppeteer.launch(launchOptions);
    console.log("✅ Puppeteer launched successfully");
  } catch (error) {
    console.error("❌ Error launching Puppeteer:", error);
    throw error;
  }

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });

  const safeEval = async (selector) => {
    try {
      return await page.$eval(selector, (el) => el.outerHTML);
    } catch {
      return "";
    }
  };

  const header = await safeEval("header");
  const nav = await safeEval("nav");
  const footer = await safeEval("footer");
  const main = await safeEval("main");

  await browser.close();

  return { header, nav, footer, main };
}


function getValidationInstructions(pageType) {
  switch (pageType) {
    case "Homepage": return `Clear nav, search bar, banners, featured categories, internal links.`;
    case "PLP": return `Filters, sort options, product grid layout, breadcrumbs, category headings.`;
    case "PDP": return `Title, image, ATC button, reviews, variant selectors, related products.`;
    case "Blog": return `Featured image, author/date info, readable typography, tags, CTA or related content.`;
    default: return "";
  }
}

async function getPageSpeedScore(url) {
  const apiKey = process.env.PAGESPEED_API_KEY;
  const endpoint = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${apiKey}&strategy=mobile`;
  const response = await fetch(endpoint);
  const data = await response.json();
  const score = data?.lighthouseResult?.categories?.performance?.score;
  return score ? Math.round(score * 100) : null;
}

app.post("/analyze", async (req, res) => {
  let { url, pageType } = req.body;
  if (!pageType) pageType = "Homepage";
  if (url && !/^https?:\/\//i.test(url)) url = "https://" + url;
  if (!url.startsWith("http")) return res.status(400).json({ error: "❌ Invalid URL provided" });

  try {
    const htmlSnippet = await fetchImportantSections(url);
    const instructions = getValidationInstructions(pageType);

    const prompt = `You are a senior UX auditor. Do not return extracted HTML or DOM metadata.
Your task is to evaluate the UX/UI quality of the following ${pageType} page.

Respond ONLY with a valid JSON object in this exact format:
{
  "score": 75,
  "sections": {
    "Product Discovery": "- ✅ ...\n- ⚠️ ...\n- ❌ ...\n- ⚠️ ...\n- ✅ ...",
    "Branding & Trust": "...",
    "Mobile Experience": "...",
    "Performance Perception": "...",
    "Recommendations": "..."
  },
  "checklist": [
    { "category": "Navigation clarity and consistency", "status": "✅ Pass" },
    { "category": "Visual hierarchy", "status": "⚠️ Needs Improvement" },
    { "category": "Mobile responsiveness", "status": "⚠️ Needs Improvement" }
  ]
}

Each section must contain exactly 5 bullet points. Each bullet:
- Starts with ✅, ⚠️, or ❌
- Is a full sentence
- Is written on its own line
- Does NOT contain multiple observations in one bullet

Context: ${instructions}
HTML Snapshot:
${htmlSnippet}`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });

    const raw = completion.choices[0].message.content;
    console.log("🔍 GPT Raw Response:\n", raw);

    const jsonMatch = raw.match(/{[\s\S]*}/);
    if (!jsonMatch) {
      console.error("❌ Could not extract JSON object from GPT response.");
      return res.status(500).json({ error: "Malformed GPT response." });
    }

    const cleanJson = jsonMatch[0]
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/\u0000/g, "")
      .replace(/\r/g, "")
      .replace(/\n(?![-✅⚠️❌])/g, " ")
      .replace(/\n/g, "\\n")
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(cleanJson);
    } catch (err) {
      console.error("❌ JSON parse error:", err.message);
      return res.status(500).json({ error: "Invalid JSON format from GPT." });
    }

    const cleanedSections = parsed.sections;
    const pageSpeed = await getPageSpeedScore(url);

    await DesignResult.create({
      url,
      pageType,
      score: parsed.score,
      pageSpeed,
      analysisSections: cleanedSections,
      checklist: parsed.checklist,
    });

    res.json({
      score: parsed.score,
      pageSpeed,
      analysisSections: cleanedSections,
      checklist: parsed.checklist,
    });
  } catch (error) {
    console.error("❌ Error during analysis:", error.message);
    res.status(500).json({ error: "Internal server error." });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
});
