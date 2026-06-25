export const COMPETENCIES = [
  "Prioritization", "Stakeholder Mgmt", "Technical Depth", "Data & Metrics",
  "Influence", "Discovery", "GTM / Launch", "Conflict Resolution",
  "Strategy", "Ambiguity", "Execution",
] as const;

export const DOMAINS = [
  "Payments", "Platform / Infra", "AI / ML", "Marketplace",
  "Compliance", "Growth", "eCommerce",
] as const;

export const SITUATIONS = [
  "Launch", "Migration", "Incident", "Negotiation",
  "Optimization", "Pivot", "Cross-functional",
] as const;

export type UseCase = {
  id: string;
  user_id: string;
  created_at: string;
  occurred_on: string;
  title: string;
  raw: string | null;
  situation: string | null;
  task: string | null;
  action: string | null;
  result: string | null;
  metric: string | null;
  lesson: string | null;
  interview_angle: string | null;
  competencies: string[];
  domains: string[];
  situation_type: string | null;
};

// What the /api/structure route returns and what the draft editor edits.
export type Draft = {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  metric: string;
  lesson: string;
  interview_angle: string;
  competencies: string[];
  domains: string[];
  situation_type: string;
};
