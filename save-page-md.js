#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";

import { unified } from "unified";
import rehypeParse from "rehype-parse";
import rehypeRemark from "rehype-remark";
import remarkStringify from "remark-stringify";
import remarkGfm from "remark-gfm";

const CONTENT_SELECTOR = "#page";
const EXTRA_WAIT_MS = 2000; // <- wie gewünscht: 2 Sekunden

function usage() {
  console.log(`Usage:
  node save-page-md.mjs <url|urls.txt> [output_dir]

Input:
  - Single URL (starts with http/https)
  - Or a text file with one URL per line (blank lines and lines starting with # are ignored)

Examples:
  node save-page-md.mjs https://example.com
  node save-page-md.mjs https://example.com ./out
  node save-page-md.mjs ./urls.txt ./out
`);
}

const input = process.argv[2];
const outDir = process.argv[3] || ".";

if (!input) {
  usage();
  process.exit(2);
}

// --- Convert HTML -> Markdown using Unified rehype/remark ---
async function htmlToMarkdown(html) {
  const file = await unified()
    .use(rehypeParse, { fragment: true }) // innerHTML is a fragment
    .use(rehypeRemark)
    .use(remarkGfm)
    .use(remarkStringify, {
      bullet: "-",
      emphasis: "*",
      //fence: "```",
      fence: "~",
      fences: true,
      listItemIndent: "one",
    })
    .process(html);

  return String(file).trim() + "\n";
}

// --- Make a safe filename from a title ---
function slugifyFilename(title) {
  const fallback = "page";
  const t = (title || "").trim();
  if (!t) return fallback;

  let s = t
    .replace(/[\u0000-\u001F\u007F]/g, "") // control chars
    .replace(/[\/\\?%*:|"<>]/g, "-")       // illegal filename chars
    .replace(/\s+/g, " ")                  // collapse whitespace
    .trim()
    .replace(/[. ]+$/g, "");               // no trailing dot/space (Windows)

  if (!s) s = fallback;

  const MAX = 120;
  if (s.length > MAX) s = s.slice(0, MAX).trim();

  return s;
}

// --- If file exists, append -1, -2, ... ---
async function uniquePath(dir, baseName, ext = ".md") {
  let candidate = path.join(dir, `${baseName}${ext}`);
  let i = 1;
  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(dir, `${baseName}-${i}${ext}`);
      i += 1;
    } catch {
      return candidate;
    }
  }
}

function looksLikeUrl(s) {
  return /^https?:\/\//i.test((s || "").trim());
}

// --- Read URLs from input (URL or txt file) ---
async function getUrls(inputValue) {
  const v = (inputValue || "").trim();

  // Single URL
  if (looksLikeUrl(v)) return [v];

  // Otherwise treat as file
  const raw = await fs.readFile(v, "utf8");
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .filter(looksLikeUrl);
}

const urls = await getUrls(input);

if (!urls.length) {
  console.error("❌ No valid URLs found. Provide a URL or a .txt file with one URL per line (http/https).");
  process.exit(2);
}

// Ensure output directory exists
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();

let ok = 0;
let fail = 0;

try {
  for (const url of urls) {
    try {
      // Load page (JS-rendered)
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });

      // Wait for content container
      await page.waitForSelector(CONTENT_SELECTOR, { timeout: 30000 });

      // Extra fixed wait as requested
      await page.waitForTimeout(EXTRA_WAIT_MS);

      // Title -> filename base
      const title = await page.title();
      const safeBase = slugifyFilename(title);

      // Extract only the HTML under div#page
      const html = await page.$eval(CONTENT_SELECTOR, (el) => el.innerHTML);

      // Convert to Markdown
      const markdown = await htmlToMarkdown(html);

      // Write file (unique name)
      const filePath = await uniquePath(outDir, safeBase, ".md");
      await fs.writeFile(filePath, markdown, "utf8");

      ok += 1;
      console.log(`✅ [${ok + fail}/${urls.length}] ${url}`);
      console.log(`   Title: ${title || "(no title)"}`);
      console.log(`   Saved: ${filePath}`);
    } catch (err) {
      fail += 1;
      console.error(`❌ [${ok + fail}/${urls.length}] ${url}`);
      console.error(`   Error: ${err?.message || err}`);
    }
  }

  console.log(`\nDone. ✅ OK: ${ok}  ❌ Failed: ${fail}  (Total: ${urls.length})`);
} finally {
  await browser.close();
}