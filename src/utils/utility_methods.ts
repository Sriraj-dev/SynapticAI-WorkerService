import {encode} from 'gpt-tokenizer';
import { fetchTranscriptFromPublicAPI } from './yt_transcript_utils';
import { RedisStorage } from '../services/redis/storage';
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { Node } from 'unist'
import { TokenTextSplitter } from '@langchain/textsplitters';
import { createHash } from 'crypto'

const MAX_CHUNK_SIZE = 150; //Tokens


export function hashChunk(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

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

export async function splitMarkdownIntoRagChunks(markdown: string): Promise<string[]> {
  const tree = unified()
      .use(remarkParse)
      .parse(markdown)

  const chunks: string[] = []
  const youtubeVideoIds: string[] = [];
  let currentChunk = ''
  let currentSize = 0

  function extractYouTubeVideoId(html: string): string | null {
    const regex = /src="https:\/\/www\.youtube\.com\/embed\/([\w-]+)/;
    const match = html.match(regex);
    return match ? match[1] : null;
  }

  function nodeToString(node: Node): string {
      if (node.type === 'code') {
          const n = node as any
          return `${n.lang || ''}\n${n.value}\n`
      }
      if (node.type === 'heading') {
          return '#'.repeat((node as any).depth) + ' ' + (node as any).children.map(nodeToString).join('') + '\n'
      }
      if (node.type === 'paragraph' || node.type === 'list' || node.type === 'blockquote') {
          return (node as any).children.map(nodeToString).join('') + ' '
      }
      if (node.type === 'text') {
          return (node as any).value
      }
      if (node.type === 'listItem') {
          return '- ' + (node as any).children.map(nodeToString).join('') + ' '
      }
      if(node.type === 'html'){
        const html = (node as any).value as string;
        if (html.includes('data-youtube-video')) {
            const videoId = extractYouTubeVideoId(html);
            if (videoId) {
                youtubeVideoIds.push(videoId);
                console.log(`🎥 Found YouTube Video ID: ${videoId}`);
            }
        }
        return '';
      }
      if(node.type === 'link'){
        return (node as any).url + ' ' + (node as any).children.map(nodeToString).join('') + ' '
      }

      if((node as any).value){
        return (node as any).value
      }else if((node as any).children){
        return (node as any).children.map(nodeToString).join(' ')
      }
      
      return ''
  }

  function walk(nodes: Node[]) {
      for (const node of nodes) {
          const blockText = nodeToString(node)
          const blockSize = estimateTokens(blockText) 

          // check for heading2
          if (node.type === 'heading' && (node as any).depth === 2) {
              // flush current chunk before starting a new section
              if (currentChunk.length > 0) {
                  chunks.push(currentChunk.trim())
              }
              currentChunk = blockText
              currentSize = blockSize
              continue
          }

          // check chunk size
          if (currentSize + blockSize > MAX_CHUNK_SIZE) {
              if (currentChunk.length > 0) {
                  chunks.push(currentChunk.trim())
              }
              currentChunk = blockText
              currentSize = blockSize
          } else {
              currentChunk += blockText + '\n'
              currentSize += blockSize
          }
      }
  }

  walk((tree as any).children)

  // flush leftover
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.trim())
  }

  const splitter = new TokenTextSplitter({
      chunkSize: 150,
      chunkOverlap: 25,
  });

  for(const videoId of youtubeVideoIds){
    try{
      const cachedTranscript = await RedisStorage.getItem(`Transcript:${videoId}`);

      if(cachedTranscript && cachedTranscript.length > 0){
        const transcriptChunks = await splitter.splitText(cachedTranscript);
        chunks.push(`[Embedded Video]:${transcriptChunks[0]}`); // Only adding the intro of the video;
        continue;
      }

      const transcriptString = await fetchTranscriptFromPublicAPI(videoId)

      if(transcriptString){
        RedisStorage.setItemAsync(`Transcript:${videoId}`, transcriptString, 60 * 60 * 2) // 2 Hours

        const transcriptChunks = await splitter.splitText(transcriptString);
        chunks.push(`[Embedded Video]:${transcriptChunks[0]}`); // Only adding the intro of the video;
      }
    }catch(err){
      console.error("Could not fetch the transcript for the video ID:", videoId, err);
    }
  }

  return chunks
}