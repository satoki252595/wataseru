export type RouteKind = "human_required" | "outsourceable" | "ai_capable";

export type Usage = "onboarding" | "outsource" | "organize" | "hiring" | "ai_prep";

export type WorkStatus = "draft" | "holes" | "ready";

export type SourceKind = "talk" | "memo" | "file";

export type ArtifactKey =
  | "card"
  | "sop"
  | "checklist"
  | "order"
  | "routing"
  | "quality"
  | "hiring"
  | "ai"
  | "log";

export const USAGE_LABEL: Record<Usage, string> = {
  onboarding: "新人教育",
  outsource: "外注",
  organize: "頭の整理",
  hiring: "求人",
  ai_prep: "AI化準備",
};

export const USAGE_HINT: Record<Usage, string> = {
  onboarding: "業務カード・SOP・チェックリスト",
  outsource: "業務カード・SOP・発注書・品質基準",
  organize: "業務カード・SOP・仕分け表",
  hiring: "業務カード・実際にやること",
  ai_prep: "業務カード・SOP・仕分け・AI化メモ",
};

export const REQUIRED_ARTIFACTS: Record<Usage, ArtifactKey[]> = {
  onboarding: ["card", "sop", "checklist"],
  outsource: ["card", "sop", "order", "quality"],
  organize: ["card", "sop", "routing"],
  hiring: ["card", "hiring"],
  ai_prep: ["card", "sop", "routing", "ai"],
};

export const ARTIFACT_LABEL: Record<ArtifactKey, string> = {
  card: "業務カード",
  sop: "SOP",
  checklist: "チェックリスト",
  order: "外注発注書",
  routing: "仕分け表",
  quality: "品質基準",
  hiring: "求人用",
  ai: "AI化メモ",
  log: "作業ログ",
};

export const SOURCE_LABEL: Record<SourceKind, string> = {
  talk: "今から口で話す",
  memo: "メモを貼る",
  file: "ファイルを置く",
};

export interface NamedIO {
  name: string;
  from?: string;
  to?: string;
  format?: string;
  tool?: string;
}

export interface WorkStep {
  id: string;
  action: string;
  actor: string;
  route: RouteKind | RouteKind[];
  decision: string | null;
  tools: string[];
  time_min: number;
  look_at?: string;
  hand?: string;
}

export interface WorkDecision {
  id: string;
  question: string;
  if: string;
  then: string;
  else: string;
  escalate_to: string;
  look_at?: string;
}

export interface WorkException {
  name: string;
  sign: string;
  action: string;
  escalate_to: string;
}

export interface WorkObject {
  work_id: string;
  name_official: string;
  name_field: string;
  owner_role: string;
  beneficiary: string;
  trigger: string;
  frequency: string;
  sla: string;
  purpose: string;
  start_conditions: string[];
  done_when: string[];
  inputs: NamedIO[];
  outputs: NamedIO[];
  tools: string[];
  steps: WorkStep[];
  decisions: WorkDecision[];
  exceptions: WorkException[];
  never_do: string[];
  failures: string[];
  quality_bar: string[];
  handoff: { employee: string; outsource: string; ai: string };
  risks: string[];
  open_questions: string[];
  escalate: string;
  time_estimate: string;
  filename_rule: string;
  save_to: string;
  personal_info: string;
  revision_date: string;
  revision_reason: string;
  next_work?: string;
}

export interface Artifacts {
  card: string;
  sop: string;
  checklist: string;
  order: string;
  routing: string;
  quality: string;
  hiring: string;
  ai: string;
  log: string;
}

export interface ChatMessage {
  id: string;
  role: "assistant" | "user" | "system";
  content: string;
  at: string;
}

export interface WorkRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  usage: Usage;
  source: SourceKind;
  status: WorkStatus;
  work: WorkObject;
  artifacts: Artifacts;
  messages: ChatMessage[];
  qaNotes: string;
  confirmCount: number;
  confirmCountFirst: number;
  isDemo: boolean;
}

export function emptyWork(partial?: Partial<WorkObject>): WorkObject {
  return {
    work_id: partial?.work_id ?? "",
    name_official: partial?.name_official ?? "",
    name_field: partial?.name_field ?? "",
    owner_role: partial?.owner_role ?? "[要確認]",
    beneficiary: partial?.beneficiary ?? "[要確認]",
    trigger: partial?.trigger ?? "[要確認]",
    frequency: partial?.frequency ?? "[要確認]",
    sla: partial?.sla ?? "[要確認]",
    purpose: partial?.purpose ?? "[要確認]",
    start_conditions: partial?.start_conditions ?? ["[要確認]"],
    done_when: partial?.done_when ?? ["[要確認]"],
    inputs: partial?.inputs ?? [],
    outputs: partial?.outputs ?? [],
    tools: partial?.tools ?? [],
    steps: partial?.steps ?? [],
    decisions: partial?.decisions ?? [],
    exceptions: partial?.exceptions ?? [],
    never_do: partial?.never_do ?? [],
    failures: partial?.failures ?? [],
    quality_bar: partial?.quality_bar ?? [],
    handoff: partial?.handoff ?? { employee: "[要確認]", outsource: "[要確認]", ai: "[要確認]" },
    risks: partial?.risks ?? [],
    open_questions: partial?.open_questions ?? [],
    escalate: partial?.escalate ?? "[要確認]",
    time_estimate: partial?.time_estimate ?? "[要確認]",
    filename_rule: partial?.filename_rule ?? "[要確認]",
    save_to: partial?.save_to ?? "[要確認]",
    personal_info: partial?.personal_info ?? "[要確認]",
    revision_date: partial?.revision_date ?? new Date().toISOString().slice(0, 10),
    revision_reason: partial?.revision_reason ?? "初版",
    next_work: partial?.next_work,
  };
}

export function emptyArtifacts(): Artifacts {
  return {
    card: "",
    sop: "",
    checklist: "",
    order: "",
    routing: "",
    quality: "",
    hiring: "",
    ai: "",
    log: "",
  };
}

export function countTags(text: string, tag: string): number {
  if (!text) return 0;
  return text.split(tag).length - 1;
}

export function extractTaggedLines(text: string, tag: string): string[] {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.includes(tag));
}
