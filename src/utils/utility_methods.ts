
export function logMemory(label: string) {
  const mem = process.memoryUsage()
  const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2) + 'MB'
  console.log(`[${label}] Memory - RSS: ${mb(mem.rss)}, HeapUsed: ${mb(mem.heapUsed)}, HeapTotal: ${mb(mem.heapTotal)}`)
}