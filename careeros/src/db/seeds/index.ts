import { seedSkillOntology } from "./skillOntology";

export async function runSeeds(): Promise<void> {
  const inserted = await seedSkillOntology();
  console.log(`skill_ontology: ${inserted} row(s) inserted`);
}

export { seedSkillOntology };
