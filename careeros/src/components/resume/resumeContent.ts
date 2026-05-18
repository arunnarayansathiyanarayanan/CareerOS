import type {
  GeneratedVariantContent,
  SectionName,
} from "@/lib/resume/types";

export function sectionTextFromContent(
  sectionName: SectionName,
  content: GeneratedVariantContent
): string {
  switch (sectionName) {
    case "SUMMARY":
      return content.summary?.trim() ?? "";
    case "SKILLS":
      return content.skills.join(", ");
    case "EXPERIENCE":
      return content.experience
        .map(
          (exp) =>
            `${exp.title} · ${exp.company} (${exp.duration})\n${exp.bullets.map((b) => `• ${b}`).join("\n")}`
        )
        .join("\n\n");
    case "PROJECTS":
      return content.projects
        .map(
          (p) =>
            `${p.name}\n${p.description}\nStack: ${p.stack.join(", ")}${p.outcome ? `\nOutcome: ${p.outcome}` : ""}`
        )
        .join("\n\n");
    case "EDUCATION":
      return content.education
        .map(
          (e) =>
            `${e.degree}, ${e.institution}${e.year ? ` (${e.year})` : ""}`
        )
        .join("\n");
    case "CERTIFICATIONS":
      return content.certifications
        .map(
          (c) =>
            `${c.name}${c.issuer ? ` — ${c.issuer}` : ""}${c.year ? ` (${c.year})` : ""}`
        )
        .join("\n");
    default:
      return "";
  }
}
