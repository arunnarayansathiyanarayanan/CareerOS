import type { RoadmapContent } from "@/lib/legacyRoadmapJson";
import type { RoadmapGenerationResult } from "@/types/roadmap";

function defaultChecklist() {
  return {
    deployedLink: false,
    githubRepo: false,
    loomDemo: false,
    writeUp: false,
  };
}

/** Maps legacy JSONB roadmap content into normalized generation rows. */
export function legacyContentToGenerationResult(
  content: RoadmapContent
): RoadmapGenerationResult {
  return {
    phases: content.phases.map((phase, phaseIndex) => ({
      name: phase.name,
      phaseOrder: phaseIndex + 1,
      items: phase.items.map((item, itemIndex) => {
        const base = {
          type: item.type,
          phase: phase.name,
          phaseOrder: phaseIndex + 1,
          itemOrder: itemIndex + 1,
          title: item.title,
          description: item.description,
          estimatedHours: item.estimatedHours,
          difficulty: item.difficulty,
          dependencies: [] as string[],
          status: item.status,
          userNote: null,
          externalLinks: [] as {
            label: string;
            url: string;
            type: "youtube" | "blog" | "docs";
          }[],
          proofOfWorkUrl: null,
          techStack: [] as string[],
          completionChecklist: defaultChecklist(),
          completedAt: null,
        };

        if (item.type === "concept") {
          return {
            ...base,
            completionChecklist: {},
            externalLinks: item.resources.map((r) => ({
              label: r.title,
              url: r.url,
              type: r.type,
            })),
          };
        }

        if (item.type === "project") {
          return {
            ...base,
            techStack: item.techStack,
            externalLinks: [],
          };
        }

        return { ...base, completionChecklist: {}, externalLinks: [] };
      }),
    })),
  };
}
