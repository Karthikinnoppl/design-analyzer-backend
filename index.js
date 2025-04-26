const express = require('express');
const fetch = require('node-fetch');
const OpenAI = require('openai');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// ✅ New correct way to initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/analyze', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'No URL provided' });

  try {
    const html = await fetch(url).then((res) => res.text());

    const prompt = `
You are an expert website UI/UX auditor.
Analyze the following homepage HTML and provide:

1. A design score out of 100 (based on UI/UX quality, structure, accessibility, speed, etc.)
2. Five detailed improvement recommendations.

HTML:
${html.slice(0, 6000)}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.5,
    });

    const result = response.choices[0].message.content;
    res.json({ analysis: result });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to analyze website" });
  }
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
});
