import { getClient } from '@onebrain/db';
import { lookup } from 'node:dns/promises';
import { get as httpsGet } from 'node:https';
import { get as httpGet } from 'node:http';
import { createInflateRaw } from 'node:zlib';
import { Readable } from 'node:stream';
import { audit } from '../lib/audit.js';
import { sanitizeFilename, isPrivateIp } from '../lib/security-utils.js';

interface MemoryCandidate {
  title: string;
  body: string;
  type: string;
  confidence: number;
}

/**
 * Resolves URL hostname, validates it targets a public IP,
 * and returns the validated address. The caller uses a pinned
 * DNS lookup callback to prevent DNS rebinding (TOCTOU).
 */
async function assertPublicUrl(url: string): Promise<{
  hostname: string;
  resolvedIp: string;
  family: number;
}> {
  const parsed = new URL(url);

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }

  const hostname = parsed.hostname;

  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '0.0.0.0'
  ) {
    throw new Error('Requests to localhost are not allowed');
  }

  let address: string;
  let family: number;
  try {
    const result = await lookup(hostname);
    address = result.address;
    family = result.family;
  } catch {
    throw new Error('Failed to resolve hostname');
  }

  if (isPrivateIp(address)) {
    throw new Error('Requests to private/internal IP addresses are not allowed');
  }

  return { hostname, resolvedIp: address, family };
}

/**
 * Creates a per-request DNS lookup function that always returns
 * the pre-validated IP. No shared state — immune to race conditions.
 */
function createPinnedLookup(resolvedIp: string, family: number) {
  return (
    _hostname: string,
    _options: unknown,
    callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
  ): void => {
    callback(null, resolvedIp, family);
  };
}

/**
 * Fetches a URL using the pinned DNS cache so the connection
 * goes to the pre-validated IP. Works with both HTTP and HTTPS.
 * TLS cert validation uses the original hostname (correct SNI).
 */
async function pinnedFetch(
  url: string,
  resolvedIp: string,
  family: number,
): Promise<{
  ok: boolean;
  status: number;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
}> {
  const parsed = new URL(url);
  const isHttps = parsed.protocol === 'https:';
  const getter = isHttps ? httpsGet : httpGet;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      req.destroy();
      reject(new Error('Request timeout (10s)'));
    }, 10000);

    const req = getter(
      url,
      {
        headers: {
          'User-Agent': 'OneBrain/1.0 (Memory Ingestion)',
          Accept: 'text/html,text/plain,application/json',
        },
        lookup: createPinnedLookup(resolvedIp, family),
      },
      (res) => {
        clearTimeout(timer);
        const status = res.statusCode ?? 0;
        const chunks: Buffer[] = [];

        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          resolve({
            ok: status >= 200 && status < 300,
            status,
            headers: {
              get(name: string) {
                const val = res.headers[name.toLowerCase()];
                return Array.isArray(val) ? (val[0] ?? null) : (val ?? null);
              },
            },
            text: async () => Buffer.concat(chunks).toString('utf-8'),
          });
        });
        res.on('error', (err) => {
          clearTimeout(timer);
          reject(err);
        });
      },
    );

    req.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);
}

function extractTitle(text: string): string {
  const firstLine = text.split('\n')[0] ?? '';
  const cleaned = firstLine.replace(/^[-*>#\d.)\]]+\s*/, '').trim();
  if (cleaned.length <= 100) {
    return cleaned;
  }
  return cleaned.slice(0, 97) + '...';
}

export async function ingestUrl(
  userId: string,
  url: string,
): Promise<{ candidates: MemoryCandidate[]; sourceEventId: string }> {
  const prisma = getClient();

  // SSRF protection: resolve + validate DNS, pass resolved IP directly to fetch
  const { resolvedIp, family } = await assertPublicUrl(url);

  const response = await pinnedFetch(url, resolvedIp, family);

  if (!response.ok) {
    throw new Error(`Failed to fetch URL: HTTP ${response.status}`);
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 10 * 1024 * 1024) {
    throw new Error('Response too large (max 10MB)');
  }

  const rawContent = await response.text();
  const textContent = stripHtml(rawContent);

  const sourceEvent = await prisma.sourceEvent.create({
    data: {
      userId,
      sourceType: 'url_import',
      rawContent: textContent.slice(0, 50000),
      isProcessed: false,
    },
  });

  const paragraphs = splitIntoParagraphs(textContent);
  const candidates: MemoryCandidate[] = paragraphs.slice(0, 30).map((paragraph) => ({
    title: extractTitle(paragraph),
    body: paragraph.slice(0, 10000),
    type: 'fact',
    confidence: 0.6,
  }));

  await prisma.sourceEvent.update({
    where: { id: sourceEvent.id },
    data: { isProcessed: true },
  });

  // Strip query params from URL before audit — they may contain tokens or PII
  const sanitizedUrl = (() => {
    try {
      const parsed = new URL(url);
      return parsed.origin + parsed.pathname;
    } catch {
      return '[invalid-url]';
    }
  })();

  audit(userId, 'ingest_url', 'source_event', sourceEvent.id, {
    url: sanitizedUrl,
    candidateCount: candidates.length,
  });

  return { candidates, sourceEventId: sourceEvent.id };
}

export async function parseChat(
  userId: string,
  transcript: string,
  format: string,
): Promise<{ candidates: MemoryCandidate[]; sourceEventId: string }> {
  const prisma = getClient();

  const sourceEvent = await prisma.sourceEvent.create({
    data: {
      userId,
      sourceType: 'chat_import',
      rawContent: transcript.slice(0, 100000),
      isProcessed: false,
    },
  });

  const messages = extractChatMessages(transcript, format);
  const candidates = messagesToCandidates(messages);

  await prisma.sourceEvent.update({
    where: { id: sourceEvent.id },
    data: { isProcessed: true },
  });

  audit(userId, 'parse_chat', 'source_event', sourceEvent.id, {
    format,
    messageCount: messages.length,
    candidateCount: candidates.length,
  });

  return { candidates, sourceEventId: sourceEvent.id };
}

interface ChatMessage {
  role: string;
  content: string;
}

function extractChatMessages(transcript: string, format: string): ChatMessage[] {
  if (format === 'user-assistant') {
    return parseUserAssistant(transcript);
  }

  if (format === 'timestamp') {
    return parseTimestamp(transcript);
  }

  const hasUserAssistant = /^(User|Human|Me|Assistant|AI|Bot|Claude|ChatGPT):/im.test(transcript);
  if (hasUserAssistant) {
    return parseUserAssistant(transcript);
  }

  const hasTimestamp = /^\[?\d{1,4}[-/]\d{1,2}[-/]\d{1,4}/m.test(transcript);
  if (hasTimestamp) {
    return parseTimestamp(transcript);
  }

  return parseUserAssistant(transcript);
}

function parseUserAssistant(transcript: string): ChatMessage[] {
  const lines = transcript.split('\n');
  const messages: ChatMessage[] = [];
  let currentRole = '';
  let currentContent = '';

  const rolePattern = /^(User|Human|Me|Assistant|AI|Bot|Claude|ChatGPT|Gemini|System):\s*/i;

  for (const line of lines) {
    const match = line.match(rolePattern);
    if (match) {
      if (currentRole && currentContent.trim()) {
        messages.push({
          role: currentRole,
          content: currentContent.trim(),
        });
      }
      currentRole = match[1]!.toLowerCase();
      currentContent = line.slice(match[0].length);
    } else {
      currentContent += '\n' + line;
    }
  }

  if (currentRole && currentContent.trim()) {
    messages.push({
      role: currentRole,
      content: currentContent.trim(),
    });
  }

  return messages;
}

function parseTimestamp(transcript: string): ChatMessage[] {
  const lines = transcript.split('\n');
  const messages: ChatMessage[] = [];
  let currentContent = '';

  const tsPattern = /^\[?\d{1,4}[-/]\d{1,2}[-/]\d{1,4}[\s,T]+\d{1,2}:\d{2}/;

  for (const line of lines) {
    if (tsPattern.test(line)) {
      if (currentContent.trim()) {
        messages.push({
          role: 'user',
          content: currentContent.trim(),
        });
      }
      const contentStart = line.replace(tsPattern, '').replace(/^\]?\s*[-:]?\s*/, '');
      currentContent = contentStart;
    } else {
      currentContent += '\n' + line;
    }
  }

  if (currentContent.trim()) {
    messages.push({
      role: 'user',
      content: currentContent.trim(),
    });
  }

  return messages;
}

function messagesToCandidates(messages: ChatMessage[]): MemoryCandidate[] {
  const userRoles = new Set(['user', 'human', 'me']);

  const userMessages = messages.filter((msg) => userRoles.has(msg.role) && msg.content.length > 20);

  return userMessages.slice(0, 50).map((msg) => ({
    title: extractTitle(msg.content),
    body: msg.content.slice(0, 10000),
    type: 'fact',
    confidence: 0.6,
  }));
}

/**
 * Extract text from a PDF buffer using pdf-parse (optional dependency).
 * Returns extracted text or an empty string if the library is unavailable.
 */
async function extractPdfText(buffer: Buffer): Promise<string> {
  try {
    const pdfParse = await import('pdf-parse');
    const parse = pdfParse.default ?? pdfParse;
    const result = await parse(buffer);
    return result.text ?? '';
  } catch {
    return '';
  }
}

/**
 * Extract text from a DOCX buffer by parsing the XML inside the ZIP.
 * DOCX files are ZIP archives containing word/document.xml.
 * Uses Node.js built-in zlib — no external dependencies required.
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  try {
    const entries = parseZipEntries(buffer);
    const documentEntry = entries.find((entry) => entry.filename === 'word/document.xml');

    if (!documentEntry) {
      return '';
    }

    const xmlBuffer = await inflateEntry(buffer, documentEntry, createInflateRaw, Readable);
    const xml = xmlBuffer.toString('utf-8');

    return xml
      .replace(/<w:p[^>]*\/>/g, '\n')
      .replace(/<w:p[\s>]/g, '\n')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<w:tab[^>]*\/>/g, '\t')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  } catch {
    return '';
  }
}

interface ZipEntry {
  filename: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  dataOffset: number;
}

const MAX_UNCOMPRESSED_ENTRY_SIZE = 50 * 1024 * 1024; // 50 MB
const MAX_ZIP_ENTRIES = 1000;
const MAX_ZIP_TOTAL_UNCOMPRESSED = 100 * 1024 * 1024; // 100 MB cumulative

function parseZipEntries(buffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;
  let totalUncompressed = 0;

  while (offset < buffer.length - 4) {
    if (entries.length >= MAX_ZIP_ENTRIES) break;
    const signature = buffer.readUInt32LE(offset);
    if (signature !== 0x04034b50) break;

    const compressionMethod = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const filenameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const filename = buffer.toString('utf-8', offset + 30, offset + 30 + filenameLength);
    const dataOffset = offset + 30 + filenameLength + extraLength;

    if (uncompressedSize > MAX_UNCOMPRESSED_ENTRY_SIZE) {
      throw new Error(`ZIP entry "${filename}" exceeds max size (${uncompressedSize} bytes)`);
    }

    totalUncompressed += uncompressedSize;
    if (totalUncompressed > MAX_ZIP_TOTAL_UNCOMPRESSED) {
      throw new Error(
        `ZIP archive cumulative uncompressed size exceeds 100 MB limit (${totalUncompressed} bytes)`,
      );
    }

    entries.push({
      filename,
      compressedSize,
      uncompressedSize,
      compressionMethod,
      dataOffset,
    });

    offset = dataOffset + compressedSize;
  }

  return entries;
}

async function inflateEntry(
  buffer: Buffer,
  entry: ZipEntry,
  createInflateRawFn: typeof createInflateRaw,
  ReadableCtor: typeof Readable,
): Promise<Buffer> {
  const rawData = buffer.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);

  if (entry.compressionMethod === 0) {
    return Buffer.from(rawData);
  }

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const inflate = createInflateRawFn();
    inflate.on('data', (chunk: Buffer) => chunks.push(chunk));
    inflate.on('end', () => resolve(Buffer.concat(chunks)));
    inflate.on('error', reject);
    ReadableCtor.from(rawData).pipe(inflate);
  });
}

export async function processUploadedFile(
  userId: string,
  filename: string,
  content: Buffer,
): Promise<{
  candidates: MemoryCandidate[];
  fileUploadId: string;
}> {
  const prisma = getClient();
  const extension = filename.split('.').pop()?.toLowerCase() ?? '';

  const fileUpload = await prisma.fileUpload.create({
    data: {
      userId,
      filename: sanitizeFilename(filename),
      mimeType: getMimeType(extension),
      sizeBytes: content.length,
      storagePath: `uploads/${userId}/${Date.now()}_${sanitizeFilename(filename)}`,
      isProcessed: false,
    },
  });

  let candidates: MemoryCandidate[] = [];

  if (extension === 'json') {
    const textContent = content.toString('utf-8');
    candidates = parseJsonFile(textContent);
  } else if (extension === 'csv') {
    const textContent = content.toString('utf-8');
    candidates = parseCsvFile(textContent);
  } else if (extension === 'txt') {
    const textContent = content.toString('utf-8');
    candidates = parseTxtFile(textContent);
  } else if (extension === 'pdf') {
    const textContent = await extractPdfText(content);
    candidates = parseTxtFile(textContent);
  } else if (extension === 'docx') {
    const textContent = await extractDocxText(content);
    candidates = parseTxtFile(textContent);
  }

  await prisma.fileUpload.update({
    where: { id: fileUpload.id },
    data: { isProcessed: true },
  });

  audit(userId, 'upload_file', 'file_upload', fileUpload.id, {
    filename: sanitizeFilename(filename),
    extension,
    candidateCount: candidates.length,
  });

  return { candidates, fileUploadId: fileUpload.id };
}

function getMimeType(extension: string): string {
  const mimeMap: Record<string, string> = {
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return mimeMap[extension] ?? 'application/octet-stream';
}

function parseJsonFile(content: string): MemoryCandidate[] {
  try {
    const parsed = JSON.parse(content);
    const items = Array.isArray(parsed) ? parsed : [parsed];

    return items
      .filter((item: unknown) => {
        if (!item || typeof item !== 'object') return false;
        const obj = item as Record<string, unknown>;
        return typeof obj['title'] === 'string' || typeof obj['body'] === 'string';
      })
      .slice(0, 500)
      .map((item: Record<string, unknown>) => ({
        title:
          String(item['title'] ?? '').slice(0, 500) || String(item['body'] ?? '').slice(0, 100),
        body: String(item['body'] ?? item['content'] ?? '').slice(0, 10000),
        type: String(item['type'] ?? 'fact'),
        confidence: 0.8,
      }));
  } catch {
    return [];
  }
}

function parseCsvFile(content: string): MemoryCandidate[] {
  const lines = content.split('\n').filter((l) => l.trim());
  if (lines.length < 2) {
    return [];
  }

  const headerLine = lines[0]!;
  const headers = parseCsvRow(headerLine).map((h) => h.toLowerCase().trim());

  const titleIdx = headers.indexOf('title');
  const bodyIdx = headers.indexOf('body');
  const contentIdx = headers.indexOf('content');
  const typeIdx = headers.indexOf('type');

  if (titleIdx === -1 && bodyIdx === -1 && contentIdx === -1) {
    return [];
  }

  return lines
    .slice(1, 501)
    .map((line) => {
      const cols = parseCsvRow(line);
      const title = (cols[titleIdx] ?? '').slice(0, 500);
      const body = (cols[bodyIdx] ?? cols[contentIdx] ?? '').slice(0, 10000);
      const type = cols[typeIdx] ?? 'fact';

      return {
        title: title || body.slice(0, 100),
        body,
        type,
        confidence: 0.8,
      };
    })
    .filter((c) => c.body.trim().length > 0);
}

function parseCsvRow(row: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i]!;

    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

function parseTxtFile(content: string): MemoryCandidate[] {
  const paragraphs = splitIntoParagraphs(content);

  return paragraphs.slice(0, 100).map((paragraph) => ({
    title: extractTitle(paragraph),
    body: paragraph.slice(0, 10000),
    type: 'fact',
    confidence: 0.6,
  }));
}
