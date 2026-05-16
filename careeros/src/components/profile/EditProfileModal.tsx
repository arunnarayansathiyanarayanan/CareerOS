"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangleIcon,
  GripVerticalIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { Profile } from "@/db/schema/profile";
import { PROFILE_AVAILABILITY_LABELS } from "@/lib/profileDisplay";
import {
  editProfileFormSchema,
  type EditProfileFormValues,
  PROFILE_LOCATION_SUGGESTIONS,
  PROFILE_VISIBILITY_OPTIONS,
} from "@/lib/validators/profile";
import type { ProfilePublicDTO } from "@/server/routers/profile";
import type { ProjectListMineItem } from "@/server/routers/project";
import { trpc } from "@/trpc/react";
import { cn } from "@/lib/utils";

const AVAILABILITY_OPTIONS = [
  { value: "OPEN_TO_ROLES" as const, label: PROFILE_AVAILABILITY_LABELS.OPEN_TO_ROLES },
  {
    value: "OPEN_TO_COLLABS" as const,
    label: PROFILE_AVAILABILITY_LABELS.OPEN_TO_COLLABS,
  },
  { value: "HEADS_DOWN" as const, label: PROFILE_AVAILABILITY_LABELS.HEADS_DOWN },
];

const MAX_PINNED = 5;

function toFormValues(profile: ProfilePublicDTO): EditProfileFormValues {
  return {
    headline: profile.headline ?? "",
    availabilityStatus:
      profile.availabilityStatus as Profile["availabilityStatus"],
    visibility: profile.visibility,
    location: profile.location ?? "",
    pinnedProjectIds: profile.pinnedProjects.map((p) => p.id),
    interviewReadinessPublic: profile.interviewReadinessPublic,
  };
}

function normalizeSubmitValues(values: EditProfileFormValues) {
  const headline = values.headline.trim();
  const location = values.location.trim();
  return {
    headline: headline.length > 0 ? headline : null,
    availabilityStatus: values.availabilityStatus,
    visibility: values.visibility,
    location: location.length > 0 ? location : null,
    pinnedProjectIds: values.pinnedProjectIds,
    interviewReadinessPublic: values.interviewReadinessPublic,
  };
}

function SortablePinnedRow({
  project,
  onRemove,
}: {
  project: ProjectListMineItem;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: project.id });

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        "flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 px-2 py-2",
        isDragging && "opacity-60 ring-1 ring-indigo-500/50"
      )}
    >
      <button
        type="button"
        className="touch-none rounded p-1 text-zinc-500 hover:text-zinc-300"
        aria-label={`Reorder ${project.title}`}
        {...attributes}
        {...listeners}
      >
        <GripVerticalIcon className="h-4 w-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-100">{project.title}</p>
        <p className="truncate text-xs text-zinc-500">{project.oneLiner}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="shrink-0 text-zinc-500 hover:text-zinc-200"
        aria-label={`Remove ${project.title} from pinned`}
        onClick={onRemove}
      >
        <XIcon className="h-4 w-4" />
      </Button>
    </li>
  );
}

function LocationAutocomplete({
  value,
  onChange,
  id,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
}: {
  value: string;
  onChange: (next: string) => void;
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const query = value.trim().toLowerCase();
  const suggestions = PROFILE_LOCATION_SUGGESTIONS.filter((city) =>
    query.length === 0 ? true : city.toLowerCase().includes(query)
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Bengaluru, Remote, …"
          maxLength={100}
          className="border-zinc-700 bg-zinc-900/50"
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls="location-suggestions"
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
        />
      </PopoverTrigger>
      <PopoverContent
        id="location-suggestions"
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandEmpty>Type a city or pick a suggestion.</CommandEmpty>
            <CommandGroup>
              {suggestions.map((city) => (
                <CommandItem
                  key={city}
                  value={city}
                  onSelect={() => {
                    onChange(city);
                    setOpen(false);
                  }}
                >
                  {city}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function PinnedProjectsField({
  projects,
  loading,
  pinnedIds,
  onChange,
}: {
  projects: ProjectListMineItem[];
  loading: boolean;
  pinnedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const byId = React.useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );

  const pinnedProjects = pinnedIds
    .map((id) => byId.get(id))
    .filter((p): p is ProjectListMineItem => Boolean(p));

  const unpinned = projects.filter((p) => !pinnedIds.includes(p.id));

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = pinnedIds.indexOf(String(active.id));
    const newIndex = pinnedIds.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    onChange(arrayMove(pinnedIds, oldIndex, newIndex));
  }

  function addProject(id: string) {
    if (pinnedIds.includes(id) || pinnedIds.length >= MAX_PINNED) return;
    onChange([...pinnedIds, id]);
  }

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {pinnedProjects.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Pin up to {MAX_PINNED} published projects. Drag to reorder.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={pinnedIds}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-2" role="list">
              {pinnedProjects.map((project) => (
                <SortablePinnedRow
                  key={project.id}
                  project={project}
                  onRemove={() =>
                    onChange(pinnedIds.filter((id) => id !== project.id))
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {pinnedIds.length < MAX_PINNED && unpinned.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Add project
          </p>
          <ul className="max-h-40 space-y-1 overflow-y-auto" role="list">
            {unpinned.map((project) => (
              <li key={project.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 rounded-lg border border-transparent px-2 py-2 text-left hover:border-zinc-700 hover:bg-zinc-900/60"
                  onClick={() => addProject(project.id)}
                >
                  <PlusIcon className="h-4 w-4 shrink-0 text-indigo-400" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-200">
                      {project.title}
                    </span>
                    <span className="block truncate text-xs text-zinc-500">
                      {project.oneLiner}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-zinc-500">
        {pinnedIds.length}/{MAX_PINNED} pinned
      </p>
    </div>
  );
}

export function EditProfileModal({ profile }: { profile: ProfilePublicDTO }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const initialRef = React.useRef(toFormValues(profile));

  const form = useForm<EditProfileFormValues>({
    resolver: zodResolver(editProfileFormSchema),
    defaultValues: toFormValues(profile),
  });

  const utils = trpc.useUtils();

  const projectsQuery = trpc.project.listMine.useQuery(undefined, {
    enabled: open,
  });

  const updateMutation = trpc.profile.updateProfile.useMutation({
    onMutate: async (input) => {
      await utils.profile.getByUsername.cancel({
        username: profile.username,
      });
      const previous = utils.profile.getByUsername.getData({
        username: profile.username,
      });
      if (previous) {
        utils.profile.getByUsername.setData(
          { username: profile.username },
          {
            ...previous,
            headline: input.headline !== undefined ? input.headline : previous.headline,
            availabilityStatus:
              input.availabilityStatus ?? previous.availabilityStatus,
            visibility: input.visibility ?? previous.visibility,
            location: input.location !== undefined ? input.location : previous.location,
            interviewReadinessPublic:
              input.interviewReadinessPublic ?? previous.interviewReadinessPublic,
          }
        );
      }
      return { previous };
    },
    onError: (_err, _input, context) => {
      if (context?.previous) {
        utils.profile.getByUsername.setData(
          { username: profile.username },
          context.previous
        );
      }
      form.reset(initialRef.current);
      toast.error("Could not save profile", {
        description: "Your changes were reverted. Please try again.",
      });
    },
    onSuccess: () => {
      toast.success("Profile updated");
      initialRef.current = form.getValues();
      setOpen(false);
      router.refresh();
    },
    onSettled: () => {
      void utils.profile.getByUsername.invalidate({ username: profile.username });
    },
  });

  React.useEffect(() => {
    if (open) {
      const values = toFormValues(profile);
      initialRef.current = values;
      form.reset(values);
    }
  }, [open, profile, form]);

  const visibilityValue = form.watch("visibility");
  const isDirty = form.formState.isDirty;
  const isSubmitting = updateMutation.isPending;

  function onSubmit(values: EditProfileFormValues) {
    const payload = normalizeSubmitValues(values);
    initialRef.current = values;
    updateMutation.mutate(payload);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-indigo-600 shadow-lg hover:bg-indigo-500">
          <PencilIcon className="mr-2 h-4 w-4" aria-hidden />
          Edit profile
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-h-[min(90vh,720px)] overflow-y-auto border-zinc-800 bg-zinc-950 text-zinc-100 sm:max-w-lg"
        onEscapeKeyDown={() => setOpen(false)}
      >
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Update how recruiters see you on CareerOS.
          </DialogDescription>
          {isDirty ? (
            <p
              className="text-xs font-medium text-amber-400"
              role="status"
              aria-live="polite"
            >
              Unsaved changes
            </p>
          ) : null}
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="grid gap-5"
            noValidate
          >
            <FormField
              control={form.control}
              name="headline"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Headline</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      maxLength={160}
                      placeholder="What you build and who you help"
                      className="border-zinc-700 bg-zinc-900/50"
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <div className="flex items-center justify-between gap-2">
                    <FormMessage />
                    <span className="text-xs text-zinc-500" aria-live="polite">
                      {(field.value ?? "").length}/160
                    </span>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="availabilityStatus"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Availability</FormLabel>
                  <FormControl>
                    <RadioGroup
                      value={field.value}
                      onValueChange={field.onChange}
                      className="gap-3"
                    >
                      {AVAILABILITY_OPTIONS.map((opt) => (
                        <div key={opt.value} className="flex items-center gap-2">
                          <RadioGroupItem
                            value={opt.value}
                            id={`availability-${opt.value}`}
                          />
                          <Label
                            htmlFor={`availability-${opt.value}`}
                            className="cursor-pointer font-normal text-zinc-200"
                          >
                            {opt.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <LocationAutocomplete
                      value={field.value ?? ""}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormDescription>
                    Top Indian cities or type your own (max 100 characters).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visibility</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full border-zinc-700 bg-zinc-900/50">
                        <SelectValue placeholder="Choose visibility" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PROFILE_VISIBILITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {visibilityValue === "ANONYMOUS" ? (
                    <p
                      className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
                      role="alert"
                    >
                      <AlertTriangleIcon
                        className="mt-0.5 h-4 w-4 shrink-0"
                        aria-hidden
                      />
                      Your public URL will return 404 to visitors
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="interviewReadinessPublic"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(checked) =>
                        field.onChange(checked === true)
                      }
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="text-zinc-200">
                      Show interview readiness on public profile
                    </FormLabel>
                    <FormDescription>
                      Displays your readiness scores after you complete at least 3
                      mock interviews. Off by default.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="pinnedProjectIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pinned projects</FormLabel>
                  <PinnedProjectsField
                    projects={projectsQuery.data ?? []}
                    loading={projectsQuery.isLoading}
                    pinnedIds={field.value}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="border-zinc-700"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-500"
                disabled={isSubmitting || !isDirty}
              >
                {isSubmitting ? (
                  <>
                    <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
