// src/scripts/testOpenAI.js
import OpenAI from "openai";
import dotenv from "dotenv";

// Load .env
dotenv.config();

async function run() {
  console.log("🔑 API Key present?", !!process.env.OPENAI_API_KEY);

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    // 1) Test Embeddings
    const text = "Workday is a cloud-based HR and finance platform.";
    console.log(`📝 Creating embedding for: "${text}"`);

    const embResp = await client.embeddings.create({
      model: "text-embedding-3-large",
      input: text,
    });

    const embedding = embResp.data[0].embedding;
    console.log(`✅ Embedding success: length=${embedding.length}`);
    console.log("Sample vector:", embedding.slice(0, 8), "...");

    // 2) Test Chat Completion
    console.log("💬 Testing chat completion...");
    const chatResp = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: "Explain Workday in one short sentence." },
      ],
      max_tokens: 50,
    });

    console.log("🤖 LLM Response:", chatResp.choices[0].message.content);

  } catch (err) {
    console.error("❌ OpenAI API error:", err.message);
    console.error(err);
  }
}

run();