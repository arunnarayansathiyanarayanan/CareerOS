import OpenAI from "openai";

import { SKILL_ONTOLOGY } from "@/constants/skill-ontology";

const TAGGER_MODEL = "gpt-4o-mini" as const;

const SYSTEM_PROMPT =
  "You are a skill taxonomy mapper. Given a list of technologies/tools, map each to the closest canonical skill from the provided ontology. Return ONLY a JSON array of matched canonical skill names. If nothing matches, return [].";

function getOpenAIClient(): OpenAI {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    throw new Error("OPENAI_API_KEY is not set");
  }
  return new OpenAI({ apiKey: key });
}

function buildLowercaseToCanonical(): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of SKILL_ONTOLOGY) {
    m.set(s.toLowerCase(), s);
  }
  return m;
}

function parseJsonArray(raw: string): unknown {
  const trimmed = raw.trim();
  const unfenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "");
  return JSON.parse(unfenced) as unknown;
}

function normalizeAiMatches(
  parsed: unknown,
  canonicalLower: Map<string, string>
): string[] {
  if (!Array.isArray(parsed)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of parsed) {
    if (typeof item !== "string") continue;
    const canonical = canonicalLower.get(item.trim().toLowerCase());
    if (canonical && !seen.has(canonical)) {
      seen.add(canonical);
      out.push(canonical);
    }
  }
  return out;
}

/**
 * Maps `ai_stack` entries to canonical ontology tags (deterministic match + optional OpenAI for leftovers).
 */
export async function autoTagSkills(
  ai_stack: string[],
  title: string,
  problem_solved: string
): Promise<string[]> {
  const lowerToCanonical = buildLowercaseToCanonical();
  const ordered: string[] = [];
  const seen = new Set<string>();
  const unmatched: string[] = [];

  for (const raw of ai_stack) {
    const t = raw.trim();
    if (!t) continue;
    const canonical = lowerToCanonical.get(t.toLowerCase());
    if (canonical) {
      if (!seen.has(canonical)) {
        seen.add(canonical);
        ordered.push(canonical);
      }
    } else {
      unmatched.push(t);
    }
  }

  if (unmatched.length === 0) {
    return ordered;
  }

  let aiMatches: string[] = [];
  try {
    const ontologySubset = SKILL_ONTOLOGY.slice(0, 100);
    const userContent = `Tools to map: ${JSON.stringify(
      unmatched
    )}. Ontology: ${JSON.stringify(ontologySubset)}

Project title: ${title}
Problem solved: ${problem_solved}`;

    const client = getOpenAIClient();
    const res = await client.chat.completions.create({
      model: TAGGER_MODEL,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0.2,
    });

    const text = res.choices[0]?.message?.content?.trim() ?? "[]";
    const parsed = parseJsonArray(text);
    aiMatches = normalizeAiMatches(parsed, lowerToCanonical);
  } catch (e) {
    console.error("[autoTagSkills] OpenAI pass failed", e);
  }

  for (const tag of aiMatches) {
    if (!seen.has(tag)) {
      seen.add(tag);
      ordered.push(tag);
    }
  }

  return ordered;
}
