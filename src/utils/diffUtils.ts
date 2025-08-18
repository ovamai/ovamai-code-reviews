import {get_encoding} from '@dqbd/tiktoken'

export function chunkDiff(diff: string, maxLines = 500): string[] {
  const lines = diff.split('\n');
  const chunks: string[] = [];
  for (let i = 0; i < lines.length; i += maxLines) {
    chunks.push(lines.slice(i, i + maxLines).join('\n'));
  }
  return chunks;
}


const tokenizer = get_encoding('cl100k_base')

export function encode(input: string): Uint32Array {
  return tokenizer.encode(input)
}

export function getTokenCount(input: string): number {
  input = input.replace(/<\|endoftext\|>/g, '')
  return encode(input).length
}

export function toTitleCase(str: string): string {
  return str
    ?.replace(/([A-Z])/g, ' $1')
    ?.replace(/^./, s => s.toUpperCase())
    ?.replace(/\b\w/g, c => c.toUpperCase());
}

export function cleanJsonResponse(rawResponseString: string) {
  let cleanedString = rawResponseString.trim();

  if (cleanedString.startsWith('```json')) {
    cleanedString = cleanedString.substring('```json'.length);
  }
  if (cleanedString.endsWith('```')) {
    cleanedString = cleanedString.substring(0, cleanedString.length - '```'.length);
  }

  cleanedString = cleanedString.trim();

  return cleanedString;
}