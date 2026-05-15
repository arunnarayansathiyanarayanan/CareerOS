/**
 * Canonical skill labels for `projects.ai_stack`. Re-exported from `src/constants/skill-ontology.ts`.
 */
import { SKILL_ONTOLOGY } from "@/constants/skill-ontology";

export { SKILL_ONTOLOGY };

export type SkillOntologyValue = (typeof SKILL_ONTOLOGY)[number];

const skillSet = new Set<string>(SKILL_ONTOLOGY);

export function isSkillOntologyValue(v: string): v is SkillOntologyValue {
  return skillSet.has(v);
}
