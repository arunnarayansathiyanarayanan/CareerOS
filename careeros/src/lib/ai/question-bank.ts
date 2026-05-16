export type Track = "ai_pm" | "ai_generalist";

export type SubMode =
  | "product_sense"
  | "ai_system_design"
  | "ai_prioritization"
  | "ai_strategy_case"
  | "behavioral"
  | "ai_workflow_design"
  | "tool_selection"
  | "automation_case"
  | "ai_ops_behavioral"
  | "cross_functional_ai";

export type InterviewProject = {
  name: string;
  stack: string[];
  outcome: string;
  description: string;
};

type SubModeConfig = {
  roleFrame?: string;
  openingQuestions: readonly string[];
  followUpInstruction: string;
};

export const TURNS_BY_SUB_MODE: Record<SubMode, number> = {
  product_sense: 8,
  ai_system_design: 7,
  ai_prioritization: 7,
  ai_strategy_case: 8,
  behavioral: 6,
  ai_workflow_design: 8,
  tool_selection: 7,
  automation_case: 8,
  ai_ops_behavioral: 6,
  cross_functional_ai: 7,
};

export const TRACK_FOR_SUB_MODE: Record<SubMode, Track> = {
  product_sense: "ai_pm",
  ai_system_design: "ai_pm",
  ai_prioritization: "ai_pm",
  ai_strategy_case: "ai_pm",
  behavioral: "ai_pm",
  ai_workflow_design: "ai_generalist",
  tool_selection: "ai_generalist",
  automation_case: "ai_generalist",
  ai_ops_behavioral: "ai_generalist",
  cross_functional_ai: "ai_generalist",
};

const SUB_MODES_BY_TRACK: Record<Track, readonly SubMode[]> = {
  ai_pm: [
    "product_sense",
    "ai_system_design",
    "ai_prioritization",
    "ai_strategy_case",
    "behavioral",
  ],
  ai_generalist: [
    "ai_workflow_design",
    "tool_selection",
    "automation_case",
    "ai_ops_behavioral",
    "cross_functional_ai",
  ],
};

const TRACK_DEFAULT_ROLE_FRAME: Record<Track, string> = {
  ai_pm:
    "You are a senior interviewer at an AI-first company conducting a mock AI Product Manager interview.",
  ai_generalist:
    "You are a senior interviewer evaluating practical AI execution and workflow design skills.",
};

const SUB_MODE_CONFIG: Record<SubMode, SubModeConfig> = {
  product_sense: {
    roleFrame:
      "You are a Staff PM at an AI-first company conducting a product sense interview.",
    openingQuestions: [
      "Walk me through how you'd design an AI-powered feature for a B2B SaaS tool that helps sales teams prioritize leads. Start with the problem.",
      "Spotify wants to add an AI-native feature to increase podcast discovery. How would you think about this?",
      "Your PM at a fintech startup. How would you decide whether to build an AI expense categorization feature or improve the existing rule-based one?",
    ],
    followUpInstruction:
      "Probe on user segmentation, metrics definition, AI-specific tradeoffs (hallucination, latency, trust), and prioritization logic.",
  },
  ai_system_design: {
    roleFrame:
      "You are a Principal PM running an AI system design interview.",
    openingQuestions: [
      "Design the ML data pipeline for a recommendation system that personalizes the LinkedIn feed for Indian professionals.",
      "How would you design a real-time fraud detection system for a UPI payment app?",
      "Walk me through designing an AI content moderation system for a 50M-user platform.",
    ],
    followUpInstruction:
      "Dig into data freshness, model serving latency, feedback loops, fallback strategies, and monitoring.",
  },
  ai_prioritization: {
    openingQuestions: [
      "You have 3 AI features competing for your Q3 roadmap: a generative search bar, an AI email drafter, and a smart notification system. You have one ML engineer. Walk me through how you prioritize.",
      "Your AI feature launched and metrics are split — engagement up 15%, support tickets up 30%. What do you do?",
    ],
    followUpInstruction:
      "Push on frameworks used, data they'd look at, how they handle stakeholder conflict, and how they'd quantify AI-specific risk.",
  },
  ai_strategy_case: {
    openingQuestions: [
      "A traditional HR software company wants to add AI. You're the CPO. What's your 12-month AI strategy?",
      "Zomato wants to build an AI-native B2B product for restaurant operations. Where do you start?",
    ],
    followUpInstruction:
      "Challenge on build vs buy, moat creation, go-to-market sequence, and defensibility.",
  },
  behavioral: {
    openingQuestions: [
      "Tell me about a time you shipped an AI feature that didn't work as expected. What did you do?",
      "Walk me through a product decision you made using AI-generated insights. What was the outcome?",
    ],
    followUpInstruction:
      "Use STAR. Push for specifics on their personal contribution, what they'd do differently, and what the AI element specifically changed.",
  },
  ai_workflow_design: {
    roleFrame:
      "You are a Head of AI Ops interviewing for an AI Workflow Designer role.",
    openingQuestions: [
      "Design an AI workflow that reduces manual effort for a 10-person marketing team producing weekly campaign reports.",
      "A legal team wants to automate contract review using AI. Walk me through how you'd design this workflow end-to-end.",
    ],
    followUpInstruction:
      "Probe on tool selection, error handling, human-in-the-loop design, and iteration.",
  },
  tool_selection: {
    openingQuestions: [
      "You need to build a RAG-based internal knowledge base for a 200-person company. Walk me through your tool and architecture choices.",
      "Compare LangChain vs building direct API calls for an AI agent. When would you choose each?",
    ],
    followUpInstruction:
      "Challenge on cost, latency, maintainability, vendor lock-in, and their experience with each.",
  },
  automation_case: {
    openingQuestions: [
      "A client wants to automate their customer onboarding emails using AI. Scope and design the solution.",
      "Design a workflow that monitors 50 competitor websites and generates a weekly competitive intel briefing.",
    ],
    followUpInstruction:
      "Push on edge cases, reliability, monitoring, and how they'd demo/deliver to a non-technical stakeholder.",
  },
  ai_ops_behavioral: {
    openingQuestions: [
      "Tell me about an AI workflow you built that broke in production. How did you debug and fix it?",
      "Describe the most complex AI automation you've shipped. What would you redesign?",
    ],
    followUpInstruction:
      "Probe on specific tools, their debugging process, how they communicated failures, and lessons learned.",
  },
  cross_functional_ai: {
    openingQuestions: [
      "You've identified an AI solution that would save 20 hours/week for the ops team, but the CTO is skeptical. How do you get buy-in?",
      "How would you explain a hallucination problem with an AI tool to a non-technical executive who wants to ship it immediately?",
    ],
    followUpInstruction:
      "Evaluate clarity of communication, empathy, and ability to translate technical constraints into business language.",
  },
};

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function formatProjects(projects: InterviewProject[]): string {
  if (projects.length === 0) {
    return "The candidate has not linked published projects yet. Ask for concrete examples when answers stay abstract.";
  }

  const lines = projects.map((project) => {
    const stack =
      project.stack.length > 0 ? project.stack.join(", ") : "not specified";
    return `- ${project.name} (stack: ${stack}; outcome: ${project.outcome}; ${project.description})`;
  });

  return `The candidate has these published projects:\n${lines.join("\n")}\nReference them by name in follow-up questions when relevant.`;
}

export function getOpeningQuestion(subMode: SubMode): string {
  return pickRandom(SUB_MODE_CONFIG[subMode].openingQuestions);
}

export function buildSystemPrompt(
  subMode: SubMode,
  projects: InterviewProject[],
  turnNumber: number,
  totalTurns: number
): string {
  const config = SUB_MODE_CONFIG[subMode];
  const track = TRACK_FOR_SUB_MODE[subMode];
  const roleFrame = config.roleFrame ?? TRACK_DEFAULT_ROLE_FRAME[track];

  const progress =
    turnNumber === totalTurns
      ? `This is turn ${turnNumber} of ${totalTurns}. This is the final turn — wrap up with exactly: "That's all the questions I have — thank you for your time." Do not ask another substantive question.`
      : `This is turn ${turnNumber} of ${totalTurns}.`;

  const openingNote =
    turnNumber === 1
      ? `\nOpening question for this session (deliver after a brief welcome; use this question verbatim unless the candidate already answered it):\n"${getOpeningQuestion(subMode)}"`
      : "";

  return `${roleFrame}

${formatProjects(projects)}

${progress}${openingNote}

Interview rules:
- Ask exactly ONE question per turn. Never stack multiple questions.
- Do not explain that you are an AI or break interviewer character.
- Probe naturally based on the candidate's last answer; generate follow-ups dynamically (do not read from a fixed question list).
- ${config.followUpInstruction}
- Keep each turn concise: brief setup if needed, then one focused question.

Scoring context (evaluate mentally each turn; do not share scores during the interview):
Structure, Clarity, AI Depth, Tradeoffs, Communication.`;
}

export function validateSubMode(
  track: Track,
  subMode: string
): subMode is SubMode {
  return (SUB_MODES_BY_TRACK[track] as readonly string[]).includes(subMode);
}
