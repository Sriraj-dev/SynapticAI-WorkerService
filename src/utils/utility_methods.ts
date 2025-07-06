import {encode} from 'gpt-tokenizer';

export function logMemory(label: string) {
  const mem = process.memoryUsage()
  const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + 'MB'
  console.log(`[${label}] Memory - RSS: ${mb(mem.rss)}, HeapUsed: ${mb(mem.heapUsed)}, HeapTotal: ${mb(mem.heapTotal)}`)
}

export function estimateTokens(text: string): number {
  try {
    return encode(text).length;
  } catch (error) {
    console.error("Error estimating tokens:", error);
    throw error;
  }
}

export function convertMarkdownToText(markdown : string){
  return markdown
  // Convert links: [text](url) -> text (url)
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
  // Remove images: ![alt](url) -> alt
  .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '$1')
  // Remove emphasis/bold/strikethrough/inline code: *text*, _text_, **text**, __text__, ~~text~~, `code`
  .replace(/(\*\*|__|\*|_|~~|`)(.*?)\1/g, '$2')
  // Remove headings and blockquote markers
  .replace(/^\s{0,3}(#{1,6}|>+)\s?/gm, '')
  // Remove horizontal rules
  .replace(/^-{3,}$/gm, '')
  // Remove remaining markdown symbols (lists etc)
  .replace(/^[\s]*([-+*])\s+/gm, '')
  // Remove extra spaces
  .replace(/\n{2,}/g, '\n\n')
  .trim();
}