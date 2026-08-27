"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getAgentMetricsAction,
  getAgentPreferencesAction,
} from "@/features/dashboard/actions";
import { saveSkillsAction } from "@/features/agents/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/providers/toast-provider";

type Prefs = Awaited<ReturnType<typeof getAgentPreferencesAction>>;
type Metrics = Awaited<ReturnType<typeof getAgentMetricsAction>>;

export function AgentPrefsPanel() {
  const { toast } = useToast();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [skillDraft, setSkillDraft] = useState("");
  const [saved, setSaved] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    void Promise.all([
      getAgentPreferencesAction(),
      getAgentMetricsAction(),
    ])
      .then(([p, m]) => {
        setPrefs(p);
        setMetrics(m);
      })
      .catch((error) => {
        setLoadError(
          error instanceof Error ? error.message : "Could not load preferences.",
        );
      });
  }, []);

  if (loadError) {
    return <p className="text-sm text-red-600">{loadError}</p>;
  }

  if (!prefs || !metrics) {
    return <p className="text-sm text-muted">Loading preferences…</p>;
  }

  function save() {
    if (!prefs || pending) return;
    startTransition(async () => {
      const result = await saveSkillsAction(prefs.skills, prefs.isGeneralist);
      if (!result.ok) {
        setSaved(false);
        toast(result.message, "error");
        return;
      }
      setSaved(true);
      toast("Preferences saved.", "success");
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-foreground">
          Performance (read-only)
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Stat label="Week done" value={String(metrics.completedWeek)} />
          <Stat label="Avg reply" value={`${metrics.avgResponseMins}m`} />
          <Stat label="Rating" value={metrics.ratingAvg.toFixed(1)} />
          <Stat
            label="On-time"
            value={`${Math.round(metrics.onTimeRate * 100)}%`}
          />
        </dl>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground">Skill tags</p>
        <p className="mt-1 text-sm text-muted">
          Used later for matching. Payout settings are not shown here.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {prefs.skills.map((s) => (
            <Badge key={s} variant="accent">
              {s}
              <button
                type="button"
                className="ml-1.5 text-accent/80 hover:text-accent"
                aria-label={`Remove ${s}`}
                onClick={() => {
                  setPrefs({
                    ...prefs,
                    skills: prefs.skills.filter((x) => x !== s),
                  });
                  setSaved(false);
                }}
              >
                ×
              </button>
            </Badge>
          ))}
        </div>
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const next = skillDraft.trim();
            if (!next || prefs.skills.includes(next)) return;
            setPrefs({ ...prefs, skills: [...prefs.skills, next] });
            setSkillDraft("");
            setSaved(false);
          }}
        >
          <Input
            value={skillDraft}
            onChange={(e) => setSkillDraft(e.target.value)}
            placeholder="Add skill"
            className="max-w-xs"
          />
          <Button type="submit" variant="secondary">
            Add
          </Button>
        </form>
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground">
          Weekly availability
        </p>
        <p className="mt-1 text-sm text-muted">
          Nest only stores skill tags. Weekly hours are not in the agent API yet.
        </p>
        {prefs.schedule.length > 0 ? (
          <ul className="mt-2 space-y-2">
          {prefs.schedule.map((row, i) => (
            <li
              key={row.day}
              className="flex flex-wrap items-center gap-2 text-sm"
            >
              <label className="flex w-14 items-center gap-1.5 font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => {
                    const schedule = [...prefs.schedule];
                    schedule[i] = { ...row, enabled: e.target.checked };
                    setPrefs({ ...prefs, schedule });
                    setSaved(false);
                  }}
                />
                {row.day}
              </label>
              <Input
                type="time"
                value={row.start}
                disabled={!row.enabled}
                className="w-auto"
                onChange={(e) => {
                  const schedule = [...prefs.schedule];
                  schedule[i] = { ...row, start: e.target.value };
                  setPrefs({ ...prefs, schedule });
                  setSaved(false);
                }}
              />
              <span className="text-muted">to</span>
              <Input
                type="time"
                value={row.end}
                disabled={!row.enabled}
                className="w-auto"
                onChange={(e) => {
                  const schedule = [...prefs.schedule];
                  schedule[i] = { ...row, end: e.target.value };
                  setPrefs({ ...prefs, schedule });
                  setSaved(false);
                }}
              />
            </li>
          ))}
        </ul>
        ) : null}
      </div>

      <Button type="button" loading={pending} disabled={pending} onClick={save}>
        {saved ? "Saved" : "Save preferences"}
      </Button>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-[#f8fafc] px-3 py-2">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold tabular-nums text-foreground">
        {value}
      </dd>
    </div>
  );
}
