import type { Artifacts, WorkObject, WorkStep } from "./types";

const TBD = "[要確認]";

function line(v: string | undefined | null): string {
  const s = (v ?? "").trim();
  return s.length ? s : TBD;
}

function bullets(items: string[] | undefined, empty = TBD): string {
  const list = (items ?? []).map((x) => x.trim()).filter(Boolean);
  if (!list.length) return `- ${empty}`;
  return list.map((x) => `- ${x}`).join("\n");
}

function routeLabel(route: WorkStep["route"]): string {
  const arr = Array.isArray(route) ? route : [route];
  const map: Record<string, string> = {
    human_required: "正社員必須",
    outsourceable: "外注可",
    ai_capable: "AI可",
  };
  return arr.map((r) => map[r] ?? r).join(" + ");
}

function routeFlags(route: WorkStep["route"]) {
  const arr = Array.isArray(route) ? route : [route];
  return {
    human: arr.includes("human_required") ? "○" : "—",
    out: arr.includes("outsourceable") ? "○" : "—",
    ai: arr.includes("ai_capable") ? "○" : "—",
  };
}

export function renderCard(w: WorkObject): string {
  return `# 業務カード：${line(w.name_field)}（正式名：${line(w.name_official)}）

- 何のため：${line(w.purpose)}
- トリガー（いつ始まる）：${line(w.trigger)}
- 担当：${line(w.owner_role)}
- 所要時間の目安：${line(w.time_estimate)}
- 開始してよい条件：
${bullets(w.start_conditions)}
- 完了条件：
${bullets(w.done_when)}
- 成果物：${w.outputs.length ? w.outputs.map((o) => o.name).join("、") : TBD}
- 使う道具：${w.tools.length ? w.tools.join("、") : TBD}
- 失敗すると起きること：${w.failures.length ? w.failures.join(" / ") : TBD}
- 渡せる相手：
- 正社員必須：${line(w.handoff.employee)}
- 外注可：${line(w.handoff.outsource)}
- AI可（下書きまで）：${line(w.handoff.ai)}
- エスカレーション：${line(w.escalate)}
- 改訂日 / 改訂理由：${line(w.revision_date)} / ${line(w.revision_reason)}`;
}

export function renderSop(w: WorkObject): string {
  const steps = w.steps.length
    ? w.steps
        .map((s, i) => {
          const n = i + 1;
          const look = s.look_at ? `\n   - 見る場所：${s.look_at}` : "";
          const hand = s.hand ? `\n   - 手の動き：${s.hand}` : "";
          const dec = s.decision ? `\n   - 判断が必要 → ${s.decision}` : "";
          const tools = s.tools.length ? `\n   - 道具：${s.tools.join("、")}` : "";
          return `${n}. ${s.action}\n   - 担当：${line(s.actor)}${hand}${look}${dec}${tools}\n   - 所要の目安：${s.time_min || TBD}分`;
        })
        .join("\n\n")
    : `1. ${TBD}`;

  const decisions = w.decisions.length
    ? [
        "| ID | 判断 | 見るもの | Yes | No | 誰が決めるか |",
        "| --- | --- | ---- | --- | --- | ------ |",
        ...w.decisions.map(
          (d) =>
            `| ${d.id} | ${d.question} | ${line(d.look_at || d.if)} | ${d.then} | ${d.else} | ${line(d.escalate_to)} |`,
        ),
      ].join("\n")
    : `| ${TBD} | ${TBD} | ${TBD} | ${TBD} | ${TBD} | ${TBD} |`;

  const exceptions = w.exceptions.length
    ? [
        "| 例外 | 兆候 | 対応 | 上げ先 |",
        "| --- | --- | --- | --- |",
        ...w.exceptions.map(
          (e) => `| ${e.name} | ${e.sign} | ${e.action} | ${e.escalate_to} |`,
        ),
      ].join("\n")
    : `| ${TBD} | ${TBD} | ${TBD} | ${TBD} |`;

  const never = w.never_do.length
    ? w.never_do.map((n) => `- ${n}`).join("\n")
    : `- 禁則なし（理由）：${TBD}`;

  return `# SOP：${line(w.name_field)}（${line(w.name_official)}）

## 0. この手順の読み方
対象者と、対象外の案件。
- 対象：${line(w.owner_role)}が、${line(w.beneficiary)}のために行う「${line(w.name_field)}」
- 対象外：${TBD}（本線以外の別業務は混ぜない）
- 頻度：${line(w.frequency)} / SLA：${line(w.sla)}

## 1. 準備
開くもの、揃えるもの、権限。
- 道具：${w.tools.length ? w.tools.join("、") : TBD}
- 入力：
${w.inputs.length ? w.inputs.map((i) => `- ${i.name}${i.from ? `（from: ${i.from}）` : ""}${i.format ? ` / ${i.format}` : ""}`).join("\n") : `- ${TBD}`}
- 開始してよい条件：
${bullets(w.start_conditions)}

## 2. 本線（番号付き）
${steps}

## 3. 判断表
${decisions}

## 4. 例外
${exceptions}

## 5. やってはいけないこと
${never}

## 6. 完了確認
送る前の最終チェック。
${bullets(w.done_when)}
${w.quality_bar.length ? `\n合格ライン：\n${bullets(w.quality_bar)}` : ""}

## 7. 記録
どこに何を残すか。ファイル名規則。
- 保存場所：${line(w.save_to)}
- ファイル名規則：${line(w.filename_rule)}
- 個人情報の扱い：${line(w.personal_info)}`;
}

export function renderChecklist(w: WorkObject): string {
  const items: string[] = [];
  for (const c of w.start_conditions) items.push(c.startsWith("確認") || c.startsWith("揃") ? c : `揃える／確認する：${c}`);
  for (const s of w.steps) items.push(s.action);
  for (const q of w.quality_bar) items.push(`検査する：${q}`);
  for (const d of w.done_when) items.push(`完了を確認する：${d}`);

  const sliced = items.slice(0, 20);
  const note =
    items.length > 20
      ? `\n\n（${items.length}項目あるため、業務分割を検討。上20だけ掲載）`
      : "";

  return `# チェックリスト：${line(w.name_field)}

${sliced.length ? sliced.map((x, i) => `${i + 1}. ${x}`).join("\n") : `1. ${TBD}`}${note}`;
}

export function renderOrder(w: WorkObject): string {
  return `# 発注書：${line(w.name_official)}

- 発注者 / 受託者：${TBD}
- 目的：${line(w.purpose)}
- 対象範囲（やる）：
${w.steps
  .filter((s) => {
    const r = Array.isArray(s.route) ? s.route : [s.route];
    return r.includes("outsourceable");
  })
  .map((s) => `- ${s.action}`)
  .join("\n") || bullets(w.steps.map((s) => s.action))}
- 対象外（やらない）：
${bullets(w.never_do)}
- 入力で渡すもの：
${w.inputs.length ? w.inputs.map((i) => `- ${i.name}${i.format ? `（${i.format}）` : ""}`).join("\n") : `- ${TBD}`}
- 出力で返すもの（形式・ファイル名・期限）：
${w.outputs.length ? w.outputs.map((o) => `- ${o.name}${o.tool ? ` / ${o.tool}` : ""}${o.to ? ` → ${o.to}` : ""}`).join("\n") : `- ${TBD}`}
- 納期：${line(w.sla)}
- 品質の合格ライン：
${bullets(w.quality_bar)}
- 不合格時のやり直し条件：不合格項目を直して再提出。最終金額・契約・安全は発注者が決める
- 使ってよい道具 / 使ってはいけない道具：可：${w.tools.join("、") || TBD} / 不可：顧客本番への無断送信、個人情報の学習利用
- 個人情報・顧客情報の扱い：${line(w.personal_info)}
- 質問してよい時間帯と窓口：${line(w.escalate)}
- 自分で決めてよい範囲 / 必ず確認する範囲：可：${line(w.handoff.outsource)} / 必須確認：${line(w.handoff.employee)}
- 単価と単位（時間ではない場合の測り方）：成果物単位（${w.outputs.map((o) => o.name).join("、") || TBD}）。時間が不可避なら上限時間を併記 ${TBD}`;
}

export function renderRouting(w: WorkObject): string {
  const rows = w.steps.length
    ? w.steps.map((s) => {
        const f = routeFlags(s.route);
        return `| ${s.action} | ${f.human} | ${f.out} | ${f.ai} | ${routeLabel(s.route)} | ${s.decision ? "判断基準の文書化" : "—"} |`;
      })
    : `| ${TBD} | ${TBD} | ${TBD} | ${TBD} | ${TBD} | ${TBD} |`;

  return `# 仕分け表：${line(w.name_field)}

| ステップ | 人必須 | 外注可 | AI可 | 理由 | 先に必要な整備 |
| --- | --- | --- | --- | --- | --- |
${rows}

- 正社員必須：${line(w.handoff.employee)}
- 外注可：${line(w.handoff.outsource)}
- AI可：${line(w.handoff.ai)}`;
}

export function renderQuality(w: WorkObject): string {
  const bars = w.quality_bar.length
    ? w.quality_bar.map((q) => `- [ ] ${q}`).join("\n")
    : `- [ ] ${TBD}`;
  return `# 品質基準（検査仕様）：${line(w.name_official)}

第三者が赤か青か判断できること。感覚語は使わない。

${bars}

不合格のとき：やり直す人は ${line(w.owner_role)}。上げ先は ${line(w.escalate)}。`;
}

export function renderHiring(w: WorkObject): string {
  return `# 求人用「実際にやること」：${line(w.name_field)}

- 1日の実作業：
${w.steps.length ? w.steps.map((s) => `- ${s.action}（目安${s.time_min || TBD}分）`).join("\n") : `- ${TBD}`}
- 覚えるのにかかる目安：${TBD}（本線を3件、同席で回したら一人目安）
- 最初の1週間は一人でやらせないこと：${line(w.handoff.employee)}、${line(w.escalate)}
- 向いている人の行動（性格ではなく行動）：手順どおりに記録を残す。分からないとき自分で送らず聞く。数字を出典まで辿る
- この仕事単体では採用しない方がよい理由（あれば）：判断 ${w.decisions.map((d) => d.question).join("、") || TBD} が残るため、教育者が不在の採用は止める`;
}

export function renderAi(w: WorkObject): string {
  const aiSteps = w.steps.filter((s) => {
    const r = Array.isArray(s.route) ? s.route : [s.route];
    return r.includes("ai_capable");
  });
  return `# AI化メモ：${line(w.name_field)}

- AIにさせてよい工程：
${aiSteps.length ? aiSteps.map((s) => `- ${s.action}`).join("\n") : `- ${TBD}`}
- AIに渡してよいデータ：${w.inputs.map((i) => i.name).join("、") || TBD}（個人情報はマスキング前提）
- マスクすべきデータ：顧客名、住所、口座、電話、個別賃金、病歴
- 人が承認するゲート：最終送信、最終金額、契約、安全合図。${line(w.handoff.employee)}
- 期待する入力→出力の例を2つ：
  1. 入力：${w.inputs[0]?.name || TBD} → 出力：${w.outputs[0]?.name || TBD}の下書き
  2. 入力：完了チェック項目 → 出力：漏れ一覧
- まだAI化してはいけない理由：${line(w.handoff.employee)} は失敗が金・顧客・安全のどれかに傷をつける`;
}

export function renderAll(w: WorkObject, log = ""): Artifacts {
  return {
    card: renderCard(w),
    sop: renderSop(w),
    checklist: renderChecklist(w),
    order: renderOrder(w),
    routing: renderRouting(w),
    quality: renderQuality(w),
    hiring: renderHiring(w),
    ai: renderAi(w),
    log,
  };
}
