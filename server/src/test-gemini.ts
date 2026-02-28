import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const apiKey = process.env.GEMINI_API_KEY || '';
console.log("Using API Key starting with:", apiKey.substring(0, 10));
const prompt = "Say hello to test the API.";

async function run() {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    const result = await model.generateContent(prompt);
    console.log("Success:", result.response.text());
  } catch (error: any) {
    console.error("Gemini Failure:", error.message);
  }
}

run();
