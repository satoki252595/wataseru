import type { WorkObject } from "./types";

/** 第14章の施工店・請求デモを、第8章まで展開した完成例。数字は架空。 */
export const DEMO_WORK: WorkObject = {
  work_id: "demo_seikyu_mawasu",
  name_official: "完了案件の請求書発行",
  name_field: "請求まわす",
  owner_role: "事務A。不在時は社長",
  beneficiary: "顧客経理 / 自社入金",
  trigger: "職長から「上がり」のLINEが来たとき",
  frequency: "案件ごと",
  sla: "完了連絡から2営業日以内に送付",
  purpose: "終わった仕事の代金を、漏れなく、揉めない形で回収する",
  start_conditions: [
    "職長から上がり連絡がある",
    "見積または追加合意がある",
    "顧客の請求先が台帳にある",
  ],
  done_when: [
    "請求PDFを送った",
    "台帳に請求日と入金予定日が入った",
    "案件フォルダにPDFを置いた",
  ],
  inputs: [
    { name: "作業日報", from: "職長", format: "写真+LINE" },
    { name: "見積または追加合意", from: "社長 / 顧客", format: "ExcelまたはLINE" },
    { name: "請求先マスタ", from: "台帳", format: "Excel" },
  ],
  outputs: [
    { name: "請求書PDF", to: "顧客", tool: "Misoca" },
    { name: "台帳1行", to: "自社", tool: "Excel台帳" },
  ],
  tools: ["LINE", "Excel台帳", "Misoca", "Gmail"],
  steps: [
    {
      id: "S1",
      action: "上がりLINEを案件フォルダに保存し、台帳の該当行を開く",
      actor: "事務",
      route: ["outsourceable", "ai_capable"],
      decision: null,
      tools: ["LINE", "Excel"],
      time_min: 3,
      hand: "見る / 保存する",
      look_at: "職長LINE、台帳の現場名",
    },
    {
      id: "S2",
      action: "日報の数量を台帳・見積と突き合わせる",
      actor: "事務",
      route: ["outsourceable", "ai_capable"],
      decision: null,
      tools: ["Excel"],
      time_min: 10,
      hand: "見る / 書く",
      look_at: "日報写真の数量、見積の数量列",
    },
    {
      id: "S3",
      action: "追加作業を請求に乗せるか判断する",
      actor: "事務 → 迷ったら社長",
      route: "human_required",
      decision: "D1",
      tools: ["LINE"],
      time_min: 8,
      hand: "見る / 待つ",
      look_at: "口頭了解の有無、追加合意の記録",
    },
    {
      id: "S4",
      action: "Misocaで請求書下書きを作る",
      actor: "事務",
      route: ["outsourceable", "ai_capable"],
      decision: null,
      tools: ["Misoca"],
      time_min: 8,
      hand: "書く",
      look_at: "請求先マスタの正式名称",
    },
    {
      id: "S5",
      action: "送付前チェックをしてGmailで送る",
      actor: "事務。最終送信は人",
      route: "human_required",
      decision: "D2",
      tools: ["Gmail", "Misoca"],
      time_min: 5,
      hand: "見る / 送る",
      look_at: "宛名、金額、入金予定日、件名",
    },
    {
      id: "S6",
      action: "台帳に請求日・入金予定日を書き、PDFをフォルダへ置く",
      actor: "事務",
      route: "outsourceable",
      decision: null,
      tools: ["Excel"],
      time_min: 4,
      hand: "書く / 保存する",
      look_at: "台帳の請求日列、案件フォルダ",
    },
  ],
  decisions: [
    {
      id: "D1",
      question: "追加作業を請求に乗せるか",
      if: "口頭了解がある、またはLINEに残っている",
      then: "乗せる",
      else: "社長確認。乗せずに出さない",
      escalate_to: "社長",
      look_at: "LINE履歴、現場メモ、見積の範囲外メモ",
    },
    {
      id: "D2",
      question: "このまま送ってよいか",
      if: "宛名が請求先マスタと一致し、金額が見積+合意追加と一致する",
      then: "送る",
      else: "直す。値引き要求が来ているなら社長",
      escalate_to: "社長",
      look_at: "請求先マスタ、見積合計、Misocaプレビュー",
    },
  ],
  exceptions: [
    {
      name: "追加が口頭だけ",
      sign: "日報に数量があるが、見積にもLINEにも合意がない",
      action: "請求から外して下書きを止め、社長に確認する",
      escalate_to: "社長",
    },
    {
      name: "請求先名称が不明",
      sign: "台帳の請求先が空、または屋号と法人名が食い違う",
      action: "送らない。社長または顧客窓口に正式名称を取る",
      escalate_to: "社長",
    },
    {
      name: "値引き要求が来た",
      sign: "送付前または送付後に「今回まけて」と連絡が来る",
      action: "事務は自分で値引きしない。社長判断を待つ",
      escalate_to: "社長",
    },
  ],
  never_do: [
    "口頭追加を請求に載せ忘れる（利益が消える）",
    "原価未確定のまま客先に数字を送る（後で揉め、値引きになる）",
    "請求先の略称で送る（入金が消える。正式名称をマスタと一致させる）",
    "値引きを事務判断で入れる（最終金額は社長）",
  ],
  failures: [
    "入金が翌月にずれる",
    "追加分が取れず利益が消える",
    "宛名違いで入金が消える",
  ],
  quality_bar: [
    "宛名の正式名称が請求先マスタと一字一句一致している",
    "品目と数量が日報および見積（または追加合意）と一致している",
    "合計金額が見積残＋合意追加であり、値引きは社長承認があるものだけ",
    "入金予定日が契約または常備の締めサイトどおり台帳に入っている",
    "PDFファイル名が 請求_現場名_YYYYMMDD.pdf になっている",
  ],
  handoff: {
    employee: "追加作業を乗せるかの最終判断、値引き、請求先不明時（現状は社長）",
    outsource: "台帳と日報の突き合わせ、Misoca下書き、送付前チェック",
    ai: "日報テキストから数量の抜き出し、送付文下書き、チェックリスト照合",
  },
  risks: ["過請求", "漏請求", "個人情報", "入金消込不能"],
  open_questions: [],
  escalate: "追加が口頭だけのとき、値引き要求が来たとき、請求先名称が不明なとき → 社長",
  time_estimate: "本線20分。追加作業の確認が入ると60分",
  filename_rule: "請求_現場名_YYYYMMDD.pdf",
  save_to: "案件フォルダ / 年 / 現場名 / 請求",
  personal_info: "顧客名・現場住所はフォルダ内のみ。チャットや学習に生データを貼らない。例示は匿名化する",
  revision_date: "2026-09-11",
  revision_reason: "初版（デモ）",
  next_work: "失注理由の記録、または材料発注",
};

export const DEMO_LOG = `取材の生の言い回し：
「上がり来たら回す」「口だけ追加は乗せんと社長」「マスタの正式名称で出せ、屋号で出すな」

分割した業務案：
- 本業務：完了案件の請求書発行（請求まわす）
- 前後：材料発注、失注理由の記録

推論した箇所：なし（デモは架空の完成例。数字は事実扱いしない）`;
