import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COMPETENCIES, DOMAINS, SITUATIONS } from "@/lib/types";
export const runtime = "nodejs";

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

function buildPrompt(raw: string) {
  return `You are helping a product manager structure their work notes into a STAR format story for use in interviews and performance reviews.

Convert the raw note below into a clean STAR story from a product management perspective. Only use information from the note — do not invent facts.

STAR format for product managers:
- Situation: the business or product context (what problem existed, what was at stake, what the team/org landscape was)
- Task: the PM's specific responsibility or ownership in this situation
- Action: what the PM did — focus on product thinking, stakeholder alignment, decisions made, trade-offs navigated, how they influenced without authority
- Result: the business or customer outcome that followed

Return ONLY a valid JSON object with no markdown, no code fences, no extra text.

{
  "title": "concise title under 10 words summarising what was achieved",
  "situation": "1-2 sentences on the business/product context and problem",
  "task": "1-2 sentences on what the PM was responsible for",
  "action": "2-3 sentences on the PM's key actions, decisions and how they worked with others",
  "result": "1-2 sentences on the outcome for the business, product or team",
  "metric": "the most concrete result — a number, percentage, or clear qualitative win. Use empty string if none.",
  "competencies": ["1-3 from: ${COMPETENCIES.join(", ")}"],
  "domains": ["1-2 from: ${DOMAINS.join(", ")}"],
  "situation_type": "exactly one from: ${SITUATIONS.join(", ")}",
  "lesson": "1 sentence on the transferable insight from this situation",
  "interview_angle": "1 sentence on what interview question this story best answers"
}

Raw note:
"""${raw}"""`;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "Server missing GROQ_API_KEY" }, { status: 500 });
  }

  const { raw } = await request.json().catch(() => ({ raw: "" }));
  if (!raw || !raw.trim()) {
    return NextResponse.json({ error: "Empty note" }, { status: 400 });
  }

  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: buildPrompt(raw.trim()) }],
        max_tokens: 2048,
        temperature: 0.4,
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return NextResponse.json({ error: `Model call failed (${r.status}): ${detail}` }, { status: 502 });
    }

    const data = await r.json();
    const text = data.choices?.[0]?.message?.content || "";

    const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = clean.indexOf("{");
    const end = clean.lastIndexOf("}");
    const obj = JSON.parse(clean.slice(start, end + 1));

    return NextResponse.json({
      title: obj.title || "Untitled use case",
      situation: obj.situation || "",
      task: obj.task || "",
      action: obj.action || "",
      result: obj.result || "",
      metric: obj.metric || "",
      lesson: obj.lesson || "",
      interview_angle: obj.interview_angle || "",
      competencies: Array.isArray(obj.competencies) ? obj.competencies : [],
      domains: Array.isArray(obj.domains) ? obj.domains : [],
      situation_type: obj.situation_type || "",
    });
  } catch (e: any) {
    console.error("Structure error:", e?.message || e);
    return NextResponse.json(
      { error: `Parse error: ${e?.message || "unknown"}` },
      { status: 502 }
    );
  }
}
