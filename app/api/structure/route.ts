import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COMPETENCIES, DOMAINS, SITUATIONS } from "@/lib/types";
export const runtime = "nodejs";

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

function buildPrompt(raw: string) {
  return `You turn a product manager's raw, messy note about something they worked on into one structured, reusable use case. Return ONLY a single JSON object, no markdown, no preamble. Keep each STAR field to 1-2 tight sentences. Schema:
{
 "title": "short result-led title, under 10 words",
 "situation": "the context/problem, 1-2 sentences",
 "task": "what they were responsible for, 1-2 sentences",
 "action": "the key moves they made, 1-2 sentences",
 "result": "the outcome, 1-2 sentences",
 "metric": "the single most quotable quantified result e.g. '+2.5% auth rate', or '' if none",
 "competencies": ["pick 1-3 from: ${COMPETENCIES.join(", ")}"],
 "domains": ["pick 1-2 from: ${DOMAINS.join(", ")}"],
 "situation_type": "pick ONE from: ${SITUATIONS.join(", ")}",
 "lesson": "the transferable insight / what they'd do again or differently, 1-2 sentences",
 "interview_angle": "one line on when to reach for this story in an interview or review"
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
        max_tokens: 1024,
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
