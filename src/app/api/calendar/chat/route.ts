import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/prisma";

const NOTION_API_KEY = process.env.NOTION_API_KEY || "";
const NOTION_VERSION = "2022-06-28";

interface NotionTextRichText {
  plain_text: string;
}

interface NotionBlock {
  id: string;
  type: string;
  paragraph?: { rich_text: NotionTextRichText[] };
  heading_1?: { rich_text: NotionTextRichText[] };
  heading_2?: { rich_text: NotionTextRichText[] };
  heading_3?: { rich_text: NotionTextRichText[] };
  bulleted_list_item?: { rich_text: NotionTextRichText[] };
  numbered_list_item?: { rich_text: NotionTextRichText[] };
  toggle?: { rich_text: NotionTextRichText[] };
  to_do?: { rich_text: NotionTextRichText[] };
  has_children?: boolean;
}

interface NotionPage {
  id: string;
  object: string;
  properties?: Record<string, {
    type: string;
    title?: NotionTextRichText[];
    rich_text?: NotionTextRichText[];
  }>;
  url?: string;
}

function extractTextFromBlock(block: NotionBlock): string {
  const typeMap: Array<keyof NotionBlock> = [
    "paragraph",
    "heading_1",
    "heading_2",
    "heading_3",
    "bulleted_list_item",
    "numbered_list_item",
    "toggle",
    "to_do",
  ];

  for (const type of typeMap) {
    const content = block[type] as { rich_text: NotionTextRichText[] } | undefined;
    if (content?.rich_text) {
      return content.rich_text.map((rt) => rt.plain_text).join("");
    }
  }
  return "";
}

async function fetchBlockChildren(blockId: string, depth = 0): Promise<string> {
  if (depth > 2) return "";
  try {
    const res = await fetch(`https://api.notion.com/v1/blocks/${blockId}/children?page_size=50`, {
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
      },
    });
    if (!res.ok) return "";
    const data = await res.json() as { results: NotionBlock[] };
    const texts: string[] = [];
    for (const block of data.results || []) {
      const text = extractTextFromBlock(block);
      if (text) texts.push(text);
      if (block.has_children) {
        const childText = await fetchBlockChildren(block.id, depth + 1);
        if (childText) texts.push(childText);
      }
    }
    return texts.join("\n");
  } catch {
    return "";
  }
}

function getPageTitle(page: NotionPage): string {
  if (!page.properties) return "Untitled";
  for (const prop of Object.values(page.properties)) {
    if (prop.type === "title" && prop.title) {
      return prop.title.map((t) => t.plain_text).join("") || "Untitled";
    }
  }
  return "Untitled";
}

export async function POST(req: NextRequest) {
  const { message } = await req.json();
  if (!message) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  // Search Notion
  let notionContext = "";
  const sources: string[] = [];

  try {
    const searchRes = await fetch("https://api.notion.com/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: message, page_size: 5 }),
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json() as { results: NotionPage[] };
      const pages = searchData.results || [];

      for (const page of pages) {
        if (page.object !== "page" && page.object !== "database") continue;
        const title = getPageTitle(page);
        sources.push(title);
        const content = await fetchBlockChildren(page.id);
        if (content) {
          notionContext += `\n\n--- Notion Page: "${title}" ---\n${content}`;
        }
      }
    }
  } catch {
    // Notion search failed, continue without context
  }

  // Get calendar client data
  const calendarClients = await prisma.calendarClient.findMany({
    orderBy: { contractStart: "asc" },
  });

  const clientContext = calendarClients
    .map((c) => {
      const end = c.contractEnd ? c.contractEnd.toISOString().split("T")[0] : "ongoing";
      const value = c.monthlyValue ? `$${c.monthlyValue.toLocaleString()}/mo` : "no value set";
      return `- ${c.name}: ${c.contractStart.toISOString().split("T")[0]} to ${end}, ${value}`;
    })
    .join("\n");

  const systemPrompt = `You are an internal ops assistant for Vyral Labs, a UGC growth agency. You have access to real Notion workspace content and client contract data. Answer precisely and concisely. If information isn't in the provided content, say so directly rather than speculating.

Current client contracts:
${clientContext}
${notionContext ? `\nNotion workspace content:${notionContext}` : ""}`;

  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const completion = await anthropic.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: "user", content: message }],
  });

  const answer = completion.content[0].type === "text" ? completion.content[0].text : "";

  return NextResponse.json({ answer, sources });
}
