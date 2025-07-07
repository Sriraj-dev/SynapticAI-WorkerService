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

async function fetchTranscript(videoId: string): Promise<string | null> {
  const proc = Bun.spawn(["python3", "src/utils/transcript_generator.py", videoId], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();

  if (stderr) {
    console.error("Python stderr:", stderr);
  }

  try {
    const result = JSON.parse(stdout);
    if (result.transcript) {
      return result.transcript;
    } else {
      console.error("Transcript error:", result.error);
      return null;
    }
  } catch (err) {
    console.error("JSON parse error:", err);
    return null;
  }
}

export async function convertMarkdownToText(markdown: string): Promise<string> {
  // first, extract any YouTube iframe src
  const youtubeVideoIds: string[] = [];

  // match iframe tags with src containing youtube
  const iframeRegex = /<iframe[^>]+src="([^"]+youtube[^"]+)"[^>]*><\/iframe>/gi;

  let match;
  while ((match = iframeRegex.exec(markdown)) !== null) {
    const src = match[1];
    
    const videoIdMatch = src.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
    if (videoIdMatch) {
      const videoId = videoIdMatch[1];
      youtubeVideoIds.push(videoId);
    }
  }

  // remove all HTML tags (conservatively)
  let noHtml = markdown.replace(/<[^>]+>/g, "");

  // then remove leftover iframes and divs
  noHtml = noHtml.replace(/<\/?(div|iframe)[^>]*>/gi, "");

  // also remove horizontal rules
  noHtml = noHtml.replace(/^---$/gm, "");

  // convert markdown links to text (text + url)
  noHtml = noHtml.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1 ($2)");

  // remove emphasis/bold/etc
  noHtml = noHtml.replace(/(\*\*|__|\*|_|~~|`)(.*?)\1/g, "$2");

  // remove heading and blockquote symbols
  noHtml = noHtml.replace(/^\s{0,3}(#{1,6}|>+)\s?/gm, "");

  // remove list markers
  noHtml = noHtml.replace(/^[\s]*([-+*])\s+/gm, "");

  // collapse multiple newlines
  noHtml = noHtml.replace(/\n{2,}/g, "\n\n").trim();

  // finally append the transcript of each youtube video
  for(const videoId of youtubeVideoIds) {
    try {
      const transcriptString = await fetchTranscript(videoId)
      noHtml += `\n[Embedded Video]:${transcriptString}`;
    } catch (error) {
      console.error(`Error fetching transcript for video ${videoId}:`, error);
    }
  }

  return noHtml;
}

console.log(await convertMarkdownToText(`# SynapticAI

Synaptic AI is a productivity Tool that helps users to create / update / delete their notes using a rich text editor & multiple other features like:

- Chat with AI agent right from the browser
- Make you AI remember everything you leanr
- AI agent can create your tasks for you to manage.
- Dashboard lets you interact with your memory & tasks very comfortably
- We also have AI editing features in the application.
- & what not , much more in the paid tiers,

> Come & explore eveything with me , Thanks for supporting

\`\`\`
int main(){
console.log("Hello World")!
if(){}
else{}
}
\`\`\`

<div data-youtube-video="">
<iframe class="rounded-lg border border-muted" width="640" height="480" allowfullscreen="true" autoplay="false" disablekbcontrols="false" enableiframeapi="false" endtime="0" ivloadpolicy="0" loop="false" modestbranding="false" origin="" playlist="" rel="1" src="https://www.youtube.com/embed/xN1-2p06Urc?rel=1" start="0"></iframe>
</div>

---

1. Last trial on the markdown.

[https://www.apple.com/in-edu/shop/buy-ipad/ipad-pro/33.02-cm-13"-display-512gb-silver-wifi-cellular-standard-glass](https://www.apple.com/in-edu/shop/buy-ipad/ipad-pro/33.02-cm-13%22-display-512gb-silver-wifi-cellular-standard-glass)

<div data-twitter="" src="https://x.com/ColePalmer_0/status/1941686041770881191">
</div>`))

