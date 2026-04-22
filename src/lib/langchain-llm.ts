import { ChatGoogleGenerativeAI } from "@langchain/google-genai";

export const geminiLLM = new ChatGoogleGenerativeAI({
  model: "gemini-2.5-flash",  // modelName이 아니라 model
  apiKey: process.env.GEMINI_API_KEY,
  streaming: true,
  temperature: 0.7,

});

