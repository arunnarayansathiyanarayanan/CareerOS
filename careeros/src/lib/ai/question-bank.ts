export type InterviewProject = {
  name: string;
  stack: string[];
  outcome: string;
  description: string;
};

const SUB_MODE_LABELS: Record<string, Record<string, string>> = {
  ai_pm: {
    product_sense: "Product Sense (AI products)",
    ai_system_design: "AI System Design",
    ai_prioritization: "AI Prioritization & Roadmapping",
    ai_strategy_case: "AI Strategy Case",
    behavioral: "Behavioral (AI PM)",
  },
  ai_generalist: {
    ai_workflow_design: "AI Workflow Design",
    tool_selection: "AI Tool Selection",
    automation_case: "Automation Case Study",
    ai_ops_behavioral: "AI Ops & Behavioral",
    cross_functional_ai: "Cross-Functional AI Collaboration",
  },
};

const TRACK_FRAMING: Record<string, string> = {
  ai_pm:
    "You are conducting a mock interview for an AI Product Manager role. Focus on product judgment, user impact, AI feasibility, metrics, and stakeholder communication.",
  ai_generalist:
    "You are conducting a mock interview for an AI Generalist role. Focus on practical AI workflows, tool selection, automation design, operational rigor, and cross-functional execution.",
};

function formatProjects(projects: InterviewProject[]): string {
  if (projects.length === 0) {
    return "The candidate has not linked portfolio projects yet. Ask general questions and probe for concrete examples when they answer.";
  }

  return projects
    .map((project, index) => {
      const stack =
        project.stack.length > 0 ? project.stack.join(", ") : "not specified";
      return [
        `Project ${index + 1}: ${project.name}`,
        `  Stack: ${stack}`,
        `  Outcome: ${project.outcome}`,
        `  Description: ${project.description}`,
      ].join("\n");
    })
    .join("\n\n");
}

/**
 * Core system prompt for the live interview brain. Turn-level instructions are appended by interview-ai.
 */
export function buildInterviewSystemPrompt(
  track: string,
  subMode: string,
  projects: InterviewProject[]
): string {
  const trackFraming =
    TRACK_FRAMING[track] ??
    "You are conducting a mock interview for an AI-native professional role.";
  const subModeLabel =
    SUB_MODE_LABELS[track]?.[subMode] ?? subMode.replace(/_/g, " ");

  return `${trackFraming}

Interview sub-mode: ${subModeLabel} (${subMode}).

Candidate portfolio (reference by project name when relevant):
${formatProjects(projects)}

Conduct guidelines:
- Act as a senior interviewer at a top tech company. Be warm but rigorous.
- Ask exactly ONE clear question or statement at a time — never stack multiple questions.
- Probe follow-ups naturally based on the candidate's last answer (depth, tradeoffs, metrics, failure modes).
- When their portfolio is relevant, reference specific projects by name and tie questions to their stack and outcomes.
- Keep responses concise (2–4 sentences for setup, then one focused question).
- NEVER break character, mention OpenAI, or say you are an AI or language model.
- Do not provide coaching mid-interview; stay in interviewer mode until the session ends.`;
}
