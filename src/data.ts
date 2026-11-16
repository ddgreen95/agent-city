// Types for the bundled sample business. The roster lives in public/samples/business.json
// and the workday is played in the browser by sim.ts. "running" means a scripted task is in progress.

export type State = "running" | "waiting_for_you" | "queued" | "assigned" | "idle";

export interface Member {
  kind: "agent" | "bot";
  name: string;
  title?: string;
  department: string;
  running: number;
  queued: number;
  waiting: number;
  on_card: number;
  ai_calls_10m: number;
  failed_24h: number;
  state: State;
  about?: string;
  doing?: string;
  doing_kind?: string;
  last_activity?: string | null;
}

export interface Department {
  key: string;
  name: string;
  building: string;
  color: string;
  members: number;
  running: number;
  waiting: number;
  busy: boolean;
  empty: boolean;
}

// Who is at the AI School right now (taking an exam, or passed and waiting for your yes). Empty = nobody.
export interface Trainee {
  kind: "agent" | "bot";
  name: string;
  department: string;
  status: "training" | "passed" | "failed" | "graduated";
  score?: number;
  detail?: string;
}

export interface CityData {
  departments: Department[];
  members: Member[];
  totals: { members: number; running: number; waiting_for_you: number; pending_approvals: number };
  training?: Trainee[];
  tools?: { name: string; status: string; ok: boolean }[];
  scoreboard?: { done_7d: number; failed_7d: number; open_cards: number; cards_done_7d: number; ai_calls_today: number; automations_on: number };
  log?: { at: string; who: string; what: string; status: string }[];
  note?: string;
}

export const STATE_INFO: Record<State, { color: string; label: string }> = {
  running: { color: "#3DDC97", label: "Working now" },
  waiting_for_you: { color: "#FFC542", label: "Waiting for you" },
  queued: { color: "#4DA3FF", label: "Queued" },
  assigned: { color: "#9FB4D4", label: "Has a card" },
  idle: { color: "#2A3A55", label: "Idle" },
};

// Members still at the AI Institute (not graduated) are shown in the classroom, not at their building.
export function atInstitute(d: CityData): Set<string> {
  return new Set((d.training ?? []).filter((t) => t.status !== "graduated").map((t) => t.kind + ":" + t.name));
}
