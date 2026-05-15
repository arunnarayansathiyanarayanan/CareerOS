"use client";

import { ChevronDown } from "lucide-react";
import * as React from "react";

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
import { INDIAN_TECH_TITLES } from "@/data/indianTechTitles";
import { useOnboardingStore } from "@/store/onboardingStore";

type CurrentRoleAutocompleteFieldProps = {
  /** Placeholder passed through to the input (defaults match onboarding step 2 vs operator step). */
  placeholder?: string;
  /** Optional className for the input (page step uses simpler styling; operator step uses h-11 + pr-10). */
  inputClassName?: string;
  /** Radix combobox-style chevron; off for the main onboarding step to match the existing layout. */
  showChevron?: boolean;
};

export function CurrentRoleAutocompleteField({
  placeholder = "e.g. Product Manager at a B2B SaaS startup",
  inputClassName = "h-11 border-zinc-700 bg-zinc-900/80 pr-10 text-[0.9375rem] text-zinc-100 placeholder:text-zinc-600",
  showChevron = true,
}: CurrentRoleAutocompleteFieldProps) {
  const currentRole = useOnboardingStore((s) => s.currentRole);
  const setField = useOnboardingStore((s) => s.setField);

  const [roleOpen, setRoleOpen] = React.useState(false);
  const anchorRef = React.useRef<HTMLDivElement>(null);

  const query = (currentRole ?? "").trim();
  const queryLower = query.toLowerCase();

  const filteredTitles = React.useMemo(() => {
    if (!queryLower) return [...INDIAN_TECH_TITLES];
    return INDIAN_TECH_TITLES.filter((t) => t.toLowerCase().includes(queryLower));
  }, [queryLower]);

  const focusRoleInput = React.useCallback(() => {
    const el = anchorRef.current?.querySelector("input");
    if (el instanceof HTMLInputElement) el.focus();
  }, []);

  return (
    <Popover modal={false} open={roleOpen} onOpenChange={setRoleOpen}>
      <PopoverAnchor asChild>
        <div ref={anchorRef} className="relative w-full">
          <Input
            value={currentRole ?? ""}
            onChange={(e) => {
              setField("currentRole", e.target.value);
              setRoleOpen(true);
            }}
            onFocus={() => setRoleOpen(true)}
            placeholder={placeholder}
            maxLength={100}
            autoComplete="off"
            aria-expanded={roleOpen}
            aria-controls="current-role-suggestions"
            className={inputClassName}
          />
          {showChevron ? (
            <ChevronDown
              className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-500"
              aria-hidden
            />
          ) : null}
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
  );
}
