import {
  Bell,
  FileText,
  Pill,
  Stethoscope,
  Syringe,
  type LucideIcon,
} from "lucide-react";

export interface TimelineEvent {
  id: string;
  date: string;
  kind: "vaccine" | "visit" | "upload" | "medication" | "reminder";
  title: string;
  detail?: string;
}

const KIND_ICON: Record<TimelineEvent["kind"], LucideIcon> = {
  vaccine: Syringe,
  visit: Stethoscope,
  upload: FileText,
  medication: Pill,
  reminder: Bell,
};

/** Reverse-chron vertical rail of everything that happened for a pet. */
export function PetTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/20 bg-white p-8 text-center">
        <FileText
          size={32}
          aria-hidden="true"
          className="mx-auto text-ink-soft"
        />
        <p className="mt-2 font-display font-bold">No history yet</p>
        <p className="text-sm text-ink-soft">
          Upload your first document and it will show up here.
        </p>
      </div>
    );
  }
  return (
    <ol className="relative ml-2 border-l-2 border-ink/10">
      {events.map((event) => {
        const Icon = KIND_ICON[event.kind];
        return (
          <li key={event.id} className="relative pb-6 pl-8">
            <span
              aria-hidden="true"
              className="absolute -left-[21px] flex h-10 w-10 items-center justify-center rounded-full border border-ink/10 bg-white"
            >
              <Icon size={18} aria-hidden="true" className="text-ink-soft" />
            </span>
            <p className="text-xs font-medium text-ink-soft">{event.date}</p>
            <p className="font-semibold">{event.title}</p>
            {event.detail ? (
              <p className="text-sm text-ink-soft">{event.detail}</p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
