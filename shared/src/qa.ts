import type { Artifacts, WorkObject } from "./types";
import { countTags } from "./types";

const VAGUE = ["適宜", "きちんと", "しっかり", "なるべく早く", "必要に応じて"];

export interface QaResult {
  pass: boolean;
  notes: string[];
  confirmCount: number;
  inferenceCount: number;
}

export function runQa(work: WorkObject, artifacts: Artifacts): QaResult {
  const notes: string[] = [];
  const blob = Object.values(artifacts).join("\n");

  if (!work.done_when.length || work.done_when.every((x) => x.includes("[要確認]"))) {
    notes.push("完了条件がない");
  }
  if (!work.steps.length) notes.push("本線ステップがない");
  if (work.steps.length && !work.exceptions.length) {
    notes.push("例外が空。よくある例外を3つ取るか、例外なしの理由を書く");
  }
  if (work.decisions.some((d) => /感覚|なんとなく|いつもこんな/.test(`${d.question}${d.if}`))) {
    notes.push("判断が感覚だけで終わっている。見るものを書く");
  }
  const checkItems = artifacts.checklist.split("\n").filter((l) => /^\d+\./.test(l.trim()));
  if (checkItems.length > 20) notes.push("チェックリストが20項目を超えている。業務分割を提案");

  for (const w of VAGUE) {
    if (blob.includes(w)) notes.push(`曖昧語「${w}」が残っている。数値か具体例に置換`);
  }
  if (!work.owner_role || work.owner_role === "[要確認]") notes.push("主語（誰がやるか）がない");

  const moneyOrSafety = /最終金額|契約|安全|送金|振込/.test(blob);
  const aiAlone = /AI単独で最終/.test(blob);
  if (moneyOrSafety && aiAlone) notes.push("金・契約・安全をAI単独にしている");
  if (!work.personal_info || work.personal_info === "[要確認]") notes.push("個人情報の扱いがない");
  if (work.never_do.length < 3 && !work.never_do.some((n) => n.includes("禁則なし"))) {
    notes.push("禁則が3つ未満。3つか「禁則なし（理由）」を書く");
  }

  const handoffEmpty =
    (!work.handoff.employee || work.handoff.employee === "[要確認]") &&
    (!work.handoff.outsource || work.handoff.outsource === "[要確認]") &&
    (!work.handoff.ai || work.handoff.ai === "[要確認]");
  if (handoffEmpty) notes.push("正社員必須 / 外注 / AI が空");
  if (!work.save_to || work.save_to === "[要確認]") notes.push("保存場所がない");
  if (!work.filename_rule || work.filename_rule === "[要確認]") notes.push("ファイル名規則がない");

  const confirmCount = countTags(blob, "[要確認]");
  const inferenceCount = countTags(blob, "[推論]");

  return {
    pass: notes.length === 0,
    notes,
    confirmCount,
    inferenceCount,
  };
}

export function statusFromQa(qa: QaResult): "draft" | "holes" | "ready" {
  if (qa.confirmCount === 0 && qa.notes.length === 0) return "ready";
  if (qa.confirmCount > 12 || qa.notes.length > 4) return "draft";
  return "holes";
}
