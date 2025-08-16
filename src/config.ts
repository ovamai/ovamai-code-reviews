import dotenv from 'dotenv';

dotenv.config();

export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
export const PORT = process.env.PORT || 8080;

export const OPENAI_MODEL = process.env.OPENAI_MODEL || '';
