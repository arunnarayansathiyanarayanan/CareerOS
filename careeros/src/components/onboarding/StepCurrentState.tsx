"use client";

import { Check, ChevronDown } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useOnboardingStore } from "@/store/onboardingStore";

/** Curated common job titles in Indian tech (product, engineering, data, consulting, GTM). */
const INDIAN_TECH_TITLES: readonly string[] = [
  "Software Engineer",
  "Senior Software Engineer",
  "Staff Software Engineer",
  "Principal Software Engineer",
  "Lead Software Engineer",
  "Engineering Manager",
  "Senior Engineering Manager",
  "Director of Engineering",
  "VP Engineering",
  "CTO",
  "Tech Lead",
  "Team Lead",
  "Senior Tech Lead",
  "Frontend Developer",
  "Senior Frontend Developer",
  "React Developer",
  "UI Engineer",
  "Backend Developer",
  "Senior Backend Developer",
  "Java Developer",
  "Python Developer",
  "Node.js Developer",
  "Go Developer",
  "Full Stack Developer",
  "MERN Stack Developer",
  "MEAN Stack Developer",
  "Mobile Developer",
  "Android Developer",
  "iOS Developer",
  "Flutter Developer",
  "Kotlin Developer",
  "Swift Developer",
  "DevOps Engineer",
  "Senior DevOps Engineer",
  "Site Reliability Engineer",
  "Cloud Engineer",
  "AWS Solutions Architect",
  "Azure Cloud Engineer",
  "GCP Engineer",
  "Platform Engineer",
  "Infrastructure Engineer",
  "Kubernetes Engineer",
  "Security Engineer",
  "Application Security Engineer",
  "Network Engineer",
  "QA Engineer",
  "Senior QA Engineer",
  "SDET",
  "Test Lead",
  "Performance Engineer",
  "Database Administrator",
  "Data Engineer",
  "Senior Data Engineer",
  "ETL Developer",
  "Machine Learning Engineer",
  "Senior ML Engineer",
  "AI Engineer",
  "Applied Scientist",
  "Research Scientist",
  "NLP Engineer",
  "Computer Vision Engineer",
  "MLOps Engineer",
  "Blockchain Developer",
  "Solidity Developer",
  "Rust Developer",
  "C++ Developer",
  "Embedded Software Engineer",
  "Firmware Engineer",
  "Game Developer",
  "Solutions Engineer",
  "Forward Deployed Engineer",
  "Integration Engineer",
  "Release Engineer",
  "Build Engineer",
  "Systems Engineer",
  "AR/VR Developer",
  "Web3 Developer",
  "Smart Contract Developer",
  "Product Manager",
  "Senior Product Manager",
  "Staff Product Manager",
  "Principal Product Manager",
  "Group Product Manager",
  "Director of Product Management",
  "Senior Director of Product",
  "VP Product",
  "Chief Product Officer",
  "Associate Product Manager",
  "Technical Product Manager",
  "AI Product Manager",
  "Growth Product Manager",
  "Platform Product Manager",
  "API Product Manager",
  "Program Manager",
  "Senior Program Manager",
  "Technical Program Manager",
  "Delivery Manager",
  "Scrum Master",
  "Agile Coach",
  "UX Designer",
  "Senior UX Designer",
  "UI Designer",
  "Product Designer",
  "Senior Product Designer",
  "Design Lead",
  "Creative Director",
  "UX Researcher",
  "Content Designer",
  "Interaction Designer",
  "Data Scientist",
  "Senior Data Scientist",
  "Data Analyst",
  "Senior Data Analyst",
  "Business Analyst",
  "Senior Business Analyst",
  "Analytics Engineer",
  "Decision Scientist",
  "Risk Analyst",
  "Credit Analyst",
  "Management Consultant",
  "Senior Consultant",
  "IT Consultant",
  "Solutions Architect",
  "Senior Solutions Architect",
  "Presales Engineer",
  "Sales Engineer",
  "Enterprise Account Executive",
  "Account Manager",
  "Key Account Manager",
  "Business Development Manager",
  "Regional Sales Manager",
  "Sales Director",
  "Customer Success Manager",
  "Senior Customer Success Manager",
  "Customer Support Lead",
  "Operations Manager",
  "General Manager",
  "Chief of Staff",
  "Strategy Manager",
  "Technical Recruiter",
  "Engineering Recruiter",
  "HR Manager",
  "People Operations Manager",
  "Learning & Development Manager",
  "Financial Analyst",
  "Finance Manager",
  "FP&A Manager",
  "Product Marketing Manager",
  "Growth Marketer",
  "Digital Marketing Manager",
  "Performance Marketing Manager",
  "SEO Specialist",
  "Content Marketing Manager",
  "Social Media Manager",
  "Brand Manager",
  "Marketing Operations Manager",
  "Community Manager",
  "Developer Advocate",
  "Technical Writer",
  "Engineering Lead",
  "Engineering Director",
  "Head of Engineering",
  "Head of Product",
  "Head of Design",
  "Head of Data",
  "Head of Machine Learning",
  "Startup Founder",
  "Co-founder & CTO",
  "Co-founder & CEO",
  "Technology Analyst",
  "Systems Engineer Trainee",
  "Associate Consultant",
  "Senior Associate",
  "Module Lead",
  "Package Consultant",
  "Principal Consultant",
  "Business Technology Analyst",
  "Project Manager IT",
  "Service Delivery Manager",
  "L1 Support Engineer",
  "L2 Support Engineer",
  "NOC Engineer",
  "SOC Analyst",
  "Cybersecurity Analyst",
  "Product Owner",
  "Business Intelligence Developer",
  "Tableau Developer",
  "Power BI Developer",
  "Snowflake Developer",
  "Databricks Engineer",
  "GenAI Engineer",
  "LLM Engineer",
  "Prompt Engineer",
  "AI Researcher",
  "Robotics Software Engineer",
  "IoT Engineer",
  "Edge Computing Engineer",
  "Site Reliability Lead",
  "Engineering Lead Backend",
  "Engineering Lead Frontend",
];

const YEARS = [
  { value: "0-1", label: "0–1 yr" },
  { value: "1-3", label: "1–3 yrs" },
  { value: "3-7", label: "3–7 yrs" },
  { value: "7-12", label: "7–12 yrs" },
  { value: "12+", label: "12+ yrs" },
] as const;

const AI_FLUENCY = [
  {
    value: "not_started",
    title: "Haven't started yet",
    description: "I know I need to, haven't",
  },
  {
    value: "played_with_chatgpt",
    title: "Played with ChatGPT",
    description: "Use it occasionally, not systematically",
  },
  {
    value: "built_workflows",
    title: "Built AI workflows",
    description: "Automated tasks, built prompts, used APIs",
  },
  {
    value: "shipped_projects",
    title: "Shipped AI projects",
    description: "Deployed things others use",
  },
  {
    value: "working_in_ai",
    title: "Working in AI",
    description: "AI is my primary tool or domain",
  },
] as const;

function OperatorFieldLabel({ step, title }: { step: string; title: string }) {
  return (
    <p className="text-[0.68rem] font-medium tracking-[0.22em] text-zinc-500 uppercase">
      <span className="text-zinc-400">{step}</span>
      <span className="mx-1.5 font-normal text-zinc-600">/</span>
      <span className="text-zinc-300">{title}</span>
    </p>
  );
}

export function StepCurrentState({ onContinue }: { onContinue: () => void }) {
  const currentRole = useOnboardingStore((s) => s.currentRole);
  const yearsOfExperience = useOnboardingStore((s) => s.yearsOfExperience);
  const aiFluency = useOnboardingStore((s) => s.aiFluency);
  const setField = useOnboardingStore((s) => s.setField);

  const [roleOpen, setRoleOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLDivElement>(null);

  const query = (currentRole ?? "").trim();
  const queryLower = query.toLowerCase();

  const filteredTitles = React.useMemo(() => {
    if (!queryLower) return [...INDIAN_TECH_TITLES];
    return INDIAN_TECH_TITLES.filter((t) => t.toLowerCase().includes(queryLower));
  }, [queryLower]);

  const canContinue =
    query.length > 0 &&
    Boolean(yearsOfExperience) &&
    Boolean(aiFluency);

  const focusRoleInput = React.useCallback(() => {
    const el = anchorRef.current?.querySelector("input");
    if (el instanceof HTMLInputElement) el.focus();
  }, []);

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4">
        <OperatorFieldLabel step="01" title="Current role" />
        <Popover
          modal={false}
          open={roleOpen}
          onOpenChange={setRoleOpen}
        >
          <PopoverAnchor asChild>
            <div ref={anchorRef} className="relative w-full">
              <Input
                value={currentRole ?? ""}
                onChange={(e) => {
                  setField("currentRole", e.target.value);
                  setRoleOpen(true);
                }}
                onFocus={() => setRoleOpen(true)}
                placeholder="e.g. Product Manager at a B2B SaaS startup"
                maxLength={100}
                autoComplete="off"
                aria-expanded={roleOpen}
                aria-controls="current-role-suggestions"
                className="h-11 border-zinc-700 bg-zinc-900/80 pr-10 text-[0.9375rem] text-zinc-100 placeholder:text-zinc-600"
              />
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-500"
                aria-hidden
              />
            </div>
          </PopoverAnchor>
          <PopoverContent
            id="current-role-suggestions"
            align="start"
            sideOffset={6}
            className="w-[min(calc(100vw-2rem),var(--radix-popover-anchor-width,100%))] border-zinc-700 bg-zinc-950 p-0 text-zinc-100 shadow-xl ring-zinc-800"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <Command shouldFilter={false} className="bg-transparent">
              <CommandList className="max-h-64">
                <CommandEmpty className="py-8 text-zinc-500">
                  No title match — keep typing; any wording works.
                </CommandEmpty>
                <CommandGroup className="p-1.5 [&_[cmdk-group-heading]]:text-zinc-500">
                  {filteredTitles.map((title) => (
                    <CommandItem
                      key={title}
                      value={title}
                      onPointerDown={(e) => e.preventDefault()}
                      onSelect={() => {
                        setField("currentRole", title);
                        setRoleOpen(false);
                        requestAnimationFrame(() => focusRoleInput());
                      }}
                      className="cursor-pointer rounded-lg text-zinc-100 aria-selected:bg-zinc-800/90 aria-selected:text-[#E5FF47]"
                    >
                      {title}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

      <section className="flex flex-col gap-5">
        <OperatorFieldLabel step="02" title="Experience" />
        <div
          className="flex flex-wrap gap-2.5"
          role="radiogroup"
          aria-label="Years of experience"
        >
          {YEARS.map(({ value, label }) => {
            const selected = yearsOfExperience === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setField("yearsOfExperience", value)}
                className={cn(
                  "rounded-full border px-4 py-2.5 text-sm font-medium tracking-tight transition-[border-color,background-color,color,box-shadow] duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]",
                  selected
                    ? "border-[#E5FF47] bg-[#E5FF47] text-[#111] shadow-none focus-visible:ring-[#E5FF47]"
                    : "border-zinc-700 bg-zinc-900/40 text-zinc-200 hover:border-zinc-500 focus-visible:ring-zinc-500"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-800 to-transparent" />

      <section className="flex flex-col gap-5">
        <OperatorFieldLabel step="03" title="AI fluency" />
        <div
          className="flex flex-col gap-3.5"
          role="radiogroup"
          aria-label="AI fluency"
        >
          {AI_FLUENCY.map(({ value, title, description }) => {
            const selected = aiFluency === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setField("aiFluency", value)}
                className={cn(
                  "group relative flex w-full flex-col gap-1 rounded-xl border border-solid px-4 py-4 text-left transition-[border-color,box-shadow,background-color] duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A0A0A]",
                  selected
                    ? "border-[#E5FF47] bg-[#161616] shadow-[0_0_22px_rgba(229,255,71,0.12)] focus-visible:ring-[#E5FF47]"
                    : "border-zinc-800 bg-zinc-950/40 hover:border-zinc-600 focus-visible:ring-zinc-500"
                )}
              >
                {selected ? (
                  <span
                    className="absolute top-3 right-3 flex size-6 items-center justify-center rounded-full bg-[#E5FF47]/20 text-[#E5FF47]"
                    aria-hidden
                  >
                    <Check className="size-3.5 stroke-[2.5]" strokeLinecap="round" strokeLinejoin="round" />
                  </span>
                ) : null}
                <span
                  className={cn(
                    "pr-8 font-sans text-[0.9375rem] font-semibold tracking-tight",
                    selected ? "text-[#E5FF47]" : "text-zinc-100"
                  )}
                >
                  {title}
                </span>
                <span
                  className={cn(
                    "text-sm leading-snug",
                    selected ? "text-zinc-400" : "text-zinc-500 group-hover:text-zinc-400"
                  )}
                >
                  {description}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {canContinue ? (
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            className="h-9 w-full bg-[#E5FF47] text-sm font-medium text-[#111] transition-[opacity,transform,box-shadow] duration-200 ease-out hover:bg-[#d8f542] sm:min-w-[120px] sm:w-auto"
            onClick={() => void onContinue()}
          >
            Continue
          </Button>
        </div>
      ) : null}
    </div>
  );
}
