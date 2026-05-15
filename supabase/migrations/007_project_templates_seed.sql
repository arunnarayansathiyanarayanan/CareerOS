-- Starter project templates for the builder (role-filtered via `target_roles`).

INSERT INTO public.project_templates (
  id,
  title,
  description,
  problem_statement,
  recommended_stack,
  success_criteria,
  completion_checklist,
  target_roles
)
VALUES
  (
    'a1b2c3d4-0001-4000-8000-000000000001'::uuid,
    'RAG over internal docs',
    'Search and answer questions over your team''s Notion, PDFs, or wiki using retrieval and citations.',
    'Internal stakeholders waste time hunting for answers across scattered documents, Slack threads, and wikis. Support and GTM teams repeat the same questions because there is no single trusted place to query. You need a retrieval system with source citations, access controls, and measurable answer quality so people actually adopt it instead of defaulting to shoulder-taps.',
    ARRAY[
      'RAG'::text,
      'pgvector'::text,
      'PostgreSQL'::text,
      'Python'::text,
      'OpenAI API'::text,
      'Embeddings'::text
    ],
    'Cut median time-to-answer for top 20 internal questions by 40%, with cited sources on every response and documented eval set for regressions.',
    '[
      {"label": "Ingest pipeline for at least one real doc source", "required": true},
      {"label": "Eval questions with expected citations", "required": false}
    ]'::jsonb,
    ARRAY[
      'ai_engineer'::text,
      'ai_product_manager'::text,
      'ai_operator'::text,
      'ai_generalist'::text,
      'other'::text
    ]
  ),
  (
    'a1b2c3d4-0002-4000-8000-000000000002'::uuid,
    'Copilot UI in your product',
    'Add an assistant pane that calls your backend with streaming responses and grounded context.',
    'Users abandon core workflows because help content is generic and onboarding is brittle. Teams want an in-context assistant that explains features, drafts copy, or suggests next steps without leaving the product. The problem is stitching auth, prompts, telemetry, and safe fallbacks so the copilot feels fast, trustworthy, and easy to iterate in production.',
    ARRAY[
      'Next.js'::text,
      'TypeScript'::text,
      'Vercel AI SDK'::text,
      'OpenAI API'::text,
      'Prompt Engineering'::text
    ],
    'Ship to a pilot cohort with positive qualitative feedback and <3s perceived time-to-first-token on key screens.',
    '[
      {"label": "Authenticated streaming route with rate limits", "required": true},
      {"label": "Basic analytics on prompts and thumbs up/down", "required": false}
    ]'::jsonb,
    ARRAY[
      'ai_product_manager'::text,
      'ai_engineer'::text,
      'ai_generalist'::text,
      'other'::text
    ]
  ),
  (
    'a1b2c3d4-0003-4000-8000-000000000003'::uuid,
    'API microservice with tool calling',
    'Small FastAPI (or similar) service that exposes an LLM with structured outputs and guarded tools.',
    'Engineers prototype scripts in notebooks, but production needs stable schemas, retries, and observability. The business wants reliable JSON or tool calls instead of brittle string parsing. You are solving how to expose a narrow set of capabilities (search, ticketing, calculators) behind an LLM with validation, timeouts, and clear failure modes operators can debug.',
    ARRAY[
      'FastAPI'::text,
      'Python'::text,
      'OpenAI API'::text,
      'Function Calling'::text,
      'Anthropic Claude'::text
    ],
    'p99 latency under agreed SLO with zero silent tool failures in integration tests.',
    '[
      {"label": "OpenAPI or schema-validated outputs", "required": true},
      {"label": "Structured logging and trace IDs", "required": false}
    ]'::jsonb,
    ARRAY['ai_engineer'::text, 'ai_generalist'::text, 'other'::text]
  ),
  (
    'a1b2c3d4-0004-4000-8000-000000000004'::uuid,
    'Marketing content repurposing pipeline',
    'Turn one long asset (webinar, post, memo) into channel-specific drafts with tone control.',
    'Marketing cannot keep pace with channels when every derivative post is rewritten from scratch. Leadership wants consistency of messaging while allowing LinkedIn vs email vs landing variants. The bottleneck is manual editing, unclear brand constraints, and no workflow to approve AI drafts safely before publish.',
    ARRAY[
      'Prompt Engineering'::text,
      'OpenAI API'::text,
      'n8n'::text,
      'AI Workflow Automation'::text
    ],
    'Produce approved variants for ≥3 channels from a single source doc with documented style guide adherence.',
    '[
      {"label": "Human-in-the-loop approval step", "required": true},
      {"label": "Brand voice snippets in system prompt", "required": false}
    ]'::jsonb,
    ARRAY[
      'ai_marketer'::text,
      'ai_native_founder'::text,
      'ai_generalist'::text,
      'other'::text
    ]
  ),
  (
    'a1b2c3d4-0005-4000-8000-000000000005'::uuid,
    'Ops intake and triage assistant',
    'Classify incoming requests, draft first responses, or route tickets using rules plus an LLM.',
    'Operations teams drown in repetitive tickets and unclear prioritization. SLAs slip because triage is manual and context is missing from forms. You need automation that suggests categories, pulls relevant policy snippets, and routes work without removing human approval for edge cases.',
    ARRAY[
      'n8n'::text,
      'Zapier'::text,
      'AI Workflow Automation'::text,
      'OpenAI API'::text
    ],
    'Reduce average first-response time on top ticket types by 25% with audit log of model suggestions.',
    '[
      {"label": "Escalation path when confidence is low", "required": true},
      {"label": "Playbook snippets linked per category", "required": false}
    ]'::jsonb,
    ARRAY['ai_operator'::text, 'ai_generalist'::text, 'other'::text]
  ),
  (
    'a1b2c3d4-0006-4000-8000-000000000006'::uuid,
    'Founder discovery concierge',
    'Conversational landing experience that captures ICP, pain, and books a call or waitlist.',
    'Early-stage teams struggle to qualify inbound consistently; forms are stale and demos are expensive. You want a lightweight chat that qualifies visitors with follow-ups and summarizes leads for founders. Constraints include hallucination guardrails on pricing claims and a crisp hand-off to CRM or email.',
    ARRAY[
      'Next.js'::text,
      'Vercel AI SDK'::text,
      'Supabase'::text,
      'Prompt Engineering'::text
    ],
    'Improve qualified lead capture rate versus static form baseline in a measured A/B.',
    '[
      {"label": "Summarized lead payloads to email or webhook", "required": true},
      {"label": "Explicit bot disclosure and privacy note", "required": false}
    ]'::jsonb,
    ARRAY[
      'ai_native_founder'::text,
      'ai_marketer'::text,
      'ai_product_manager'::text,
      'ai_generalist'::text,
      'other'::text
    ]
  ),
  (
    'a1b2c3d4-0007-4000-8000-000000000007'::uuid,
    'Multi-step agent workflow',
    'Planner agent that delegates subtasks (research, summarize, critique) with checkpoints.',
    'Single-shot prompts fail when tasks need decomposition, retries, or specialist checks. Teams building agents hit unclear state, runaway loops, and silent partial failures. This project showcases a routed workflow with clear steps, budgets, and a final verifier so outputs are repeatable enough to demo.',
    ARRAY[
      'LangGraph'::text,
      'AI Agents'::text,
      'Python'::text,
      'OpenAI API'::text,
      'Prompt Engineering'::text
    ],
    'End-to-end demo on fixed scenario with scripted success criteria and recorded failure traces.',
    '[
      {"label": "Budget on tokens or steps enforced", "required": true},
      {"label": "Human-readable trace of intermediate steps", "required": false}
    ]'::jsonb,
    ARRAY[
      'ai_engineer'::text,
      'ai_product_manager'::text,
      'ai_generalist'::text,
      'other'::text
    ]
  ),
  (
    'a1b2c3d4-0008-4000-8000-000000000008'::uuid,
    'General — ship an AI portfolio piece',
    'Flexible template: pick a narrow problem, show before/after, and link a repo or demo.',
    'Recruiters and hiring managers need proof you can frame a problem, choose stack, and ship. Many candidates list buzzwords without a crisp narrative. You are documenting a real or realistic project with problem context, your role, trade-offs, metrics, and artifacts so reviewers can verify depth quickly.',
    ARRAY[
      'Prompt Engineering'::text,
      'OpenAI API'::text,
      'Next.js'::text,
      'Python'::text
    ],
    'Publish a page with a clear outcome statement and at least one verifiable artifact (demo, recording, or repo).',
    '[
      {"label": "Problem / role / outcome filled in your voice", "required": true},
      {"label": "Embed or link to evidence", "required": false}
    ]'::jsonb,
    ARRAY[
      'ai_product_manager'::text,
      'ai_generalist'::text,
      'ai_engineer'::text,
      'ai_marketer'::text,
      'ai_operator'::text,
      'ai_native_founder'::text,
      'other'::text
    ]
  )
ON CONFLICT (id) DO NOTHING;
