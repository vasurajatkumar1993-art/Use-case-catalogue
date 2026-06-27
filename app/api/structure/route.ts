import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { COMPETENCIES, DOMAINS, SITUATIONS } from "@/lib/types";
export const runtime = "nodejs";

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

function buildPrompt(raw: string) {
  return `You are an expert career coach helping a senior product manager document their work as reusable STAR stories for interviews, performance reviews, and portfolio use.

Your job: take a raw, unstructured note and extract ONE polished use case in strict JSON format.

Rules:
- Write in first person ("I led...", "I identified...", "I partnered with...")
- Be specific and concrete — use the details from the note, don't invent facts
- Each STAR field must be 1-2 tight, punchy sentences — no padding
- The title must lead with the RESULT or IMPACT, not the activity (e.g. "Unblocked Stakeholder Validation by Exposing Prod vs Dev Mismatch" not "Triaged Engineer Concerns")
- The metric should be the single most quotable number or outcome — use exact figures if present, or a clear qualitative outcome if not
- lesson and interview_angle should be genuinely insightful — what a senior PM would say in a debrief, not generic platitudes

Return ONLY a valid JSON object, no markdown fences, no explanation, no preamble.

Schema:
{
  "title": "result-led title under 10 words",
  "situation": "what was the context, problem, or pressure the PM was operating in",
  "task": "what they were specifically accountable for in this situation",
  "action": "the concrete steps they took — what they did, how, with whom",
  "result": "what changed as a direct result of their actions",
  "metric": "the single most quotable outcome — number, %, time saved, or clear qualitative win. Empty string if none.",
  "competencies": ["1-3 from: ${COMPETENCIES.join(", ")}"],
  "domains": ["1-2 from: ${DOMAINS.join(", ")}"],
  "situation_type": "exactly one from: ${SITUATIONS.join(", ")}",
  "lesson": "the transferable principle — what they learned or would do again in similar situations",
  "interview_angle": "one line: which interview question or review context this story answers best"
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
        temperature: 0.3,
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
