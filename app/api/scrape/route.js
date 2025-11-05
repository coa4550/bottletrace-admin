// Load environment variables explicitly from .env.local
import { readFileSync } from 'fs';
import { resolve } from 'path';

try {
  const envPath = resolve(process.cwd(), '.env.local');
  const envFile = readFileSync(envPath, 'utf8');
  envFile.split('\n').forEach(line => {
    // Skip comments and empty lines
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    
    // Match KEY=VALUE pattern
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();
      // Remove surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && !process.env[key]) {
        process.env[key] = value;
      }
    }
  });
} catch (e) {
  // .env.local might not exist, that's okay - Next.js will load it
  console.warn('Could not load .env.local manually:', e.message);
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import JSZip from 'jszip';
import { stringify } from 'csv-stringify';
import slugify from 'slugify';
import { request } from 'undici';
import { AgentRuntime, hostedMcpTool } from '@openai/agents';

export const runtime = 'nodejs'; // needs Node (not Edge) for zipping/network I/O
export const maxDuration = 60; // adjust per your Vercel plan / typical page size

const Body = z.object({
  url: z.string().url(),
  fields: z.array(z.enum([
    'brands',
    'categories',
    'logos',
    'descriptions',
    'homepages',
    'country'
  ])).default(['brands', 'categories', 'logos'])
});

function getBrightUrl() {
  const direct = process.env.BRIGHT_MCP_URL;
  if (direct) return direct;
  const token = process.env.BRIGHT_API_TOKEN;
  if (!token) {
    // Debug: Check what env vars are available (without exposing secrets)
    const hasOpenAi = !!process.env.OPENAI_API_KEY;
    const hasBrightUrl = !!process.env.BRIGHT_MCP_URL;
    const hasBrightToken = !!process.env.BRIGHT_API_TOKEN;
    throw new Error(
      `Missing Bright Data configuration. Set BRIGHT_MCP_URL or BRIGHT_API_TOKEN env var. ` +
      `(Found: OPENAI_API_KEY=${hasOpenAi}, BRIGHT_MCP_URL=${hasBrightUrl}, BRIGHT_API_TOKEN=${hasBrightToken})`
    );
  }
  return `https://mcp.brightdata.com/mcp?token=${token}`;
}

async function downloadLogo(url) {
  const res = await request(url);
  if (res.statusCode >= 400) throw new Error(`logo download failed: ${res.statusCode}`);
  const buf = Buffer.from(await res.body.arrayBuffer());
  const ct = (res.headers['content-type'] || '') || '';
  const ext = ct.includes('svg') ? 'svg' : ct.includes('jpeg') ? 'jpg' : ct.includes('webp') ? 'webp' : 'png';
  return { buf, ext };
}

export async function POST(req) {
  try {
    // Validate required environment variables
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'Missing OPENAI_API_KEY environment variable. Please set it in .env.local' },
        { status: 500 }
      );
    }

    const json = await req.json();
    const { url, fields } = Body.parse(json);

    const model = process.env.MODEL || 'gpt-5.1-mini';
    const agent = new AgentRuntime({
      model,
      apiKey: process.env.OPENAI_API_KEY,
      tools: [
        hostedMcpTool({
          label: 'brightdata-mcp',
          serverUrl: getBrightUrl()
        })
      ]
    });

    const want = new Set(fields);
    const guidance = `Return a JSON array of objects with exactly these fields when present:\n` +
      `- brand (string, required)\n` +
      (want.has('homepages') ? `- homepage (string, URL)\n` : '') +
      (want.has('logos') ? `- logo_url (string, URL)\n` : '') +
      (want.has('descriptions') ? `- description (string)\n` : '') +
      (want.has('categories') ? `- categories (array of strings)\n` : '') +
      (want.has('country') ? `- country (string)\n` : '') +
      `- source_url (string, URL of the page you scraped)\n` +
      `If multiple brands appear on the page, return multiple objects. Prefer SVG/PNG logos; resolve relative paths to absolute URLs.`;

    const system = `You extract structured brand data from a single web page using the Bright Data MCP tools.\n` +
      `Use "extract" when possible; otherwise "scrape_as_html" followed by your own parsing.\n` +
      `Return only valid JSON matching the schema described.`;

    const user = `Target URL: ${url}\n\nExtraction requirements:\n${guidance}\n\nSteps:\n` +
      `1) Attempt to call the "extract" tool on the target URL with instructions to map brand name, categories, and logo URLs.\n` +
      `2) If extract is not available or fails, call "scrape_as_html" and parse the HTML to produce the same JSON shape.`;

    const resp = await agent.prompt({ system, messages: [{ role: 'user', content: user }] });

    let items = [];
    try {
      const arr = JSON.parse(resp.output_text);
      if (!Array.isArray(arr)) throw new Error('Expected JSON array');
      // Light validation/normalization
      items = arr.map((o) => ({
        brand: String(o.brand ?? '').trim(),
        categories: Array.isArray(o.categories) ? o.categories.map((x) => String(x)) : undefined,
        logo_url: o.logo_url && typeof o.logo_url === 'string' ? o.logo_url : undefined,
        homepage: o.homepage && typeof o.homepage === 'string' ? o.homepage : undefined,
        description: o.description && typeof o.description === 'string' ? o.description : undefined,
        country: o.country && typeof o.country === 'string' ? o.country : undefined,
        source_url: o.source_url && typeof o.source_url === 'string' ? o.source_url : url
      })).filter((r) => r.brand);
    } catch (e) {
      throw new Error('Could not parse/validate extracted JSON: ' + e.message);
    }

    // Build CSV in-memory and collect logos into a ZIP
    const zip = new JSZip();

    // CSV: we stream into a buffer via callback
    const csvPromise = new Promise((resolve, reject) => {
      const chunks = [];
      stringify(
        items.map((it) => ({
          brand: it.brand,
          categories: (it.categories || []).join('|'),
          homepage: it.homepage || '',
          description: it.description || '',
          country: it.country || '',
          logo_url: it.logo_url || '',
          logo_file: it.logo_url ? (slugify(it.brand, { lower: true, strict: true }) || 'brand') : '',
          source_url: it.source_url,
          captured_at: new Date().toISOString()
        })),
        { header: true },
        (err, data) => {
          if (err) return reject(err);
          resolve(Buffer.from(data));
        }
      );
    });

    // Download logos (if requested)
    if (want.has('logos')) {
      for (const it of items) {
        if (it.logo_url) {
          try {
            const { buf, ext } = await downloadLogo(it.logo_url);
            const base = slugify(it.brand || 'brand', { lower: true, strict: true }) || 'brand';
            zip.file(`logos/${base}.${ext}`, buf);
          } catch (e) {
            // Silently skip failed logo downloads
            console.error(`Failed to download logo for ${it.brand}:`, e.message);
          }
        }
      }
    }

    // Add CSV
    const csvBuf = await csvPromise;
    zip.file('result.csv', csvBuf);

    const zipBuf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });

    return new NextResponse(zipBuf, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': 'attachment; filename="scrape-result.zip"'
      }
    });
  } catch (e) {
    return NextResponse.json(
      { error: e.message || 'Unknown error' },
      { status: 400 }
    );
  }
}

