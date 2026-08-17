import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Settings",
};

const SETTINGS = [
  {
    title: "Desktop notifications",
    detail: "Alert when a task is assigned or payment is approved.",
    defaultChecked: true,
  },
  {
    title: "Sound",
    detail: "Play a soft chime for urgent tasks.",
    defaultChecked: false,
  },
  {
    title: "Compact task list",
    detail: "Show denser rows on the Tasks screen.",
    defaultChecked: false,
  },
] as const;

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-2 text-base text-muted">
          Notification and display preferences (coming soon).
        </p>
      </header>

      <div className="space-y-4">
        {SETTINGS.map((item) => (
          <label
            key={item.title}
            className="flex cursor-not-allowed items-start gap-4 rounded-2xl border border-border bg-surface p-5 opacity-80"
            title="Coming soon"
          >
            <input
              type="checkbox"
              className="mt-1 size-4 accent-[var(--accent)]"
              defaultChecked={item.defaultChecked}
              disabled
              title="Coming soon"
              aria-disabled="true"
            />
            <span>
              <span className="block font-medium text-foreground">
                {item.title}
              </span>
              <span className="mt-1 block text-sm text-muted">{item.detail}</span>
              <span className="mt-2 block text-xs text-muted-dim">
                Coming soon
              </span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
