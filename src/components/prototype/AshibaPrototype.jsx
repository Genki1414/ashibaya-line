"use client";
/* eslint-disable */
// docs/ashiba_platform_v8.jsx をそのまま移植したクライアント・プロトタイプ（v8の全画面・デザインを忠実に再現）。
// 内部状態でナビゲーション・シードデータを持つ自己完結アプリ。ドメイン層への接続は次フェーズ。
import React, { useState } from "react";

/* =========================================================================
   足場会社向け 信用プラットフォーム プロトタイプ v8
   ─────────────────────────────────────────────────────────────────────────
   v8の変更点：
   ・折りたたみで重要な操作が隠れないよう改善：自分が対応すべき項目
     （取引開始/注文書・請書/作業開始・作業報告/完了確認・是正/請求・入金/
     確認事項/工期変更の確認）は自動で開き、ハイライト表示する
   ・取引詳細の上部に「あなたの操作（要対応）」ハイライトを常時表示
   ・作業開始も日次で報告できるように（作業開始報告／作業終了報告）。
     いずれもステータスは変えず、AshiBase勤怠へ連携できる
   （v7までの機能）折りたたみUI、のべ作業日数の自動計算、元請の工期・
     予定変更＋協力への通知、応援/請負、締め/支払日、継続チャット、
     注文書/注文請書、独立進行、是正・手直し、AshiBase連携。
   ※ 保証・決済・預り金・AshiBase連携は表示/導線のみ。実処理・実API接続は未実装。
   ========================================================================= */

const T = {
  blue: "#1657C9", blueDark: "#0F3F97", blueLight: "#E8F0FE", blueSoft: "#F4F8FF",
  ink: "#1A2233", sub: "#5B6473", faint: "#8A93A3", line: "#E5E9F0", bg: "#F4F6FB",
  white: "#FFFFFF", green: "#159B67", greenSoft: "#E4F6EE", amber: "#E39A2B",
  amberSoft: "#FCF2DF", red: "#E5484D", redSoft: "#FCEBEC", purple: "#6D4AC4", gold: "#C79A2E",
};
const font = '"Hiragino Kaku Gothic ProN","Hiragino Sans","Noto Sans JP","Yu Gothic",system-ui,sans-serif';
const TODAY = "2026-07-11";

const d2 = (s) => (s ? `${Number(s.split("-")[1])}/${Number(s.split("-")[2])}` : "-");
const dFull = (s) => (s ? `${s.split("-")[0]}年${Number(s.split("-")[1])}月${Number(s.split("-")[2])}日` : "-");
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);
const nowStamp = () => "たった今";
const yen = (n) => "¥" + Number(n).toLocaleString();
const phJP = (ph) => (ph === "assembly" ? "組立" : "解体");
const JOBTYPE = { support: "応援", contract: "請負" };
const CLOSING = ["末締め", "25日締め", "20日締め", "15日締め", "10日締め"];
const PAYTERM = ["翌月末払い", "翌月25日払い", "翌月15日払い", "翌々月末払い", "当月末払い"];

const VERIFY_ITEMS = [
  { key: "phone", label: "電話番号確認", core: true }, { key: "email", label: "メールアドレス確認", core: true },
  { key: "corp", label: "法人番号確認", core: true }, { key: "rep", label: "代表者確認", core: true },
  { key: "address", label: "所在地確認", core: true }, { key: "license", label: "建設業許可確認", main: true },
  { key: "invoice", label: "インボイス登録確認", main: true }, { key: "labor", label: "労災保険確認", main: true },
  { key: "liability", label: "賠償責任保険確認", main: true }, { key: "sole", label: "一人親方特別加入確認" },
  { key: "qual", label: "保有資格確認" }, { key: "harness", label: "フルハーネス特別教育確認" },
];
const V_STATUS = {
  none: { label: "未提出", color: T.faint, bg: "#EEF1F5" }, reviewing: { label: "確認中", color: T.amber, bg: T.amberSoft },
  verified: { label: "確認済み", color: T.green, bg: T.greenSoft }, expired: { label: "有効期限切れ", color: T.red, bg: T.redSoft },
  rejected: { label: "差し戻し", color: T.red, bg: T.redSoft },
};
const LEVELS = {
  未認証: { color: T.faint, bg: "#EEF1F5" }, Bronze: { color: "#A9713B", bg: "#F6ECE1" },
  Silver: { color: "#6B7684", bg: "#EEF1F5" }, Gold: { color: T.gold, bg: "#FBF2D9" }, Platinum: { color: T.purple, bg: "#EEE9FA" },
};
const onTimeRate = (m) => { const p = m.onTimeCount + m.lateCount; return p ? Math.round((m.onTimeCount / p) * 100) : 0; };
const coreVerified = (c) => VERIFY_ITEMS.filter((i) => i.core).every((i) => c.verify[i.key] === "verified");
const mainVerifiedCount = (c) => VERIFY_ITEMS.filter((i) => i.main).filter((i) => c.verify[i.key] === "verified").length;
const companyOpenIssue = (c, txs) => txs.some((t) => (t.primeId === c.id || t.partnerId === c.id) && hasOpenIssue(t));
function creditLevel(c, txs) {
  const m = c.metrics, rate = onTimeRate(m), n = m.completed;
  if (!coreVerified(c)) return "未認証";
  if (n >= 50 && rate >= 98 && m.lateCount === 0 && mainVerifiedCount(c) >= 4) return "Platinum";
  if (n >= 20 && rate >= 95 && mainVerifiedCount(c) >= 3) return "Gold";
  if (n >= 5 && rate >= 90 && !companyOpenIssue(c, txs)) return "Silver";
  if (n >= 1) return "Bronze";
  return "未認証";
}
function companyFacts(c, txs) {
  const m = c.metrics, concerns = [], positives = [], v = coreVerified(c);
  if (!v) concerns.push("本人確認が完了していません");
  if (m.completed === 0 && m.paidCount === 0) concerns.push("支払い実績がまだありません");
  if (daysBetween(c.registered, TODAY) <= 7) concerns.push("登録から7日以内の会社です");
  if (c.verify.license !== "verified") concerns.push("建設業許可が未確認です");
  if (c.verify.labor !== "verified" && c.verify.liability !== "verified") concerns.push("保険加入状況が未確認です");
  if (m.lateCount > 0) concerns.push(`支払い遅延が${m.lateCount}件あります`);
  if (companyOpenIssue(c, txs)) concerns.push("未解決の確認事項があります");
  if (v) positives.push("本人確認済み");
  if (m.paidCount > 0) positives.push(`支払い実績${m.paidCount}件`);
  if (m.onTimeCount > 0) positives.push(`期日内支払い${m.onTimeCount}件`);
  positives.push(`支払い遅延${m.lateCount}件`);
  if (m.continuous > 0) positives.push(`継続取引${m.continuous}社`);
  if (c.verify.license === "verified") positives.push("建設業許可確認済み");
  if (c.verify.labor === "verified" || c.verify.liability === "verified") positives.push("保険加入確認済み");
  return { concerns, positives };
}

/* ============================ 取引ロジック（独立二相） ================== */
const hasOpenIssue = (t) => t.issues.some((i) => !i.resolved);
const phaseAmount = (t, ph) => (t.payType === "progress" ? (ph === "assembly" ? t.assemblyAmount : t.dismantleAmount) : ph === "dismantle" ? t.amount : 0);
const phaseSpanDays = (t, ph) => { const s = ph === "assembly" ? t.assemblyStart : t.dismantleStart, e = ph === "assembly" ? t.assemblyEnd : t.dismantleEnd; return s && e ? daysBetween(s, e) : 0; };
const phaseMultiDay = (t, ph) => phaseSpanDays(t, ph) >= 1;
const dismantleLocked = (t) => t.ph.assembly.work !== "confirmed";
function workAction(t, ph) {
  const p = t.ph[ph];
  if (ph === "dismantle" && dismantleLocked(t)) return null;
  if (p.work === "waiting") return { kind: "startWork", actor: "both", label: `${phJP(ph)}作業を開始` };
  if (p.work === "working") return { kind: "reportWork", actor: "partner", label: `${phJP(ph)}完了を報告` };
  if (p.work === "reported") return { kind: "confirm", actor: "prime" };
  if (p.work === "rework") return { kind: "reworkDone", actor: "partner", label: "是正・手直し完了" };
  return null;
}
function billAction(t, ph) {
  const p = t.ph[ph];
  if (p.work !== "confirmed") return null;
  if (t.payType === "lump" && ph === "assembly") return null;
  if (p.bill === "none") return { kind: "invoice", actor: "partner", label: t.payType === "progress" ? (ph === "assembly" ? "組立分を請求" : "残金を請求") : "請求書を提出" };
  if (p.bill === "invoiced") return { kind: "checkInvoice", actor: "prime", label: "請求書を確認" };
  if (p.bill === "checked") return { kind: "payment", actor: "prime", label: "支払い済みにする" };
  if (p.bill === "paid") return { kind: "deposit", actor: "partner", label: "入金を確認" };
  return null;
}
const billed = (t) => ["assembly", "dismantle"].filter((ph) => t.ph[ph].inv && t.ph[ph].pay);
const allOnTime = (t) => billed(t).every((ph) => daysBetween(t.ph[ph].inv.dueDate, t.ph[ph].pay.date) <= 0);
const avgPay = (t) => { const p = billed(t); return p.length ? Math.round(p.reduce((s, ph) => s + daysBetween(t.ph[ph].inv.date, t.ph[ph].pay.date), 0) / p.length) : 0; };
const isCompleted = (t) => (t.payType === "progress" ? t.ph.assembly.bill === "deposited" && t.ph.dismantle.bill === "deposited" : t.ph.dismantle.bill === "deposited");
const WORK_JP = { waiting: "開始前", working: "作業中", reported: "完了報告あり（確認待ち）", rework: "是正・手直し中", confirmed: "完了確認済み" };
const BILL_JP = { none: "未請求", invoiced: "請求済み（確認待ち）", checked: "請求確認済み（支払い待ち）", paid: "支払い済み（入金確認待ち）", deposited: "入金確認済み" };
function txCategory(t) {
  if (t.status === "completed") return "completed";
  if (hasOpenIssue(t)) return "issue";
  if (["assembly", "dismantle"].some((p) => t.ph[p].work === "rework")) return "rework";
  if (["assembly", "dismantle"].some((p) => workAction(t, p))) return "active";
  if (["assembly", "dismantle"].some((p) => billAction(t, p))) return "billing";
  return "active";
}
function txStatusMeta(t) {
  const map = {
    completed: { label: "取引完了", color: T.green, bg: T.greenSoft },
    issue: { label: "確認事項あり", color: T.red, bg: T.redSoft },
    rework: { label: "是正・手直し中", color: T.amber, bg: T.amberSoft },
    billing: { label: "請求・入金対応中", color: T.amber, bg: T.amberSoft },
    active: { label: "取引中", color: T.blue, bg: T.blueLight },
  };
  return map[txCategory(t)];
}
const ACTOR_JP = { prime: "元請", partner: "協力会社", both: "どちらか" };
function nextHint(t) {
  if (t.status === "completed") return "取引が完了しました";
  if (hasOpenIssue(t)) return "確認事項の解決が必要です";
  for (const ph of ["assembly", "dismantle"]) { const w = workAction(t, ph); if (w) { if (w.kind === "confirm") return `元請が「${phJP(ph)}完了の確認 / 是正依頼」`; return `${ACTOR_JP[w.actor]}が「${w.label}」`; } }
  for (const ph of ["assembly", "dismantle"]) { const b = billAction(t, ph); if (b) return `${ACTOR_JP[b.actor]}が「${b.label}」`; }
  return "";
}
const depositPending = (t) => ["assembly", "dismantle"].some((p) => t.ph[p].bill === "paid");

/* ============================ AshiBase連携仕様 ========================== */
/* 各データを施工管理側（AshiBase）へ渡せる正規化ペイロードに変換する。
   実際のフィールド名はAshiBaseのAPI仕様に合わせてマッピングする前提。      */
const ASHIBASE_DOMAINS = [
  { key: "schedule", label: "工程", note: "組立/解体の予定・実績日" },
  { key: "attendance", label: "勤怠", note: "作業開始・完了・人数（人工）" },
  { key: "billing", label: "請求・原価", note: "契約金額・出来高・請求・入金" },
  { key: "partner", label: "取引先", note: "元請・協力会社・信用情報" },
  { key: "docs", label: "書類", note: "注文書・注文請書" },
];
function phaseSchedule(t, phk) {
  const p = t.ph[phk];
  return { 予定開始: phk === "assembly" ? t.assemblyStart : t.dismantleStart, 予定完了: phk === "assembly" ? t.assemblyEnd : t.dismantleEnd, 実績開始: p.startDate, 実績完了: p.endDate, 状態: WORK_JP[p.work] };
}
function attendanceRows(t) {
  const rows = [];
  ["assembly", "dismantle"].forEach((phk) => {
    const p = t.ph[phk];
    (p.sessions || []).forEach((s) => rows.push({ 区分: `${phJP(phk)}（${s.kind === "start" ? "作業開始" : "作業終了"}）`, 開始日: s.kind === "start" ? s.date : null, 完了日: s.kind === "end" ? s.date : null, 作業日数: 1, 人数: s.people || null }));
    if (p.startDate || p.report) rows.push({ 区分: phJP(phk), 開始日: p.startDate, 完了日: p.endDate, 作業日数: p.report ? p.report.days : null, 人数: p.report ? p.report.people : null });
  });
  return rows;
}
function ashibasePayload(t, co) {
  const prime = co(t.primeId), partner = co(t.partnerId);
  const billRows = ["assembly", "dismantle"].filter((phk) => t.ph[phk].inv).map((phk) => { const p = t.ph[phk]; return { 区分: phJP(phk), 請求額: p.inv.amount, 請求日: p.inv.date, 支払期日: p.inv.dueDate, 支払日: p.pay ? p.pay.date : null, 入金確認: p.dep ? true : false }; });
  return {
    案件: { 現場名: t.projectName, 種別: JOBTYPE[t.jobType], 住所: `${t.region} ${t.address}`, 工期: `${t.start}〜${t.end}` },
    工程: { 組立: phaseSchedule(t, "assembly"), 解体: phaseSchedule(t, "dismantle") },
    勤怠: attendanceRows(t),
    請求原価: { 契約金額: t.amount, 支払方式: t.payType === "progress" ? "出来高" : "一括", 出来高内訳: t.payType === "progress" ? { 組立: t.assemblyAmount, 解体: t.dismantleAmount } : null, 締め日: t.closing, 支払日: t.payterm, 明細: billRows },
    取引先: { 元請: prime.name, 協力会社: partner.name },
    書類: { 注文書: t.order ? t.order.date : null, 注文請書: t.orderAck ? t.orderAck.date : null },
  };
}

/* ============================ シードデータ =============================== */
const allV = Object.fromEntries(VERIFY_ITEMS.map((i) => [i.key, "verified"]));
const partV = { phone: "verified", email: "verified", corp: "verified", rep: "verified", address: "verified", license: "verified", invoice: "verified", labor: "verified", liability: "reviewing", sole: "none", qual: "verified", harness: "reviewing" };
const noneV = { phone: "verified", email: "reviewing", corp: "none", rep: "none", address: "none", license: "none", invoice: "none", labor: "none", liability: "none", sole: "none", qual: "none", harness: "none" };
const SEED_COMPANIES = [
  { id: "A", name: "株式会社みらい足場", region: "宮城県 仙台市", contact: "佐藤 誠", areas: "宮城・山形・福島", works: "くさび足場・単管・吊り足場", registered: "2024-03-01", verify: { ...allV }, metrics: { completed: 24, paidCount: 24, onTimeCount: 24, lateCount: 0, unpaid: 0, avgPayDays: 28, lastTrade: "2026-07-08", continuous: 8, _partners: [] } },
  { id: "B", name: "東北ハウジング工業", region: "宮城県 名取市", contact: "高橋 亮", areas: "宮城・岩手", works: "新築足場・改修足場", registered: "2025-09-15", verify: { ...partV }, metrics: { completed: 5, paidCount: 5, onTimeCount: 4, lateCount: 1, unpaid: 0, avgPayDays: 33, lastTrade: "2026-06-20", continuous: 3, _partners: [] } },
  { id: "C", name: "郡山スカイ足場", region: "福島県 郡山市", contact: "渡辺 健", areas: "福島", works: "改修足場", registered: "2026-07-07", verify: { ...noneV }, metrics: { completed: 0, paidCount: 0, onTimeCount: 0, lateCount: 0, unpaid: 0, avgPayDays: 0, lastTrade: null, continuous: 0, _partners: [] } },
  { id: "D", name: "仙台建装ワークス", region: "宮城県 仙台市", contact: "伊藤 学", areas: "宮城", works: "改修・塗装足場", registered: "2025-01-20", verify: { ...allV, harness: "verified" }, metrics: { completed: 31, paidCount: 31, onTimeCount: 30, lateCount: 1, unpaid: 0, avgPayDays: 30, lastTrade: "2026-07-05", continuous: 11, _partners: [] } },
];
const SELF_ID = "A";
const tl = (companyName, actor, label, comment) => ({ ts: nowStamp(), companyName, actor, label, comment: comment || null });
let idc = 0;
const nid = (p) => `${p}${++idc}`;
const SEED_PROJECTS = [
  { id: "p1", stage: "recruiting", name: "マンション改修 足場（組立・解体）", jobType: "support", region: "宮城県 仙台市", address: "仙台市青葉区国分町2-1-〇", start: "2026-08-01", end: "2026-08-22", assemblyStart: "2026-08-01", assemblyEnd: "2026-08-02", dismantleStart: "2026-08-20", dismantleEnd: "2026-08-21", need: 2, price: 22000, payType: "progress", closing: "末締め", payterm: "翌月末払い", work: "6階建てマンション改修。組立後、外壁改修期間を経て解体。手すり先行工法。", belongings: "ヘルメット・フルハーネス・安全靴・革手袋", deadline: "2026-07-28", posted: "2026-07-10", guaranteed: true, primeId: "A", applicants: ["B", "C"] },
  { id: "p2", stage: "recruiting", name: "戸建て新築 足場一式", jobType: "contract", region: "宮城県 名取市", address: "名取市増田字〇〇", start: "2026-08-03", end: "2026-08-06", assemblyStart: "2026-08-03", assemblyEnd: "2026-08-03", dismantleStart: "2026-08-06", dismantleEnd: "2026-08-06", need: null, price: 240000, payType: "lump", closing: "末締め", payterm: "翌月15日払い", work: "木造2階建て新築の外部足場架設・解体を一式請負。狭あい地。", belongings: "ヘルメット・フルハーネス・安全靴", deadline: "2026-07-30", posted: "2026-07-09", guaranteed: false, primeId: "A", applicants: ["C"] },
];
const ph = (o = {}) => ({ work: "waiting", startDate: null, endDate: null, sessions: [], report: null, rework: null, bill: "none", inv: null, pay: null, dep: null, ...o });
const rep = (date, days, people, content) => ({ date, days, people, content, note: "", photos: 2 });
const iv = (amount, date, dueDate) => ({ amount, date, dueDate, bank: "七十七銀行 仙台支店 普通1234567", note: "" });
const pmt = (date, amount) => ({ date, amount, method: "銀行振込", note: "" });
const dp = (date, amount) => ({ date, amount, diff: false, note: "" });
function mkTx(over) {
  const base = {
    id: nid("t"), projectName: "案件", jobType: "support", region: "宮城県 仙台市", address: "仙台市〇〇",
    start: "2026-07-08", end: "2026-08-05", assemblyStart: "2026-07-08", assemblyEnd: "2026-07-09", dismantleStart: "2026-08-04", dismantleEnd: "2026-08-05", need: 2,
    amount: 440000, payType: "progress", assemblyAmount: 220000, dismantleAmount: 220000,
    closing: "末締め", payterm: "翌月末払い", primeId: "A", partnerId: "B", guaranteed: true,
    chatKey: null, order: null, orderAck: null, status: null,
    ph: { assembly: ph(), dismantle: ph() }, issues: [], consultations: [], ashibase: null,
    timeline: [tl("株式会社みらい足場", "佐藤 誠", "協力会社として選定されました")],
  };
  const t = { ...base, ...over };
  t.chatKey = over.chatKey || `seed:${t.id}`;
  ["assembly", "dismantle"].forEach((phk) => {
    const p = t.ph[phk];
    const planStart = phk === "assembly" ? t.assemblyStart : t.dismantleStart;
    if (p.work !== "waiting" && !p.startDate) p.startDate = p.report ? p.report.date : planStart;
    if (p.report && !p.endDate) p.endDate = p.report.date;
  });
  return t;
}
const SEED_TX = [
  mkTx({ projectName: "工場外壁 足場（組立・解体）", ph: { assembly: ph({ work: "working", startDate: "2026-07-08", sessions: [{ date: "2026-07-08", kind: "end", people: 2, content: "1〜2層まで架設。翌日continue。" }] }), dismantle: ph() }, timeline: [tl("株式会社みらい足場", "佐藤 誠", "取引が開始されました"), tl("東北ハウジング工業", "高橋 亮", "組立作業を開始しました", "開始日 7/8 / 2名"), tl("東北ハウジング工業", "高橋 亮", "組立の作業終了が報告されました", "7/8 / 2名")] }),
  mkTx({ projectName: "アパート改修 足場", ph: { assembly: ph({ work: "reported", report: rep("2026-07-10", 2, 2, "くさび足場 組立完了") }), dismantle: ph() }, timeline: [tl("東北ハウジング工業", "高橋 亮", "組立完了が報告されました", "2日 / 2名")] }),
  mkTx({ projectName: "店舗改装 足場", ph: { assembly: ph({ work: "rework", report: rep("2026-07-09", 2, 2, "組立完了"), rework: { text: "3階北側の手すりに隙間あり。基準に合わせて是正してください。", date: "2026-07-10" } }), dismantle: ph() }, timeline: [tl("東北ハウジング工業", "高橋 亮", "組立完了が報告されました"), tl("株式会社みらい足場", "佐藤 誠", "組立の是正・手直しを依頼しました", "手すりの隙間")] }),
  mkTx({ projectName: "マンション改修 足場", ph: { assembly: ph({ work: "confirmed", report: rep("2026-07-09", 2, 2, "組立完了"), bill: "paid", inv: iv(220000, "2026-07-09", "2026-08-31"), pay: pmt("2026-07-11", 220000) }), dismantle: ph() }, timeline: [tl("株式会社みらい足場", "佐藤 誠", "元請が組立完了を確認しました"), tl("東北ハウジング工業", "高橋 亮", "組立分の請求書が提出されました"), tl("株式会社みらい足場", "佐藤 誠", "元請が請求書を確認しました"), tl("株式会社みらい足場", "佐藤 誠", "組立分の支払い済みとして登録されました")] }),
  mkTx({ projectName: "ビル改修 足場", assemblyStart: "2026-06-20", assemblyEnd: "2026-06-21", dismantleStart: "2026-07-12", dismantleEnd: "2026-07-13", ph: { assembly: ph({ work: "confirmed", report: rep("2026-06-20", 2, 2, "組立完了"), bill: "deposited", inv: iv(220000, "2026-06-20", "2026-07-31"), pay: pmt("2026-06-28", 220000), dep: dp("2026-06-28", 220000) }), dismantle: ph({ work: "waiting" }) }, order: { at: "3日前", date: "2026-06-18" }, orderAck: { at: "3日前", date: "2026-06-18" }, timeline: [tl("東北ハウジング工業", "高橋 亮", "組立分の入金を確認しました", "組立分（一部）入金完了"), tl("システム", "自動", "解体予定日が近づいています", "解体日 7/12")] }),
  mkTx({ projectName: "戸建て新築 足場一式", jobType: "contract", payType: "lump", amount: 240000, assemblyAmount: 0, dismantleAmount: 240000, need: null, partnerId: "D", closing: "末締め", payterm: "翌月15日払い", ph: { assembly: ph({ work: "confirmed", report: rep("2026-07-03", 1, 3, "組立完了") }), dismantle: ph({ work: "confirmed", report: rep("2026-07-06", 1, 3, "解体完了"), bill: "invoiced", inv: iv(240000, "2026-07-07", "2026-08-15") }) }, order: { at: "5日前", date: "2026-07-02" }, orderAck: { at: "5日前", date: "2026-07-02" }, timeline: [tl("仙台建装ワークス", "伊藤 学", "解体完了が報告されました"), tl("株式会社みらい足場", "佐藤 誠", "元請が解体完了を確認しました"), tl("仙台建装ワークス", "伊藤 学", "請求書が提出されました", "¥240,000")] }),
  mkTx({ projectName: "工場屋根 足場", ph: { assembly: ph({ work: "confirmed", report: rep("2026-06-18", 2, 2, "組立完了"), bill: "deposited", inv: iv(220000, "2026-06-18", "2026-07-15"), pay: pmt("2026-06-20", 220000), dep: dp("2026-06-20", 220000) }), dismantle: ph({ work: "confirmed", report: rep("2026-06-30", 2, 2, "解体完了"), bill: "paid", inv: iv(220000, "2026-06-30", "2026-07-31"), pay: pmt("2026-07-05", 210000) }) }, issues: [{ by: "東北ハウジング工業", text: "残金の請求22万円に対し入金21万円。差額1万円の確認をお願いします。", resolved: false, date: "2026-07-06" }], consultations: [{ by: "東北ハウジング工業", text: "当事者間で折り合いがつかないため、事実確認をお願いします。", date: "2026-07-07", status: "open" }], timeline: [tl("東北ハウジング工業", "高橋 亮", "確認事項が登録されました", "請求金額と入金額に差額あり"), tl("東北ハウジング工業", "高橋 亮", "運営へ相談しました")] }),
  mkTx({ projectName: "倉庫改修 足場", status: "completed", _onTime: true, _payDays: 30, ph: { assembly: ph({ work: "confirmed", report: rep("2026-05-20", 2, 2, "組立完了"), bill: "deposited", inv: iv(220000, "2026-05-20", "2026-06-30"), pay: pmt("2026-06-18", 220000), dep: dp("2026-06-18", 220000) }), dismantle: ph({ work: "confirmed", report: rep("2026-06-14", 2, 2, "解体完了"), bill: "deposited", inv: iv(220000, "2026-06-14", "2026-06-30"), pay: pmt("2026-06-18", 220000), dep: dp("2026-06-18", 220000) }) }, order: { at: "先月", date: "2026-05-18" }, orderAck: { at: "先月", date: "2026-05-18" }, timeline: [tl("東北ハウジング工業", "高橋 亮", "残金の入金を確認しました"), tl("システム", "自動", "取引が完了しました", "期日内支払い / 平均支払日数 30日")] }),
];
const SEED_CHATS = {
  "p1:B": { primeId: "A", partnerId: "B", title: "マンション改修 足場（組立・解体）", messages: [
    { from: "prime", text: "国分町の現場、8/1組立です。応援2名お願いできますか？", ts: "7/10 9:12" },
    { from: "partner", text: "対応可能です。フルハーネス持参します。単価だけ確認させてください。", ts: "7/10 9:20" },
    { from: "prime", text: "日額22,000円、末締め翌月末払いです。", ts: "7/10 9:25" },
  ] },
  "p1:C": { primeId: "A", partnerId: "C", title: "マンション改修 足場（組立・解体）", messages: [
    { from: "partner", text: "郡山スカイです。8/1は郡山からになりますが可能です。", ts: "7/10 10:02" },
  ] },
};
const PARTNERS = [
  { name: "トーホク仮設資材", cat: "資材", svc: "くさび足場・単管の販売", area: "東北全域", perk: "会員価格10%OFF", certified: true },
  { name: "みちのくレンタル", cat: "レンタル", svc: "高所作業車・発電機レンタル", area: "宮城・福島", perk: "初回50%OFF", certified: true },
  { name: "あんしん保証サービス", cat: "保証", svc: "売掛保証・与信管理", area: "全国", perk: "審査料無料", certified: true },
  { name: "スピード入金ファクタリング", cat: "金融", svc: "請求書の早期現金化", area: "全国", perk: "手数料優遇", certified: false },
  { name: "東北建設保険センター", cat: "保険", svc: "労災・賠償責任保険", area: "東北全域", perk: "一人親方特別加入対応", certified: true },
  { name: "現場会計クラウド", cat: "会計", svc: "建設業向け会計ソフト", area: "全国", perk: "3ヶ月無料", certified: true },
];
const PARTNER_CATS = ["すべて", "資材", "レンタル", "保険", "保証", "金融", "会計"];
const LINE_CATS = ["新着案件", "応募", "採用", "チャット", "組立完了", "解体完了", "是正・手直し", "請求", "支払い", "入金確認", "取引完了"];

/* ============================ 小さなUI ================================== */
function Badge({ children, color = T.blue, bg = T.blueLight, icon }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11.5, fontWeight: 700, color, background: bg, padding: "3px 8px", borderRadius: 999, lineHeight: 1.3, whiteSpace: "nowrap" }}>{icon}{children}</span>;
}
function LevelBadge({ level, size = "sm" }) {
  const L = LEVELS[level] || LEVELS["未認証"], big = size === "lg";
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: big ? 14 : 12, fontWeight: 800, color: L.color, background: L.bg, padding: big ? "6px 12px" : "3px 9px", borderRadius: 999 }}>◆ {level}</span>;
}
function TxPill({ tx, big }) {
  const m = txStatusMeta(tx);
  return <span style={{ display: "inline-flex", fontSize: big ? 14 : 11.5, fontWeight: 800, color: m.color, background: m.bg, padding: big ? "6px 12px" : "3px 8px", borderRadius: 999 }}>{m.label}</span>;
}
function Pill({ label, color = T.blue, bg = T.blueLight }) {
  return <span style={{ display: "inline-flex", fontSize: 11.5, fontWeight: 800, color, background: bg, padding: "3px 8px", borderRadius: 999 }}>{label}</span>;
}
const JobPill = ({ jobType }) => <Pill label={JOBTYPE[jobType]} color={jobType === "contract" ? T.purple : T.blue} bg={jobType === "contract" ? "#EEE9FA" : T.blueLight} />;
const PayPill = ({ payType }) => <Pill label={payType === "progress" ? "出来高" : "一括"} color={payType === "progress" ? T.gold : T.sub} bg={payType === "progress" ? "#FBF2D9" : "#EEF1F5"} />;
function Shield({ size = 14, color = T.green }) {
  return (<svg width={size} height={size} viewBox="0 0 24 24" fill="none"><path d="M12 2l7 3v6c0 4.5-3 8.2-7 9-4-.8-7-4.5-7-9V5l7-3z" fill={color} opacity="0.16" /><path d="M12 2l7 3v6c0 4.5-3 8.2-7 9-4-.8-7-4.5-7-9V5l7-3z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" /><path d="M8.6 12l2.2 2.2 4.4-4.6" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>);
}
const Meta = ({ icon, text }) => <span style={{ fontSize: 12.5, color: T.sub, display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ fontSize: 12 }}>{icon}</span>{text}</span>;
function SectionLabel({ text, right }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "2px 2px 10px" }}><div style={{ display: "flex", alignItems: "center", gap: 8 }}><div style={{ width: 4, height: 15, background: T.blue, borderRadius: 2 }} /><span style={{ fontSize: 14.5, fontWeight: 800 }}>{text}</span></div>{right}</div>;
}
const Card = ({ children, style, onClick }) => <div onClick={onClick} style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 14, ...style }}>{children}</div>;
const InfoRow = ({ label, value }) => <div style={{ display: "flex", padding: "10px 0", borderBottom: `1px solid ${T.line}`, gap: 12 }}><div style={{ width: 96, flexShrink: 0, fontSize: 12.5, color: T.sub, fontWeight: 600 }}>{label}</div><div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.5, flex: 1 }}>{value}</div></div>;
const EmptyState = ({ text }) => <div style={{ textAlign: "center", padding: "44px 20px", color: T.faint }}><div style={{ fontSize: 32, marginBottom: 10 }}>📭</div><div style={{ fontSize: 13.5, lineHeight: 1.6 }}>{text}</div></div>;
const inputBase = { width: "100%", boxSizing: "border-box", border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px", fontSize: 14.5, fontFamily: font, color: T.ink, background: "#fff", outline: "none" };
function Input({ prefix, suffix, ...p }) {
  return <div style={{ position: "relative", display: "flex", alignItems: "center" }}>{prefix && <span style={{ position: "absolute", left: 12, fontSize: 14.5, color: T.sub, fontWeight: 700 }}>{prefix}</span>}<input {...p} style={{ ...inputBase, paddingLeft: prefix ? 28 : 14, paddingRight: suffix ? 34 : 14 }} />{suffix && <span style={{ position: "absolute", right: 12, fontSize: 13, color: T.sub, fontWeight: 700 }}>{suffix}</span>}</div>;
}
const TextArea = (p) => <textarea {...p} rows={3} style={{ ...inputBase, resize: "vertical", lineHeight: 1.6 }} />;
const Select = ({ options, ...p }) => <select {...p} style={{ ...inputBase, appearance: "none" }}>{options.map((o) => <option key={o}>{o}</option>)}</select>;
const Field = ({ label, children, req, opt }) => <div style={{ marginBottom: 13, flex: 1 }}><label style={{ fontSize: 12.5, fontWeight: 700, color: T.sub, display: "block", marginBottom: 6 }}>{label}{req && <span style={{ color: T.red, marginLeft: 4 }}>必須</span>}{opt && <span style={{ color: T.faint, marginLeft: 4, fontWeight: 600 }}>任意</span>}</label>{children}</div>;
function Btn({ children, onClick, variant = "primary", disabled, full }) {
  const styles = { primary: { background: disabled ? "#C4CCDA" : T.blue, color: "#fff", border: "none" }, ghost: { background: "#fff", color: T.sub, border: `1px solid ${T.line}` }, done: { background: T.greenSoft, color: T.green, border: `1px solid ${T.green}` }, warn: { background: "#fff", color: T.amber, border: `1px solid ${T.amber}` }, danger: { background: "#fff", color: T.red, border: `1px solid ${T.red}` } }[variant];
  return <button onClick={disabled ? undefined : onClick} style={{ flex: full ? 1 : undefined, padding: "13px 14px", borderRadius: 13, fontSize: 14.5, fontWeight: 800, cursor: disabled ? "default" : "pointer", ...styles }}>{children}</button>;
}
function Modal({ children, onClose, title }) {
  return <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(20,30,50,0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 60 }}><div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "20px 20px 0 0", padding: 20, width: "100%", maxHeight: "90%", overflowY: "auto" }}>{title && <div style={{ fontSize: 16.5, fontWeight: 800, marginBottom: 14 }}>{title}</div>}{children}</div></div>;
}
function Timeline({ items }) {
  return (<div style={{ position: "relative", paddingLeft: 6 }}>{items.map((it, i) => { const last = i === items.length - 1; return (<div key={i} style={{ display: "flex", gap: 12 }}><div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}><div style={{ width: 12, height: 12, borderRadius: 999, background: last ? T.blue : "#fff", border: `2px solid ${T.blue}`, marginTop: 3, flexShrink: 0 }} />{!last && <div style={{ width: 2, flex: 1, background: T.line, minHeight: 22 }} />}</div><div style={{ paddingBottom: last ? 0 : 16, flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>{it.label}</div><div style={{ fontSize: 11.5, color: T.faint, marginTop: 2 }}>{it.ts} ・ {it.companyName} {it.actor && it.actor !== "自動" ? `（${it.actor}）` : ""}</div>{it.comment && <div style={{ fontSize: 12, color: T.sub, marginTop: 3, background: T.bg, padding: "6px 10px", borderRadius: 8 }}>{it.comment}</div>}</div></div>); })}<div style={{ fontSize: 10.5, color: T.faint, marginTop: 10, paddingLeft: 24 }}>🔒 この履歴は改ざん・削除できない記録として保存されます</div></div>);
}
function PaymentMetrics({ m }) {
  const items = [["取引完了", `${m.completed}件`], ["支払い完了", `${m.paidCount}件`], ["期日内支払い", `${m.onTimeCount}件`], ["支払い遅延", `${m.lateCount}件`], ["未入金", `${m.unpaid}件`], ["期日内支払い率", m.onTimeCount + m.lateCount ? `${onTimeRate(m)}%` : "-"], ["平均支払日数", m.avgPayDays ? `${m.avgPayDays}日` : "-"], ["継続取引会社", `${m.continuous}社`], ["最終取引", m.lastTrade ? dFull(m.lastTrade) : "-"]];
  return (<div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, overflow: "hidden" }}>{items.map(([k, v], i) => (<div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: i < items.length - 1 ? `1px solid ${T.line}` : "none" }}><span style={{ fontSize: 13, color: T.sub, fontWeight: 600 }}>{k}</span><span style={{ fontSize: 13.5, fontWeight: 800, color: k === "支払い遅延" && m.lateCount > 0 ? T.red : T.ink }}>{v}</span></div>))}<div style={{ fontSize: 10.5, color: T.faint, padding: "8px 14px", background: T.bg }}>取引データから自動集計。利用者は編集できません。</div></div>);
}
function FactPanel({ facts }) {
  return (<div>{facts.concerns.length > 0 && (<div style={{ background: T.amberSoft, border: `1px solid ${T.amber}`, borderRadius: 14, padding: 14, marginBottom: 10 }}><div style={{ fontSize: 13, fontWeight: 800, color: "#9A6612", marginBottom: 8 }}>確認事項</div>{facts.concerns.map((f) => <div key={f} style={{ fontSize: 12.5, color: "#7A5410", display: "flex", gap: 6, marginBottom: 4 }}><span>•</span>{f}</div>)}</div>)}<div style={{ background: T.greenSoft, border: `1px solid ${T.green}`, borderRadius: 14, padding: 14 }}><div style={{ fontSize: 13, fontWeight: 800, color: T.green, marginBottom: 8 }}>確認済み情報</div>{facts.positives.map((f) => <div key={f} style={{ fontSize: 12.5, color: "#0E6E48", display: "flex", gap: 6, marginBottom: 4 }}><span>✓</span>{f}</div>)}</div><div style={{ fontSize: 11, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>「安全」「危険」の断定はしません。確認できる事実を並べ、取引の判断はご自身で行ってください。</div></div>);
}
function VerifyBadges({ verify }) {
  const shown = VERIFY_ITEMS.filter((i) => verify[i.key] === "verified");
  return <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{shown.length === 0 && <span style={{ fontSize: 12, color: T.faint }}>確認済みの認証はありません</span>}{shown.map((i) => <Badge key={i.key} color={T.green} bg={T.greenSoft} icon="✓">{i.label.replace("確認", "")}</Badge>)}</div>;
}
const MiniStat = ({ n, label, red }) => <div style={{ textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 900, color: red ? T.red : T.blue }}>{n}</div><div style={{ fontSize: 10.5, color: T.sub, fontWeight: 600 }}>{label}</div></div>;
function Accordion({ title, summary, right, danger, highlight, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);
  const bc = danger ? T.red : highlight ? T.amber : T.line;
  const bar = danger ? T.red : highlight ? T.amber : T.blue;
  return (
    <div style={{ marginBottom: 12, border: `1px solid ${bc}`, borderRadius: 14, background: "#fff", overflow: "hidden" }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "13px 14px", background: highlight ? T.amberSoft : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
        <div style={{ width: 4, height: 15, background: bar, borderRadius: 2, flexShrink: 0 }} />
        <span style={{ fontSize: 14.5, fontWeight: 800, color: danger ? T.red : T.ink }}>{title}</span>
        {highlight && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#8A5A10", background: "#fff", border: `1px solid ${T.amber}`, padding: "1px 7px", borderRadius: 999 }}>要対応</span>}
        <span style={{ flex: 1 }} />
        {summary && <span style={{ fontSize: 11.5, color: T.sub, marginRight: 2, textAlign: "right" }}>{summary}</span>}
        {right}
        <span style={{ color: T.faint, fontSize: 18, transform: open ? "rotate(90deg)" : "none", transition: "transform .15s", display: "inline-block", flexShrink: 0 }}>›</span>
      </button>
      {open && <div style={{ padding: "12px 14px 14px", background: "#fff" }}>{children}</div>}
    </div>
  );
}
function phaseSummary(tx, phk) {
  if (phk === "dismantle" && dismantleLocked(tx)) return "組立完了後";
  const p = tx.ph[phk];
  let s = WORK_JP[p.work];
  if (p.work === "confirmed" && (tx.payType === "progress" || phk === "dismantle")) s = BILL_JP[p.bill];
  return s;
}
/* 自分（role）が今対応すべき操作。あれば要対応としてハイライト＆自動展開 */
function phaseActionForViewer(tx, phk, role) {
  const wa = workAction(tx, phk);
  if (wa) {
    if (wa.kind === "confirm") { if (role === "prime") return { label: `${phJP(phk)}の完了確認 / 是正依頼`, kind: "confirm" }; return null; }
    if (wa.actor === role || wa.actor === "both") return { label: `${phJP(phk)}：${wa.label}`, kind: wa.kind };
    return null;
  }
  const ba = billAction(tx, phk);
  if (ba && (ba.actor === role || ba.actor === "both")) return { label: `${phJP(phk)}：${ba.label}`, kind: ba.kind };
  return null;
}
function docActionForViewer(tx, role) {
  return (role === "prime" && !tx.order) || (role === "partner" && !!tx.order && !tx.orderAck);
}
function pendingActions(tx, role, started) {
  const list = [];
  const acceptPending = tx.ph.assembly.work === "waiting" && !tx.timeline.some((x) => x.label === "取引が開始されました");
  if (acceptPending && role === "partner") list.push("案件を受ける（取引開始）");
  if (started) {
    if (role === "prime" && !tx.order) list.push("注文書を発行");
    if (role === "partner" && tx.order && !tx.orderAck) list.push("注文請書を発行");
    ["assembly", "dismantle"].forEach((phk) => { const a = phaseActionForViewer(tx, phk, role); if (a) list.push(a.label); });
  }
  if (hasOpenIssue(tx)) list.push("確認事項の対応");
  if (tx.scheduleNotice && !tx.scheduleNotice.ack && role === "partner") list.push("工期・予定変更の確認");
  return list;
}

/* =========================================================================
   ルート
   ========================================================================= */
export default function App() {
  const [companies, setCompanies] = useState(SEED_COMPANIES);
  const [projects, setProjects] = useState(SEED_PROJECTS);
  const [txs, setTxs] = useState(SEED_TX);
  const [chats, setChats] = useState(SEED_CHATS);
  const [nav, setNav] = useState({ tab: "home", screen: "home", id: null, back: null });
  const [actingRole, setActingRole] = useState("prime");
  const [lineConnected, setLineConnected] = useState(true);
  const [lineCats, setLineCats] = useState(Object.fromEntries(LINE_CATS.map((c) => [c, true])));
  const [toast, setToast] = useState(null);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(null), 2800); };
  const co = (id) => companies.find((c) => c.id === id);
  const go = (screen, id = null) => setNav((n) => ({ ...n, screen, id }));
  const setTab = (tab) => setNav({ tab, screen: { home: "home", projects: "projectList", tx: "txList", partners: "partners", me: "me" }[tab], id: null, back: null });
  const pushTL = (t, actorId, label, comment) => { const c = co(actorId); return [...t.timeline, tl(c ? c.name : "システム", c ? c.contact : "自動", label, comment)]; };
  const mut = (id, fn, toastMsg) => { setTxs((prev) => prev.map((t) => (t.id === id ? fn(t) : t))); if (toastMsg) showToast(toastMsg); };
  const setPh = (t, phk, patch) => ({ ...t, ph: { ...t.ph, [phk]: { ...t.ph[phk], ...patch } } });

  const openChat = (key, backScreen, backId, primeId, partnerId, title) => {
    setChats((prev) => (prev[key] ? prev : { ...prev, [key]: { primeId, partnerId, title, messages: [] } }));
    setNav((n) => ({ ...n, screen: "chat", id: key, back: { screen: backScreen, id: backId } }));
  };
  const sendChat = (key, from, text) => setChats((prev) => ({ ...prev, [key]: { ...prev[key], messages: [...prev[key].messages, { from, text, ts: nowStamp() }] } }));

  const selectPartner = (projectId, partnerId) => {
    const p = projects.find((x) => x.id === projectId);
    const base = p.jobType === "contract" ? p.price : p.price * (p.need || 2);
    const asm = p.payType === "progress" ? Math.round(base / 2) : 0;
    const key = `${projectId}:${partnerId}`;
    const newTx = {
      id: nid("t"), projectName: p.name, jobType: p.jobType, region: p.region, address: p.address, start: p.start, end: p.end,
      assemblyStart: p.assemblyStart, assemblyEnd: p.assemblyEnd, dismantleStart: p.dismantleStart, dismantleEnd: p.dismantleEnd, need: p.need, amount: base, payType: p.payType,
      assemblyAmount: asm, dismantleAmount: base - asm, closing: p.closing, payterm: p.payterm,
      primeId: p.primeId, partnerId, guaranteed: p.guaranteed, chatKey: key, order: null, orderAck: null, status: null,
      ph: { assembly: ph(), dismantle: ph() }, issues: [], consultations: [], ashibase: null,
      timeline: [tl(co(p.primeId).name, co(p.primeId).contact, "案件が公開されました"), tl(co(partnerId).name, co(partnerId).contact, `${co(partnerId).name}が応募しました`), tl(co(p.primeId).name, co(p.primeId).contact, "協力会社として選定されました")],
    };
    setChats((prev) => (prev[key] ? prev : { ...prev, [key]: { primeId: p.primeId, partnerId, title: p.name, messages: [] } }));
    setTxs((prev) => [newTx, ...prev]);
    setProjects((prev) => prev.map((x) => (x.id === projectId ? { ...x, stage: "matched" } : x)));
    setActingRole("partner");
    setNav((n) => ({ ...n, screen: "txDetail", id: newTx.id }));
    showToast("依頼しました。案件チャットはそのまま継続利用できます");
  };

  const acceptDeal = (id) => mut(id, (t) => ({ ...t, timeline: pushTL(t, t.partnerId, "取引が開始されました") }), "取引を開始しました");
  const startWork = (id, phk, data) => mut(id, (t) => ({ ...setPh(t, phk, { work: "working", startDate: data.date, sessions: [...(t.ph[phk].sessions || []), { date: data.date, kind: "start", people: data.people || null, content: "作業開始" }] }), timeline: pushTL(t, t.partnerId, `${phJP(phk)}作業を開始しました`, `開始日 ${d2(data.date)}${data.people ? ` / ${data.people}名` : ""}`) }), `${phJP(phk)}作業を開始しました`);
  const reportWork = (id, phk, data) => mut(id, (t) => ({ ...setPh(t, phk, { work: "reported", endDate: data.date, report: data }), timeline: pushTL(t, t.partnerId, `${phJP(phk)}完了が報告されました`, `完了日 ${d2(data.date)}${data.people ? ` / ${data.people}名` : ""}`) }), `${phJP(phk)}完了を報告しました`);
  const sessionReport = (id, phk, data) => mut(id, (t) => ({ ...setPh(t, phk, { sessions: [...(t.ph[phk].sessions || []), data] }), timeline: pushTL(t, t.partnerId, `${phJP(phk)}の${data.kind === "start" ? "作業開始" : "作業終了"}が報告されました`, `${d2(data.date)}${data.people ? ` / ${data.people}名` : ""}`) }), `${data.kind === "start" ? "作業開始" : "作業終了"}を報告しました（ステータスは変わりません）`);
  const confirmWork = (id, phk) => mut(id, (t) => ({ ...setPh(t, phk, { work: "confirmed" }), timeline: pushTL(t, t.primeId, `元請が${phJP(phk)}完了を確認しました`) }), `${phJP(phk)}完了を確認しました`);
  const requestRework = (id, phk, text) => mut(id, (t) => ({ ...setPh(t, phk, { work: "rework", rework: { text, date: TODAY } }), timeline: pushTL(t, t.primeId, `${phJP(phk)}の是正・手直しを依頼しました`, text) }), "是正・手直しを依頼しました");
  const reworkDone = (id, phk) => mut(id, (t) => ({ ...setPh(t, phk, { work: "reported" }), timeline: pushTL(t, t.partnerId, `${phJP(phk)}の是正・手直しが完了しました`) }), "是正・手直し完了を報告しました");
  const submitInvoice = (id, phk, data) => mut(id, (t) => ({ ...setPh(t, phk, { bill: "invoiced", inv: data }), timeline: pushTL(t, t.partnerId, `${t.payType === "progress" ? phJP(phk) + "分の" : ""}請求書が提出されました`, `${yen(data.amount)} / 期日 ${d2(data.dueDate)}`) }), "請求書を提出しました");
  const checkInvoice = (id, phk) => mut(id, (t) => ({ ...setPh(t, phk, { bill: "checked" }), timeline: pushTL(t, t.primeId, "元請が請求書を確認しました") }), "請求書を確認しました");
  const registerPayment = (id, phk, data) => mut(id, (t) => ({ ...setPh(t, phk, { bill: "paid", pay: data }), timeline: pushTL(t, t.primeId, `${t.payType === "progress" ? phJP(phk) + "分の" : ""}支払い済みとして登録されました`, yen(data.amount)) }), "支払い済みとして登録しました");

  const updateMetrics = ({ primeId, partnerId, onTime, payDays }) => setCompanies((prev) => prev.map((c) => {
    if (c.id === primeId) { const m = c.metrics, np = m.paidCount + 1, isNew = !m._partners.includes(partnerId); return { ...c, metrics: { ...m, completed: m.completed + 1, paidCount: np, onTimeCount: m.onTimeCount + (onTime ? 1 : 0), lateCount: m.lateCount + (onTime ? 0 : 1), avgPayDays: Math.round((m.avgPayDays * m.paidCount + payDays) / np), lastTrade: TODAY, continuous: m.continuous + (isNew ? 1 : 0), _partners: isNew ? [...m._partners, partnerId] : m._partners } }; }
    if (c.id === partnerId) { const m = c.metrics, isNew = !m._partners.includes(primeId); return { ...c, metrics: { ...m, completed: m.completed + 1, lastTrade: TODAY, continuous: m.continuous + (isNew ? 1 : 0), _partners: isNew ? [...m._partners, primeId] : m._partners } }; }
    return c;
  }));

  const confirmDeposit = (id, phk, data) => {
    const t = txs.find((x) => x.id === id); if (!t) return;
    if (data.diff) { const nt = { ...t, issues: [...t.issues, { by: co(t.partnerId).name, text: `${phJP(phk)}分の入金額 ${yen(data.amount)}。請求額と差額があるため確認をお願いします。`, resolved: false, date: TODAY }], timeline: pushTL(t, t.partnerId, "確認事項が登録されました", `${phJP(phk)}分の入金差額`) }; setTxs((prev) => prev.map((x) => (x.id === id ? nt : x))); showToast("差額を確認事項として登録しました"); return; }
    let nt = { ...setPh(t, phk, { bill: "deposited", dep: data }), timeline: pushTL(t, t.partnerId, `${t.payType === "progress" ? phJP(phk) + "分の" : ""}入金を確認しました`, t.payType === "progress" && phk === "assembly" ? "組立分（一部）入金完了" : null) };
    let mctx = null;
    if (isCompleted(nt)) { const onTime = allOnTime(nt), payDays = avgPay(nt); nt = { ...nt, status: "completed", _onTime: onTime, _payDays: payDays, timeline: [...nt.timeline, tl("システム", "自動", "取引が完了しました", `${onTime ? "期日内支払い" : "支払い遅延"} / 平均支払日数 ${payDays}日`)] }; mctx = { primeId: t.primeId, partnerId: t.partnerId, onTime, payDays }; }
    setTxs((prev) => prev.map((x) => (x.id === id ? nt : x)));
    if (mctx) updateMetrics(mctx);
    showToast(mctx ? "取引が完了し、信用実績を更新しました" : t.payType === "progress" && phk === "assembly" ? "組立分の入金を確認しました" : "入金を確認しました");
  };

  const sendIssue = (id, byRole, text) => { mut(id, (t) => { const byId = byRole === "prime" ? t.primeId : t.partnerId; return { ...t, issues: [...t.issues, { by: co(byId).name, text, resolved: false, date: TODAY }], timeline: pushTL(t, byId, "確認事項が登録されました", text) }; }); showToast("確認事項を送りました"); };
  const resolveIssue = (id) => mut(id, (t) => ({ ...t, issues: t.issues.map((i) => ({ ...i, resolved: true })), timeline: pushTL(t, t.primeId, "確認事項が解決しました") }), "確認事項を解決にしました");
  const consult = (id, byRole, text) => { mut(id, (t) => { const byId = byRole === "prime" ? t.primeId : t.partnerId; return { ...t, consultations: [...(t.consultations || []), { by: co(byId).name, text, date: TODAY, status: "open" }], timeline: pushTL(t, byId, "運営へ相談しました", text) }; }); showToast("運営へ相談しました"); };
  const issueOrder = (id) => mut(id, (t) => ({ ...t, order: { at: nowStamp(), date: TODAY }, timeline: pushTL(t, t.primeId, "注文書を発行しました") }), "注文書を発行しました");
  const ackOrder = (id) => mut(id, (t) => ({ ...t, orderAck: { at: nowStamp(), date: TODAY }, timeline: pushTL(t, t.partnerId, "注文請書を発行しました") }), "注文請書を発行しました");
  const linkAshiBase = (id) => mut(id, (t) => ({ ...t, ashibase: { linked: true, at: nowStamp() } }), "AshiBaseへ連携しました");
  const editSchedule = (id, d) => { mut(id, (t) => {
      const changes = [];
      if (d.start !== t.start || d.end !== t.end) changes.push(`工期 ${d2(t.start)}〜${d2(t.end)} → ${d2(d.start)}〜${d2(d.end)}`);
      if (d.assemblyStart !== t.assemblyStart || d.assemblyEnd !== t.assemblyEnd) changes.push(`組立予定 ${d2(t.assemblyStart)}〜${d2(t.assemblyEnd)} → ${d2(d.assemblyStart)}〜${d2(d.assemblyEnd)}`);
      if (d.dismantleStart !== t.dismantleStart || d.dismantleEnd !== t.dismantleEnd) changes.push(`解体予定 ${d2(t.dismantleStart)}〜${d2(t.dismantleEnd)} → ${d2(d.dismantleStart)}〜${d2(d.dismantleEnd)}`);
      if (changes.length === 0) return t;
      return { ...t, ...d, scheduleNotice: { at: nowStamp(), changes, ack: false }, timeline: pushTL(t, t.primeId, "元請が工期・予定日を変更しました", changes.join(" ／ ")) };
    }, "工期・予定を変更し、協力会社へ通知しました"); };
  const ackSchedule = (id) => mut(id, (t) => ({ ...t, scheduleNotice: t.scheduleNotice ? { ...t.scheduleNotice, ack: true } : null, timeline: pushTL(t, t.partnerId, "協力会社が変更を確認しました") }), "変更を確認しました");

  const cur = txs.find((t) => t.id === nav.id) || null;
  const curP = projects.find((p) => p.id === nav.id) || null;
  const curC = companies.find((c) => c.id === nav.id) || null;
  const ctx = { companies, txs, co, go, showToast };
  const actions = { acceptDeal, startWork, reportWork, sessionReport, confirmWork, requestRework, reworkDone, submitInvoice, checkInvoice, registerPayment, confirmDeposit, sendIssue, resolveIssue, consult, issueOrder, ackOrder, linkAshiBase, editSchedule, ackSchedule, openChat };

  let body;
  if (nav.screen === "home") body = <Home {...ctx} projects={projects} setTab={setTab} />;
  else if (nav.screen === "projectList") body = <ProjectList {...ctx} projects={projects} />;
  else if (nav.screen === "projectDetail" && curP) body = <ProjectDetail {...ctx} project={curP} onSelect={selectPartner} openChat={openChat} />;
  else if (nav.screen === "postJob") body = <PostJob lineConnected={lineConnected} onSubmit={(d) => { setProjects((p) => [{ ...d, id: nid("p"), stage: "recruiting", primeId: SELF_ID, applicants: ["B", "C"], posted: TODAY }, ...p]); setTab("projects"); showToast("案件を公開しました。LINEへ新着通知を送信しました"); }} />;
  else if (nav.screen === "txList") body = <TxList {...ctx} />;
  else if (nav.screen === "txDetail" && cur) body = <TxDetail {...ctx} tx={cur} actingRole={actingRole} setActingRole={setActingRole} actions={actions} />;
  else if (nav.screen === "chat" && chats[nav.id]) body = <Chat chat={chats[nav.id]} chatKey={nav.id} co={co} onSend={sendChat} />;
  else if (nav.screen === "partners") body = <Partners />;
  else if (nav.screen === "companyList") body = <CompanyList {...ctx} />;
  else if (nav.screen === "me") body = <CompanyProfile {...ctx} company={co(SELF_ID)} self go={go} />;
  else if (nav.screen === "company" && curC) body = <CompanyProfile {...ctx} company={curC} go={go} />;
  else if (nav.screen === "verify") body = <VerifyManage company={co(SELF_ID)} />;
  else if (nav.screen === "line") body = <LineSettings connected={lineConnected} setConnected={setLineConnected} cats={lineCats} setCats={setLineCats} />;
  else if (nav.screen === "admin") body = <Admin {...ctx} projects={projects} />;
  else body = <Home {...ctx} projects={projects} setTab={setTab} />;

  const hideNav = ["txDetail", "projectDetail", "chat"].includes(nav.screen);
  return (
    <div style={{ display: "flex", justifyContent: "center", background: "#DCE2ED", padding: "16px 0", fontFamily: font, color: T.ink }}>
      <div style={{ width: 390, maxWidth: "100%", height: 820, background: T.bg, borderRadius: 28, overflow: "hidden", position: "relative", boxShadow: "0 12px 40px rgba(20,40,80,.18)", display: "flex", flexDirection: "column" }}>
        <Header nav={nav} go={go} curC={curC} chats={chats} />
        <div style={{ flex: 1, overflowY: "auto" }}>{body}</div>
        {!hideNav && <BottomNav tab={nav.tab} setTab={setTab} />}
        {toast && <div style={{ position: "absolute", left: 14, right: 14, bottom: hideNav ? 74 : 82, background: T.ink, color: "#fff", padding: "12px 16px", borderRadius: 14, fontSize: 13, fontWeight: 600, display: "flex", gap: 8, alignItems: "center", boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}><span style={{ color: "#7CE0AE" }}>✓</span>{toast}</div>}
      </div>
    </div>
  );
}

function Header({ nav, go, curC, chats }) {
  const titles = { home: "足場信用プラットフォーム", projectList: "案件", projectDetail: "案件詳細", postJob: "案件を投稿", txList: "取引管理", txDetail: "取引詳細", partners: "パートナー", companyList: "登録会社一覧", me: "自社プロフィール", company: curC ? curC.name : "会社", verify: "認証管理", line: "LINE連携", admin: "運営管理", chat: chats[nav.id] ? "案件チャット" : "チャット" };
  const staticBack = { projectDetail: "projectList", txDetail: "txList", company: "companyList", verify: "me", line: "me", admin: "me", postJob: "projectList", companyList: "home" };
  const onBack = () => { if (nav.screen === "chat" && nav.back) go(nav.back.screen, nav.back.id); else go(staticBack[nav.screen]); };
  const canBack = nav.screen === "chat" ? !!nav.back : !!staticBack[nav.screen];
  return (
    <div style={{ background: T.blue, color: "#fff", padding: "13px 16px", display: "flex", alignItems: "center", gap: 10, minHeight: 52 }}>
      {canBack ? <button onClick={onBack} style={{ background: "rgba(255,255,255,.15)", border: "none", color: "#fff", width: 30, height: 30, borderRadius: 999, fontSize: 16, cursor: "pointer" }}>‹</button> : <div style={{ width: 30, height: 30, borderRadius: 8, background: "rgba(255,255,255,.18)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>足</div>}
      <div style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>{titles[nav.screen] || "足場信用プラットフォーム"}</div>
    </div>
  );
}
function BottomNav({ tab, setTab }) {
  const items = [{ key: "home", label: "ホーム", icon: "⌂" }, { key: "projects", label: "案件", icon: "▤" }, { key: "tx", label: "取引", icon: "⇄" }, { key: "partners", label: "パートナー", icon: "◈" }, { key: "me", label: "自社", icon: "◎" }];
  return <div style={{ display: "flex", background: "#fff", borderTop: `1px solid ${T.line}`, padding: "8px 4px 10px" }}>{items.map((it) => { const active = tab === it.key; return <button key={it.key} onClick={() => setTab(it.key)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, border: "none", background: "transparent", cursor: "pointer", color: active ? T.blue : T.faint }}><span style={{ fontSize: 18, lineHeight: 1 }}>{it.icon}</span><span style={{ fontSize: 10, fontWeight: active ? 800 : 600 }}>{it.label}</span></button>; })}</div>;
}

function Home({ projects, txs, co, go, setTab }) {
  const recruiting = projects.filter((p) => p.stage === "recruiting");
  const inProgress = txs.filter((t) => ["active", "billing", "rework"].includes(txCategory(t)));
  const depositWait = txs.filter((t) => depositPending(t) && t.status !== "completed");
  const needCheck = txs.filter((t) => txCategory(t) === "issue");
  const Alert = ({ n, label, color, bg }) => <button onClick={() => setTab("tx")} style={{ flex: 1, background: bg, border: `1px solid ${color}22`, borderRadius: 14, padding: "12px 8px", cursor: "pointer", textAlign: "center" }}><div style={{ fontSize: 22, fontWeight: 900, color }}>{n}</div><div style={{ fontSize: 10.5, color: T.sub, fontWeight: 700, marginTop: 2 }}>{label}</div></button>;
  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: `linear-gradient(135deg,${T.blue},${T.blueDark})`, color: "#fff", borderRadius: 18, padding: "16px 18px", marginBottom: 16 }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><Shield size={18} color="#fff" /><span style={{ fontSize: 13, fontWeight: 800 }}>事実で信用を積むプラットフォーム</span></div><div style={{ fontSize: 12.5, lineHeight: 1.55, opacity: 0.95 }}>組立・解体・是正・支払い・入金の記録が、そのまま会社の信用になります。募集はLINE、正式な取引と記録はここで。</div></div>
      <SectionLabel text="対応が必要な取引" />
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}><Alert n={inProgress.length} label="取引中" color={T.blue} bg={T.blueSoft} /><Alert n={depositWait.length} label="入金確認待ち" color={T.amber} bg={T.amberSoft} /><Alert n={needCheck.length} label="確認事項" color={T.red} bg={T.redSoft} /></div>
      <SectionLabel text="新着案件" right={<button onClick={() => setTab("projects")} style={{ border: "none", background: "none", color: T.blue, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>すべて見る ›</button>} />
      {recruiting.map((p) => <ProjectCard key={p.id} p={p} co={co} txs={txs} go={go} />)}
      <div style={{ height: 8 }} />
      <button onClick={() => go("companyList")} style={{ width: "100%", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 12 }}><div style={{ width: 40, height: 40, borderRadius: 10, background: T.blueLight, color: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>◎</div><div style={{ flex: 1, textAlign: "left" }}><div style={{ fontSize: 13.5, fontWeight: 800 }}>登録会社一覧</div><div style={{ fontSize: 11.5, color: T.sub }}>各社の信用レベル・支払い実績・認証を確認</div></div><span style={{ color: T.blue }}>›</span></button>
    </div>
  );
}

function ProjectCard({ p, co, txs, go }) {
  const prime = co(p.primeId);
  return (
    <button onClick={() => go("projectDetail", p.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 14, marginBottom: 12, cursor: "pointer" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8, alignItems: "center" }}><Pill label={p.stage === "recruiting" ? "募集中" : "選定済み"} /><JobPill jobType={p.jobType} /><PayPill payType={p.payType} />{p.guaranteed && <Badge color={T.green} bg={T.greenSoft} icon={<Shield size={11} />}>売掛保証つき</Badge>}<span style={{ marginLeft: "auto" }}><LevelBadge level={creditLevel(prime, txs)} /></span></div>
      <div style={{ fontSize: 15.5, fontWeight: 800, marginBottom: 8 }}>{p.name}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px", marginBottom: 10 }}><Meta icon="📍" text={p.region} /><Meta icon="🗓" text={`組立${d2(p.assemblyStart)}・解体${d2(p.dismantleStart)}`} />{p.need ? <Meta icon="👷" text={`${p.need}名`} /> : null}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${T.line}`, paddingTop: 10 }}><div><span style={{ fontSize: 19, fontWeight: 900, color: T.blue }}>{yen(p.price)}</span><span style={{ fontSize: 11.5, color: T.sub, marginLeft: 4 }}>{p.jobType === "contract" ? "請負金額" : "日額/人工"}</span></div><span style={{ fontSize: 13, color: T.blue, fontWeight: 700 }}>詳細 ›</span></div>
    </button>
  );
}
function ProjectList({ projects, co, txs, go }) {
  return (<div style={{ padding: 16 }}><button onClick={() => go("postJob")} style={{ width: "100%", padding: 14, borderRadius: 14, border: `1.5px dashed ${T.blue}`, background: T.blueSoft, color: T.blue, fontSize: 14.5, fontWeight: 800, cursor: "pointer", marginBottom: 16 }}>＋ 案件を投稿する</button>{projects.length === 0 ? <EmptyState text="案件はまだありません" /> : projects.map((p) => <ProjectCard key={p.id} p={p} co={co} txs={txs} go={go} />)}</div>);
}
function ProjectDetail({ project: p, co, txs, go, onSelect, openChat }) {
  const prime = co(p.primeId), pFacts = companyFacts(prime, txs);
  return (
    <div style={{ paddingBottom: 24 }}>
      <div style={{ height: 130, background: `linear-gradient(135deg,${T.blueSoft},${T.blueLight})`, display: "flex", alignItems: "center", justifyContent: "center", color: T.blue, fontWeight: 700 }}>📷 現場写真</div>
      <div style={{ padding: 16 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}><Pill label={p.stage === "recruiting" ? "募集中" : "選定済み"} /><JobPill jobType={p.jobType} /><PayPill payType={p.payType} />{p.guaranteed && <Badge color={T.green} bg={T.greenSoft} icon={<Shield size={11} />}>売掛保証つき</Badge>}</div>
        <h2 style={{ fontSize: 19, fontWeight: 900, margin: "0 0 4px", lineHeight: 1.4 }}>{p.name}</h2>
        <div style={{ fontSize: 12, color: T.faint, marginBottom: 16 }}>{d2(p.posted)}投稿 ・ 募集締切 {d2(p.deadline)}</div>
        <Card style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}><div><div style={{ fontSize: 11.5, color: T.sub, fontWeight: 600 }}>{p.jobType === "contract" ? "請負金額" : "単価"}</div><div><span style={{ fontSize: 26, fontWeight: 900, color: T.blue }}>{yen(p.price)}</span><span style={{ fontSize: 12, color: T.sub, marginLeft: 5 }}>{p.jobType === "contract" ? "一式" : "日額/人工"}</span></div></div><div style={{ textAlign: "right" }}><div style={{ fontSize: 11.5, color: T.sub, fontWeight: 600 }}>募集人数</div><div style={{ fontSize: 22, fontWeight: 900 }}>{p.need ? `${p.need}名` : "―"}</div></div></Card>
        <SectionLabel text="元請会社の信用" right={<button onClick={() => go("company", prime.id)} style={{ border: "none", background: "none", color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>詳細 ›</button>} />
        <Card style={{ marginBottom: 12 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}><span style={{ fontSize: 15, fontWeight: 800 }}>{prime.name}</span><LevelBadge level={creditLevel(prime, txs)} /></div><div style={{ display: "flex", gap: 14, marginBottom: 12 }}><MiniStat n={`${prime.metrics.completed}`} label="取引完了" /><MiniStat n={`${prime.metrics.onTimeCount}`} label="期日内支払い" /><MiniStat n={`${prime.metrics.lateCount}`} label="遅延" red={prime.metrics.lateCount > 0} /></div><VerifyBadges verify={prime.verify} /></Card>
        <div style={{ marginBottom: 16 }}><FactPanel facts={pFacts} /></div>
        <SectionLabel text="仕事内容" /><p style={{ fontSize: 13.5, lineHeight: 1.7, margin: "0 0 16px" }}>{p.work}</p>
        <SectionLabel text="募集要項" /><Card style={{ padding: "2px 14px", marginBottom: 20 }}><InfoRow label="種別" value={JOBTYPE[p.jobType]} /><InfoRow label="現場住所" value={p.address} /><InfoRow label="工期" value={`${d2(p.start)} 〜 ${d2(p.end)}`} /><InfoRow label="組立予定" value={`${d2(p.assemblyStart)} 〜 ${d2(p.assemblyEnd)}`} /><InfoRow label="解体予定" value={`${d2(p.dismantleStart)} 〜 ${d2(p.dismantleEnd)}`} /><InfoRow label="持ち物" value={p.belongings} /><InfoRow label="支払条件" value={`${p.closing}${p.payterm}（${p.payType === "progress" ? "出来高" : "一括"}）`} /></Card>
        {p.stage === "recruiting" && (
          <>
            <SectionLabel text={`応募者（${p.applicants.length}社）`} />
            <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 10 }}>依頼前に応募者と案件チャットで打合せできます。依頼後もそのまま継続します。</div>
            {p.applicants.map((aid) => { const a = co(aid); return (<Card key={aid} style={{ marginBottom: 10 }}><div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}><div><div style={{ fontSize: 14.5, fontWeight: 800 }}>{a.name}</div><div style={{ fontSize: 11.5, color: T.sub }}>{a.region} ・ 取引{a.metrics.completed}件</div></div><LevelBadge level={creditLevel(a, txs)} /></div><div style={{ marginBottom: 10 }}><VerifyBadges verify={a.verify} /></div><div style={{ display: "flex", gap: 8 }}><Btn variant="ghost" onClick={() => openChat(`${p.id}:${aid}`, "projectDetail", p.id, p.primeId, aid, p.name)}>打合せチャット</Btn><Btn full onClick={() => onSelect(p.id, aid)}>この会社に依頼</Btn></div></Card>); })}
          </>
        )}
      </div>
    </div>
  );
}
function PostJob({ onSubmit, lineConnected }) {
  const [f, setF] = useState({ name: "", jobType: "support", region: "", address: "", start: "", end: "", assemblyStart: "", assemblyEnd: "", dismantleStart: "", dismantleEnd: "", need: "", price: "", payType: "progress", closing: "末締め", payterm: "翌月末払い", work: "", belongings: "ヘルメット・フルハーネス・安全靴", deadline: "", guaranteed: true });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valid = f.name && f.region && f.start && f.end && f.price;
  return (
    <div style={{ padding: 16, paddingBottom: 30 }}>
      <div style={{ background: T.blueSoft, border: `1px solid ${T.blueLight}`, borderRadius: 14, padding: 12, fontSize: 12.5, color: T.sub, lineHeight: 1.6, marginBottom: 18 }}>公開すると{lineConnected ? "LINEグループへ新着通知が届きます。" : "（LINE未連携）"}募集の入口はLINE、正式な取引はこのアプリで記録します。</div>
      <Field label="案件種別" req>
        <div style={{ display: "flex", background: T.bg, borderRadius: 10, padding: 3 }}>{[["support", "応援（人工）"], ["contract", "請負（一式）"]].map(([k, l]) => <button key={k} onClick={() => setF({ ...f, jobType: k })} style={{ flex: 1, padding: "9px 6px", borderRadius: 8, border: "none", background: f.jobType === k ? T.blue : "transparent", color: f.jobType === k ? "#fff" : T.sub, fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>{l}</button>)}</div>
      </Field>
      <Field label="案件名" req><Input value={f.name} onChange={set("name")} placeholder="例）マンション改修 足場（組立・解体）" /></Field>
      <div style={{ display: "flex", gap: 10 }}><Field label="地域" req><Input value={f.region} onChange={set("region")} placeholder="宮城県 仙台市" /></Field><Field label="募集人数" opt><Input value={f.need} onChange={set("need")} type="number" suffix="名" placeholder="任意" /></Field></div>
      <Field label="現場住所"><Input value={f.address} onChange={set("address")} /></Field>
      <div style={{ display: "flex", gap: 10 }}><Field label="工期開始" req><Input value={f.start} onChange={set("start")} type="date" /></Field><Field label="工期終了" req><Input value={f.end} onChange={set("end")} type="date" /></Field></div>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.sub, marginBottom: 6 }}>組立の予定</div>
      <div style={{ display: "flex", gap: 10 }}><Field label="組立 開始予定"><Input value={f.assemblyStart} onChange={set("assemblyStart")} type="date" /></Field><Field label="組立 完了予定"><Input value={f.assemblyEnd} onChange={set("assemblyEnd")} type="date" /></Field></div>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.sub, marginBottom: 6 }}>解体の予定</div>
      <div style={{ display: "flex", gap: 10 }}><Field label="解体 開始予定"><Input value={f.dismantleStart} onChange={set("dismantleStart")} type="date" /></Field><Field label="解体 完了予定"><Input value={f.dismantleEnd} onChange={set("dismantleEnd")} type="date" /></Field></div>
      <div style={{ fontSize: 11, color: T.sub, marginTop: -6, marginBottom: 12 }}>※ 組立分の入金前に解体日が到来してもかまいません（組立と解体は独立して進行します）。開始・完了は実績を作業報告で記録し、AshiBase勤怠へ連携できます。</div>
      <Field label={f.jobType === "contract" ? "請負金額（円）" : "単価（日額・円）"} req><Input value={f.price} onChange={set("price")} type="number" prefix="¥" /></Field>
      <Field label="支払い方式" req>
        <div style={{ display: "flex", background: T.bg, borderRadius: 10, padding: 3, marginBottom: 8 }}>{[["progress", "出来高（組立/解体）"], ["lump", "一括"]].map(([k, l]) => <button key={k} onClick={() => setF({ ...f, payType: k })} style={{ flex: 1, padding: "9px 6px", borderRadius: 8, border: "none", background: f.payType === k ? T.blue : "transparent", color: f.payType === k ? "#fff" : T.sub, fontSize: 12.5, fontWeight: 800, cursor: "pointer" }}>{l}</button>)}</div>
        <div style={{ display: "flex", gap: 10 }}><Field label="締め日"><Select value={f.closing} onChange={set("closing")} options={CLOSING} /></Field><Field label="支払日"><Select value={f.payterm} onChange={set("payterm")} options={PAYTERM} /></Field></div>
      </Field>
      <Field label="仕事内容"><TextArea value={f.work} onChange={set("work")} /></Field>
      <Field label="募集締切"><Input value={f.deadline} onChange={set("deadline")} type="date" /></Field>
      <button onClick={() => setF({ ...f, guaranteed: !f.guaranteed })} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, background: f.guaranteed ? T.greenSoft : "#fff", border: `1px solid ${f.guaranteed ? T.green : T.line}`, borderRadius: 14, padding: 14, margin: "6px 0 20px", cursor: "pointer", textAlign: "left" }}><Shield size={22} /><div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 800 }}>売掛保証をつける</div><div style={{ fontSize: 11.5, color: T.sub }}>保証会社と連携予定（表示のみ）</div></div><div style={{ width: 44, height: 26, borderRadius: 999, background: f.guaranteed ? T.green : T.line, position: "relative" }}><div style={{ width: 20, height: 20, borderRadius: 999, background: "#fff", position: "absolute", top: 3, left: f.guaranteed ? 21 : 3, transition: "left .2s" }} /></div></button>
      <Btn full disabled={!valid} onClick={() => valid && onSubmit({ name: f.name, jobType: f.jobType, region: f.region, address: f.address || "（後日連絡）", start: f.start, end: f.end, assemblyStart: f.assemblyStart || f.start, assemblyEnd: f.assemblyEnd || f.assemblyStart || f.start, dismantleStart: f.dismantleStart || f.end, dismantleEnd: f.dismantleEnd || f.dismantleStart || f.end, need: f.need ? Number(f.need) : null, price: Number(f.price), payType: f.payType, closing: f.closing, payterm: f.payterm, work: f.work || "詳細はチャットにて。", belongings: f.belongings, deadline: f.deadline || f.start, guaranteed: f.guaranteed })}>案件を公開してLINEへ通知</Btn>
    </div>
  );
}

/* =========================================================================
   取引管理
   ========================================================================= */
const TX_TABS = [{ key: "active", label: "取引中" }, { key: "rework", label: "是正・手直し" }, { key: "billing", label: "請求・入金" }, { key: "issue", label: "確認事項" }, { key: "completed", label: "取引完了" }];
function TxList({ txs, co, go }) {
  const [tab, setTab] = useState("active");
  const shown = txs.filter((t) => txCategory(t) === tab);
  return (
    <div>
      <div style={{ display: "flex", gap: 8, padding: "12px 16px 4px", overflowX: "auto", background: "#fff", borderBottom: `1px solid ${T.line}` }}>{TX_TABS.map((x) => { const active = tab === x.key, count = txs.filter((z) => txCategory(z) === x.key).length; return <button key={x.key} onClick={() => setTab(x.key)} style={{ border: "none", background: "none", padding: "6px 4px 10px", borderBottom: `2px solid ${active ? T.blue : "transparent"}`, color: active ? T.blue : T.faint, fontSize: 13, fontWeight: active ? 800 : 600, whiteSpace: "nowrap", cursor: "pointer" }}>{x.label}{count > 0 && <span style={{ marginLeft: 3, fontSize: 11 }}>{count}</span>}</button>; })}</div>
      <div style={{ padding: 16 }}>{shown.length === 0 ? <EmptyState text="この状態の取引はありません" /> : shown.map((x) => <TxCard key={x.id} tx={x} co={co} go={go} />)}</div>
    </div>
  );
}
function TxCard({ tx, co, go }) {
  const partner = co(tx.partnerId), prime = co(tx.primeId);
  return (
    <button onClick={() => go("txDetail", tx.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "#fff", border: `1px solid ${hasOpenIssue(tx) ? T.red : T.line}`, borderRadius: 16, padding: 14, marginBottom: 12, cursor: "pointer" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}><TxPill tx={tx} /><JobPill jobType={tx.jobType} /><PayPill payType={tx.payType} /></div><span style={{ fontSize: 16, fontWeight: 900, color: T.blue }}>{yen(tx.amount)}</span></div>
      <div style={{ fontSize: 14.5, fontWeight: 800, marginBottom: 6 }}>{tx.projectName}</div>
      <div style={{ fontSize: 12, color: T.sub, marginBottom: 8 }}>元請 {prime.name} ／ 協力 {partner.name}</div>
      <div style={{ fontSize: 12, background: txStatusMeta(tx).bg, color: txStatusMeta(tx).color, padding: "6px 10px", borderRadius: 8, fontWeight: 700 }}>{nextHint(tx)}</div>
    </button>
  );
}
function RoleSwitch({ role, setRole, prime, partner }) {
  return (<div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 12, marginBottom: 12 }}><div style={{ fontSize: 11.5, color: T.sub, fontWeight: 700, marginBottom: 8 }}>プロトタイプ：操作する立場を切り替えて双方を体験</div><div style={{ display: "flex", background: T.bg, borderRadius: 10, padding: 3 }}>{[["prime", `元請（${prime.name}）`], ["partner", `協力（${partner.name}）`]].map(([k, l]) => <button key={k} onClick={() => setRole(k)} style={{ flex: 1, padding: "9px 6px", borderRadius: 8, border: "none", background: role === k ? T.blue : "transparent", color: role === k ? "#fff" : T.sub, fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>{l}</button>)}</div></div>);
}

function PhasePanel({ tx, phk, actingRole, actions, setModal }) {
  const p = tx.ph[phk];
  const locked = phk === "dismantle" && dismantleLocked(tx);
  const wa = workAction(tx, phk);
  const ba = billAction(tx, phk);
  const amt = phaseAmount(tx, phk);
  const planStart = phk === "assembly" ? tx.assemblyStart : tx.dismantleStart;
  const planEnd = phk === "assembly" ? tx.assemblyEnd : tx.dismantleEnd;
  const canWork = wa && (wa.actor === actingRole || wa.actor === "both");
  const multiDay = phaseMultiDay(tx, phk);
  const canBill = ba && (ba.actor === actingRole || ba.actor === "both");
  const gate = (a) => (a.actor === "prime" ? "元請" : "協力会社");
  const action = phaseActionForViewer(tx, phk, actingRole);
  const highlight = !!action;
  const [open, setOpen] = useState(highlight);
  return (
    <Card style={{ marginBottom: 12, padding: 0, opacity: locked ? 0.7 : 1, border: `1px solid ${highlight ? T.amber : T.line}` }}>
      <button onClick={() => setOpen((o) => !o)} style={{ width: "100%", display: "flex", alignItems: "center", gap: 8, padding: "13px 14px", background: highlight ? T.amberSoft : "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: T.blueLight, color: T.blue, display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 13, flexShrink: 0 }}>{phk === "assembly" ? "組" : "解"}</span>
        <span style={{ fontSize: 15, fontWeight: 800 }}>{phJP(phk)}</span>
        {highlight && <span style={{ fontSize: 10.5, fontWeight: 800, color: "#8A5A10", background: "#fff", border: `1px solid ${T.amber}`, padding: "1px 7px", borderRadius: 999 }}>要対応</span>}
        <span style={{ flex: 1 }} />
        <span style={{ fontSize: 11.5, fontWeight: 700, color: p.work === "confirmed" ? T.green : p.work === "rework" ? T.red : T.sub }}>{phaseSummary(tx, phk)}</span>
        <span style={{ color: T.faint, fontSize: 18, transform: open ? "rotate(90deg)" : "none", display: "inline-block", flexShrink: 0 }}>›</span>
      </button>
      {open && (
        <div style={{ padding: "0 14px 14px" }}>
          <div style={{ fontSize: 11.5, color: T.sub, marginBottom: 10 }}>予定 {d2(planStart)}〜{d2(planEnd)}</div>
          {action && <div style={{ background: T.amberSoft, border: `1px solid ${T.amber}`, borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 700, color: "#8A5A10", marginBottom: 10 }}>あなたの操作：{action.label}</div>}
      {locked ? (
        <div style={{ fontSize: 12.5, color: T.faint, background: T.bg, padding: "10px 12px", borderRadius: 10 }}>組立完了の確認後に、解体を開始できます。</div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 8 }}><span style={{ color: T.sub, fontWeight: 700 }}>作業</span><span style={{ fontWeight: 800, color: p.work === "confirmed" ? T.green : p.work === "rework" ? T.red : T.blue }}>{WORK_JP[p.work]}</span></div>
          {p.work === "rework" && p.rework && (
            <div style={{ background: T.redSoft, border: `1px solid ${T.red}`, borderRadius: 10, padding: 10, marginBottom: 8 }}><div style={{ fontSize: 12, fontWeight: 800, color: T.red, marginBottom: 3 }}>是正・手直し依頼</div><div style={{ fontSize: 12, color: T.ink, lineHeight: 1.5 }}>{p.rework.text}</div></div>
          )}
          {wa && wa.kind === "confirm" ? (
            actingRole === "prime" ? (
              <div style={{ display: "flex", gap: 8, marginBottom: p.report ? 10 : 0 }}><Btn variant="done" full onClick={() => actions.confirmWork(tx.id, phk)}>{phJP(phk)}完了を確認</Btn><Btn variant="warn" full onClick={() => setModal({ kind: "rework", phk })}>是正・手直しを依頼</Btn></div>
            ) : <div style={{ fontSize: 12.5, color: T.sub, background: T.bg, padding: "10px 12px", borderRadius: 10, marginBottom: p.report ? 10 : 0 }}>元請の完了確認待ちです。</div>
          ) : wa && wa.kind === "reportWork" ? (
            canWork ? (
              multiDay ? (
                <div>
                  <div style={{ display: "flex", gap: 8, marginBottom: 8 }}><Btn variant="ghost" full onClick={() => setModal({ kind: "session", phk, sess: "start" })}>作業開始を報告</Btn><Btn variant="ghost" full onClick={() => setModal({ kind: "session", phk, sess: "end" })}>作業終了を報告</Btn></div>
                  <Btn full onClick={() => setModal({ kind: "report", phk })}>{wa.label}</Btn>
                </div>
              ) : <Btn full onClick={() => setModal({ kind: "report", phk })}>{wa.label}</Btn>
            ) : <div style={{ fontSize: 12.5, color: T.sub, background: T.bg, padding: "10px 12px", borderRadius: 10 }}>{gate(wa)}の操作待ちです（立場を切り替えて体験できます）。</div>
          ) : wa ? (
            canWork ? <Btn full onClick={() => (wa.kind === "startWork" ? setModal({ kind: "start", phk }) : actions.reworkDone(tx.id, phk))}>{wa.label}</Btn>
              : <div style={{ fontSize: 12.5, color: T.sub, background: T.bg, padding: "10px 12px", borderRadius: 10 }}>{gate(wa)}の操作待ちです（立場を切り替えて体験できます）。</div>
          ) : null}
          {multiDay && wa && wa.kind === "reportWork" && <div style={{ fontSize: 10.5, color: T.faint, marginTop: 6 }}>複数日の工期です。日々の開始・終了は「作業開始/作業終了を報告」（ステータスは変わりません）、全て終わったら「完了を報告」してください。</div>}
          {p.sessions && p.sessions.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: T.sub, marginBottom: 4 }}>作業開始・終了（日次）</div>
              {p.sessions.map((s, i) => <div key={i} style={{ fontSize: 12, color: T.sub, background: T.bg, borderRadius: 8, padding: "6px 10px", marginBottom: 4 }}><span style={{ fontWeight: 800, color: s.kind === "start" ? T.blue : T.green }}>{s.kind === "start" ? "開始" : "終了"}</span> {d2(s.date)}{s.people ? `・${s.people}名` : ""}{s.content ? ` ／ ${s.content}` : ""}</div>)}
              <div style={{ fontSize: 10.5, color: T.faint }}>⇆ 各日の開始・終了はAshiBase勤怠へ連携できます</div>
            </div>
          )}
          {(p.startDate || p.endDate) && (
            <div style={{ marginTop: 10, background: T.bg, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: T.sub, lineHeight: 1.7 }}>
              <div>実績　開始 {p.startDate ? d2(p.startDate) : "―"} ／ 完了 {p.endDate ? d2(p.endDate) : "―"}</div>
              {p.report && <div>{p.report.days}日{p.report.people ? `・${p.report.people}名` : ""} ／ {p.report.content}</div>}
              <div style={{ fontSize: 10.5, color: T.faint, marginTop: 2 }}>⇆ この開始・完了・人数はAshiBase勤怠へ連携できます</div>
            </div>
          )}
          {p.work === "confirmed" && (tx.payType === "progress" || phk === "dismantle") && (
            <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 12, paddingTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 8 }}><span style={{ color: T.sub, fontWeight: 700 }}>{tx.payType === "progress" ? (phk === "assembly" ? "組立分の請求・入金" : "残金の請求・入金") : "請求・入金"}（{yen(amt)}）</span><span style={{ fontWeight: 800, color: p.bill === "deposited" ? T.green : T.amber }}>{BILL_JP[p.bill]}</span></div>
              {ba && (canBill ? <Btn full onClick={() => (ba.kind === "invoice" ? setModal({ kind: "invoice", phk }) : ba.kind === "checkInvoice" ? actions.checkInvoice(tx.id, phk) : ba.kind === "payment" ? setModal({ kind: "payment", phk }) : setModal({ kind: "deposit", phk }))}>{ba.label}</Btn>
                : <div style={{ fontSize: 12.5, color: T.sub, background: T.bg, padding: "10px 12px", borderRadius: 10 }}>{gate(ba)}の操作待ちです。</div>)}
              {p.bill === "paid" && <div style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>支払い登録だけでは完了しません。協力会社の入金確認が必要です（二者確認）。</div>}
              {p.inv && <div style={{ fontSize: 12, color: T.sub, marginTop: 8 }}>請求 {yen(p.inv.amount)}（{d2(p.inv.date)}）／ 期日 {d2(p.inv.dueDate)}{p.pay ? ` ／ 支払 ${d2(p.pay.date)}（${daysBetween(p.inv.dueDate, p.pay.date) <= 0 ? "期日内" : "遅延"}）` : ""}{p.dep ? " ／ 入金確認済" : ""}</div>}
            </div>
          )}
          {tx.payType === "lump" && phk === "assembly" && p.work === "confirmed" && <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 12, paddingTop: 12, fontSize: 12, color: T.faint }}>一括請求のため、解体完了後にまとめて請求します。</div>}
        </>
      )}
        </div>
      )}
    </Card>
  );
}

function TxDetail({ tx, co, actingRole, setActingRole, actions }) {
  const [modal, setModal] = useState(null);
  const prime = co(tx.primeId), partner = co(tx.partnerId);
  const openIssue = hasOpenIssue(tx);
  const meta = txStatusMeta(tx);
  const started = tx.timeline.some((x) => x.label === "取引が開始されました") || tx.ph.assembly.work !== "waiting" || tx.status === "completed";
  const pend = pendingActions(tx, actingRole, started);
  return (
    <div style={{ padding: 16, paddingBottom: 30 }}>
      <div style={{ background: "#EEF2FB", border: `1px solid ${T.blueLight}`, borderRadius: 12, padding: "10px 12px", fontSize: 11.5, color: T.sub, marginBottom: 12, lineHeight: 1.5 }}>🔒 この取引の詳細は<b>関係者（元請・協力会社・運営）のみ</b>が閲覧できます。他社には公開されません。</div>
      <RoleSwitch role={actingRole} setRole={setActingRole} prime={prime} partner={partner} />
      <div style={{ background: meta.bg, borderRadius: 16, padding: 16, marginBottom: 12, textAlign: "center" }}><div style={{ fontSize: 12, color: meta.color, fontWeight: 700, marginBottom: 4 }}>現在のステータス</div><div style={{ fontSize: 21, fontWeight: 900, color: meta.color }}>{meta.label}</div><div style={{ fontSize: 12.5, color: T.sub, marginTop: 6 }}>{nextHint(tx)}</div></div>
      {pend.length > 0 && (
        <div style={{ background: T.amberSoft, border: `1px solid ${T.amber}`, borderRadius: 14, padding: 14, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}><span style={{ fontSize: 13.5, fontWeight: 800, color: "#8A5A10" }}>あなたの操作（要対応）</span><span style={{ fontSize: 10.5, fontWeight: 800, color: "#8A5A10", background: "#fff", border: `1px solid ${T.amber}`, padding: "1px 7px", borderRadius: 999 }}>{pend.length}件</span></div>
          {pend.map((x, i) => <div key={i} style={{ fontSize: 12.5, color: "#7A5410", display: "flex", gap: 6, lineHeight: 1.7 }}><span style={{ fontWeight: 800 }}>›</span>{x}</div>)}
          <div style={{ fontSize: 10.5, color: "#9A6612", marginTop: 6 }}>該当セクションは下で自動的に開いています。</div>
        </div>
      )}
      {tx.scheduleNotice && !tx.scheduleNotice.ack && actingRole === "partner" && (
        <div style={{ background: T.amberSoft, border: `1px solid ${T.amber}`, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#8A5A10", marginBottom: 6 }}>元請により工期・予定日が変更されました</div>
          {tx.scheduleNotice.changes.map((c, i) => <div key={i} style={{ fontSize: 12, color: "#7A5410", lineHeight: 1.6 }}>・{c}</div>)}
          <div style={{ marginTop: 10 }}><Btn variant="warn" full onClick={() => actions.ackSchedule(tx.id)}>変更を確認しました</Btn></div>
        </div>
      )}
      {tx.payType === "progress" && (
        <Accordion title="金額内訳（出来高）" summary={yen(tx.amount)}>
          <InfoRow label="組立分" value={`${yen(tx.assemblyAmount)}（${BILL_JP[tx.ph.assembly.bill]}）`} />
          <InfoRow label="解体分（残金）" value={`${yen(tx.dismantleAmount)}（${BILL_JP[tx.ph.dismantle.bill]}）`} />
          <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0" }}><span style={{ fontSize: 12.5, color: T.sub, fontWeight: 700 }}>合計</span><span style={{ fontSize: 15, fontWeight: 900, color: T.blue }}>{yen(tx.amount)}</span></div>
        </Accordion>
      )}
      {tx.ph.assembly.work === "waiting" && !tx.timeline.some((x) => x.label === "取引が開始されました") ? (
        actingRole === "partner" ? <div style={{ marginBottom: 12 }}><Btn full onClick={() => actions.acceptDeal(tx.id)}>案件を受ける（取引開始）</Btn></div>
          : <div style={{ background: "#fff", border: `1px dashed ${T.line}`, borderRadius: 14, padding: 16, textAlign: "center", marginBottom: 12, fontSize: 13, color: T.sub }}>協力会社の承諾待ちです。立場を「協力」に切り替えると体験できます。</div>
      ) : null}
      {openIssue && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ background: T.redSoft, border: `1px solid ${T.red}`, borderRadius: 14, padding: 14, marginBottom: 10 }}><div style={{ fontSize: 13, fontWeight: 800, color: T.red, marginBottom: 8 }}>確認事項があります</div>{tx.issues.filter((i) => !i.resolved).map((i, k) => <div key={k} style={{ fontSize: 12.5, lineHeight: 1.5, marginBottom: 6 }}><b>{i.by}</b>：{i.text}</div>)}<div style={{ fontSize: 11, color: T.sub, marginTop: 6 }}>運営はどちらか一方を悪者にはしません。事実を記録し、双方で解決します。</div></div>
          <div style={{ display: "flex", gap: 8 }}><Btn variant="ghost" onClick={() => actions.resolveIssue(tx.id)}>解決にする</Btn><Btn variant="ghost" full onClick={() => setModal({ kind: "consult" })}>運営へ相談</Btn></div>
        </div>
      )}
      {started && (
        <>
          <Accordion key={`doc-${actingRole}`} title="契約書類" highlight={docActionForViewer(tx, actingRole)} defaultOpen={docActionForViewer(tx, actingRole)} summary={`注文書${tx.order ? "✓" : "—"} / 請書${tx.orderAck ? "✓" : "—"}`}>
            <DocRow label="注文書" who="元請が発行" issued={tx.order} canIssue={actingRole === "prime" && !tx.order} onIssue={() => actions.issueOrder(tx.id)} onView={() => setModal({ kind: "order", docType: "order" })} />
            <div style={{ height: 8 }} />
            <DocRow label="注文請書" who="協力会社が発行" issued={tx.orderAck} disabled={!tx.order} canIssue={actingRole === "partner" && !!tx.order && !tx.orderAck} onIssue={() => actions.ackOrder(tx.id)} onView={() => setModal({ kind: "order", docType: "ack" })} />
            <div style={{ fontSize: 11, color: T.faint, marginTop: 10, lineHeight: 1.5 }}>注文書に対し注文請書を発行することで、受発注の合意記録になります（PDF出力は本番で対応）。</div>
          </Accordion>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: T.sub, margin: "4px 2px 8px" }}>作業・請求（各タブをタップで詳細／要対応は自動で開きます）</div>
          <PhasePanel key={`assembly-${actingRole}`} tx={tx} phk="assembly" actingRole={actingRole} actions={actions} setModal={setModal} />
          <PhasePanel key={`dismantle-${actingRole}`} tx={tx} phk="dismantle" actingRole={actingRole} actions={actions} setModal={setModal} />
        </>
      )}
      {tx.status === "completed" && <div style={{ background: T.greenSoft, border: `1px solid ${T.green}`, borderRadius: 14, padding: 16, textAlign: "center", margin: "4px 0 12px" }}><div style={{ fontSize: 15, fontWeight: 900, color: T.green }}>取引が完了しました</div><div style={{ fontSize: 12, color: "#0E6E48", marginTop: 4 }}>{tx._onTime === false ? "支払い遅延" : "期日内支払い"}・平均支払日数{tx._payDays}日として、双方の信用実績に反映しました</div></div>}
      {started && (
        <Accordion title="AshiBase連携" summary={tx.ashibase ? "連携ON" : "未連携"}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: tx.ashibase ? T.greenSoft : T.blueLight, color: tx.ashibase ? T.green : T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>A</div>
            <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 800 }}>施工管理（AshiBase）へ連携</div><div style={{ fontSize: 11, color: T.sub }}>{tx.ashibase ? `連携ON（${tx.ashibase.at}）／自動同期の想定` : "この取引のデータを工程・勤怠・請求へ引き継ぎます"}</div></div>
            <Btn variant={tx.ashibase ? "ghost" : "primary"} onClick={() => actions.linkAshiBase(tx.id)}>{tx.ashibase ? "再同期" : "連携する"}</Btn>
          </div>
          {ASHIBASE_DOMAINS.map((d) => <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderTop: `1px solid ${T.line}` }}><span style={{ fontSize: 12.5, fontWeight: 800, width: 74 }}>{d.label}</span><span style={{ flex: 1, fontSize: 11.5, color: T.sub }}>{d.note}</span><span style={{ fontSize: 11, fontWeight: 700, color: tx.ashibase ? T.green : T.faint }}>{tx.ashibase ? "同期可" : "待機"}</span></div>)}
          <button onClick={() => setModal({ kind: "ashibase" })} style={{ width: "100%", marginTop: 10, background: T.blueSoft, border: `1px solid ${T.blueLight}`, borderRadius: 10, padding: 10, fontSize: 12.5, fontWeight: 700, color: T.blue, cursor: "pointer" }}>連携データ（正規化ペイロード）を表示</button>
          <div style={{ fontSize: 10.5, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>実際のフィールド対応はAshiBaseのAPI仕様に合わせてマッピングします（本接続は未実装）。</div>
        </Accordion>
      )}
      <Accordion title="案件情報" right={actingRole === "prime" ? <span onClick={(e) => { e.stopPropagation(); setModal({ kind: "schedule" }); }} style={{ fontSize: 12, fontWeight: 700, color: T.blue, marginRight: 4 }}>編集</span> : null}>
        <InfoRow label="案件名" value={tx.projectName} />
        <InfoRow label="種別" value={JOBTYPE[tx.jobType]} />
        <InfoRow label="現場" value={`${tx.region} ${tx.address}`} />
        <InfoRow label="工期" value={`${d2(tx.start)} 〜 ${d2(tx.end)}`} />
        <InfoRow label="組立予定" value={`${d2(tx.assemblyStart)} 〜 ${d2(tx.assemblyEnd)}`} />
        <InfoRow label="解体予定" value={`${d2(tx.dismantleStart)} 〜 ${d2(tx.dismantleEnd)}`} />
        <InfoRow label="契約金額" value={yen(tx.amount)} />
        <InfoRow label="支払条件" value={`${tx.closing}${tx.payterm}（${tx.payType === "progress" ? "出来高" : "一括"}）`} />
        <InfoRow label="元請 / 協力" value={`${prime.name} ／ ${partner.name}`} />
        {actingRole === "prime" && <div style={{ marginTop: 10 }}><Btn variant="ghost" full onClick={() => setModal({ kind: "schedule" })}>工期・組立/解体予定を変更</Btn></div>}
        <div style={{ fontSize: 10.5, color: T.faint, marginTop: 8, lineHeight: 1.5 }}>工期・予定日は元請が変更できます。変更すると協力会社へ通知されます。</div>
      </Accordion>
      <button onClick={() => actions.openChat(tx.chatKey, "txDetail", tx.id, tx.primeId, tx.partnerId, tx.projectName)} style={{ width: "100%", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 12 }}><div style={{ width: 34, height: 34, borderRadius: 9, background: T.blueLight, color: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>💬</div><div style={{ flex: 1, textAlign: "left" }}><div style={{ fontSize: 13, fontWeight: 800 }}>案件チャット</div><div style={{ fontSize: 11, color: T.sub }}>応募時からのやり取りをそのまま継続</div></div><span style={{ fontSize: 16, color: T.blue }}>›</span></button>
      <Accordion title="運営への相談" summary={tx.consultations && tx.consultations.length ? `${tx.consultations.length}件` : ""}>
        {tx.consultations && tx.consultations.length > 0 && <div style={{ marginBottom: 10 }}>{tx.consultations.map((c, k) => <div key={k} style={{ background: T.bg, borderRadius: 12, padding: 12, marginBottom: 8 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}><span style={{ fontSize: 12, fontWeight: 800 }}>{c.by}</span><Pill label={c.status === "open" ? "対応中" : "対応済み"} color={c.status === "open" ? T.amber : T.green} bg={c.status === "open" ? T.amberSoft : T.greenSoft} /></div><div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.5 }}>{c.text}</div></div>)}</div>}
        <Btn variant="ghost" full onClick={() => setModal({ kind: "consult" })}>運営へ相談する（トラブル・事実確認）</Btn>
      </Accordion>
      <Accordion title="信用タイムライン" summary={`${tx.timeline.length}件`}>
        <Timeline items={tx.timeline} />
      </Accordion>
      {modal && modal.kind === "start" && <StartModal phk={modal.phk} tx={tx} onClose={() => setModal(null)} onSubmit={(d) => { actions.startWork(tx.id, modal.phk, d); setModal(null); }} />}
      {modal && modal.kind === "report" && <ReportModal phk={modal.phk} tx={tx} onClose={() => setModal(null)} onSubmit={(d) => { actions.reportWork(tx.id, modal.phk, d); setModal(null); }} />}
      {modal && modal.kind === "session" && <SessionModal phk={modal.phk} sess={modal.sess || "end"} tx={tx} onClose={() => setModal(null)} onSubmit={(d) => { actions.sessionReport(tx.id, modal.phk, d); setModal(null); }} />}
      {modal && modal.kind === "rework" && <ReworkModal phk={modal.phk} onClose={() => setModal(null)} onSubmit={(text) => { actions.requestRework(tx.id, modal.phk, text); setModal(null); }} />}
      {modal && modal.kind === "invoice" && <InvoiceModal phk={modal.phk} tx={tx} onClose={() => setModal(null)} onSubmit={(d) => { actions.submitInvoice(tx.id, modal.phk, d); setModal(null); }} />}
      {modal && modal.kind === "payment" && <PaymentModal phk={modal.phk} tx={tx} onClose={() => setModal(null)} onSubmit={(d) => { actions.registerPayment(tx.id, modal.phk, d); setModal(null); }} />}
      {modal && modal.kind === "deposit" && <DepositModal phk={modal.phk} tx={tx} onClose={() => setModal(null)} onSubmit={(d) => { actions.confirmDeposit(tx.id, modal.phk, d); setModal(null); }} />}
      {modal && modal.kind === "consult" && <ConsultModal onClose={() => setModal(null)} onSubmit={(text) => { actions.consult(tx.id, actingRole, text); setModal(null); }} />}
      {modal && modal.kind === "order" && <OrderModal docType={modal.docType} tx={tx} co={co} onClose={() => setModal(null)} />}
      {modal && modal.kind === "ashibase" && <AshiBaseModal tx={tx} co={co} onClose={() => setModal(null)} />}
      {modal && modal.kind === "schedule" && <ScheduleEditModal tx={tx} onClose={() => setModal(null)} onSubmit={(d) => { actions.editSchedule(tx.id, d); setModal(null); }} />}
    </div>
  );
}
function DocRow({ label, who, issued, canIssue, disabled, onIssue, onView }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: 34, height: 40, borderRadius: 6, background: issued ? T.greenSoft : T.bg, border: `1px solid ${issued ? T.green : T.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>📄</div>
      <div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 800 }}>{label}</div><div style={{ fontSize: 11, color: issued ? T.green : T.sub }}>{issued ? `発行済み（${issued.at}）` : who}</div></div>
      {issued ? <Btn variant="ghost" onClick={onView}>表示</Btn> : canIssue ? <Btn onClick={onIssue}>発行</Btn> : <span style={{ fontSize: 11.5, color: T.faint }}>{disabled ? "注文書の発行後" : "相手の操作待ち"}</span>}
    </div>
  );
}
function StartModal({ onClose, tx, phk, onSubmit }) {
  const isSupport = tx.jobType === "support";
  const [f, setF] = useState({ date: TODAY, people: String(tx.need || 2) });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valid = f.date && (!isSupport || f.people);
  return (<Modal onClose={onClose} title={`${phJP(phk)}作業を開始`}><div style={{ fontSize: 12, color: T.sub, marginBottom: 12, lineHeight: 1.5 }}>作業の開始を報告します。開始日{isSupport ? "と人数" : ""}はAshiBase勤怠へ連携できます。</div><Field label={`${phJP(phk)}開始日`} req><Input type="date" value={f.date} onChange={set("date")} /></Field>{isSupport && <Field label="人数" req><Input type="number" value={f.people} onChange={set("people")} suffix="名" /></Field>}<Btn full disabled={!valid} onClick={() => valid && onSubmit({ date: f.date, people: isSupport ? Number(f.people) : null })}>{phJP(phk)}作業を開始する</Btn></Modal>);
}
function ReportModal({ onClose, tx, phk, onSubmit }) {
  const isSupport = tx.jobType === "support";
  const multiDay = phaseMultiDay(tx, phk);
  const sessions = tx.ph[phk].sessions || [];
  const hasSessions = sessions.length > 0;
  const [confirmed, setConfirmed] = useState(!multiDay);
  const [f, setF] = useState({ date: TODAY, days: "1", people: String(tx.need || 2), content: "", note: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const autoDays = new Set([...sessions.map((s) => s.date), f.date]).size; // 作業終了報告＋完了日の実働日数
  const days = hasSessions ? autoDays : Number(f.days);
  const valid = f.date && days > 0 && (!isSupport || f.people) && confirmed;
  return (<Modal onClose={onClose} title={`${phJP(phk)}完了を報告`}>
    {multiDay && (
      <div style={{ background: T.amberSoft, border: `1px solid ${T.amber}`, borderRadius: 12, padding: 12, marginBottom: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#8A5A10", marginBottom: 6 }}>{phJP(phk)}は完了しましたか？</div>
        <div style={{ fontSize: 11.5, color: "#7A5410", lineHeight: 1.5, marginBottom: 10 }}>完了報告をすると元請の完了確認に進みます。まだ作業が続く場合は「作業終了を報告」をご利用ください。</div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: T.ink, cursor: "pointer" }}><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} style={{ width: 18, height: 18 }} />はい、{phJP(phk)}は完了しました</label>
      </div>
    )}
    <div style={{ fontSize: 12, color: T.sub, marginBottom: 12 }}>完了日・日数{isSupport ? "・人数" : ""}はAshiBase勤怠へ連携できます。人数は応援のときのみ必須です。</div>
    <Field label={`${phJP(phk)}完了日`} req><Input type="date" value={f.date} onChange={set("date")} /></Field>
    <div style={{ display: "flex", gap: 10 }}>
      {hasSessions ? (
        <Field label="のべ作業日数（自動計算）"><div style={{ ...inputBase, background: T.bg, display: "flex", alignItems: "center", justifyContent: "space-between" }}><span style={{ fontWeight: 800 }}>{autoDays}日</span><span style={{ fontSize: 11, color: T.faint }}>作業終了報告{sessions.length}件＋完了日</span></div></Field>
      ) : (
        <Field label="のべ作業日数" req><Input type="number" value={f.days} onChange={set("days")} suffix="日" /></Field>
      )}
      <Field label="作業人数" req={isSupport} opt={!isSupport}><Input type="number" value={f.people} onChange={set("people")} suffix="名" placeholder={isSupport ? "" : "任意"} /></Field>
    </div>
    {hasSessions && <div style={{ fontSize: 10.5, color: T.faint, marginTop: -6, marginBottom: 8 }}>のべ作業日数は「作業終了報告」の日数と完了日から自動計算しています。</div>}
    <Field label="作業内容"><TextArea value={f.content} onChange={set("content")} placeholder={`${phJP(phk)}完了`} /></Field>
    <Field label="写真"><div style={{ border: `1.5px dashed ${T.line}`, borderRadius: 12, padding: 16, textAlign: "center", color: T.faint, fontSize: 13 }}>＋ {phJP(phk)}完了写真を追加</div></Field>
    <Btn full disabled={!valid} onClick={() => valid && onSubmit({ date: f.date, days, people: f.people ? Number(f.people) : null, content: f.content || `${phJP(phk)}完了`, note: f.note, photos: 2 })}>{phJP(phk)}完了を報告する</Btn>
  </Modal>);
}
function SessionModal({ onClose, tx, phk, sess, onSubmit }) {
  const isSupport = tx.jobType === "support";
  const isStart = sess === "start";
  const word = isStart ? "作業開始" : "作業終了";
  const [f, setF] = useState({ date: TODAY, people: String(tx.need || 2), content: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const valid = f.date && (!isSupport || f.people);
  return (<Modal onClose={onClose} title={`${phJP(phk)}${word}を報告`}>
    <div style={{ background: T.blueSoft, borderRadius: 12, padding: 12, fontSize: 12, color: T.sub, marginBottom: 14, lineHeight: 1.5 }}>その日の{word}を記録します。<b>ステータスは変わりません</b>（{phJP(phk)}の完了は「完了を報告」から）。日々の開始・終了はAshiBase勤怠へ連携できます。</div>
    <Field label="作業日" req><Input type="date" value={f.date} onChange={set("date")} /></Field>
    {isSupport && <Field label="人数" req><Input type="number" value={f.people} onChange={set("people")} suffix="名" /></Field>}
    <Field label="作業内容・進捗"><TextArea value={f.content} onChange={set("content")} placeholder={isStart ? "例）本日は3層目から。" : "例）3層まで架設完了。翌日continue。"} /></Field>
    <Field label="写真"><div style={{ border: `1.5px dashed ${T.line}`, borderRadius: 12, padding: 16, textAlign: "center", color: T.faint, fontSize: 13 }}>＋ その日の作業写真</div></Field>
    <Btn full disabled={!valid} onClick={() => valid && onSubmit({ date: f.date, kind: sess, people: isSupport ? Number(f.people) : null, content: f.content })}>{word}を報告する</Btn>
  </Modal>);
}
function ReworkModal({ onClose, phk, onSubmit }) {
  const [text, setText] = useState("");
  return (<Modal onClose={onClose} title={`${phJP(phk)}の是正・手直しを依頼`}><div style={{ fontSize: 12, color: T.sub, marginBottom: 12, lineHeight: 1.5 }}>依頼すると、協力会社が「是正・手直し完了」を報告するまで次に進めません。</div><Field label="是正・手直しの内容" req><TextArea value={text} onChange={(e) => setText(e.target.value)} placeholder="例）3階北側の手すりに隙間あり。基準に合わせて是正してください。" /></Field><Field label="写真"><div style={{ border: `1.5px dashed ${T.line}`, borderRadius: 12, padding: 16, textAlign: "center", color: T.faint, fontSize: 13 }}>＋ 指摘箇所の写真</div></Field><Btn full variant="warn" disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>是正・手直しを依頼する</Btn></Modal>);
}
function InvoiceModal({ onClose, tx, phk, onSubmit }) {
  const prog = tx.payType === "progress";
  const def = phaseAmount(tx, phk);
  const [f, setF] = useState({ amount: String(def), date: TODAY, dueDate: "2026-08-31", bank: "七十七銀行 仙台支店 普通1234567" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (<Modal onClose={onClose} title={prog ? `${phJP(phk)}分を請求` : "請求書を提出"}>{prog && <div style={{ background: T.blueSoft, borderRadius: 12, padding: 12, fontSize: 12, color: T.sub, marginBottom: 14 }}>出来高請求です。{phk === "assembly" ? "組立完了分（一部）" : "解体完了分（残金）"}を請求します。</div>}<Field label="請求金額" req><Input type="number" prefix="¥" value={f.amount} onChange={set("amount")} /></Field><div style={{ display: "flex", gap: 10 }}><Field label="請求日" req><Input type="date" value={f.date} onChange={set("date")} /></Field><Field label="支払期日" req><Input type="date" value={f.dueDate} onChange={set("dueDate")} /></Field></div><Field label="振込先"><Input value={f.bank} onChange={set("bank")} /></Field><Field label="請求書ファイル"><div style={{ border: `1.5px dashed ${T.line}`, borderRadius: 12, padding: 16, textAlign: "center", color: T.faint, fontSize: 13 }}>＋ PDFを添付</div></Field><Btn full onClick={() => onSubmit({ amount: Number(f.amount), date: f.date, dueDate: f.dueDate, bank: f.bank, note: "" })}>請求書を提出する</Btn></Modal>);
}
function PaymentModal({ onClose, tx, phk, onSubmit }) {
  const iv2 = tx.ph[phk].inv;
  const [f, setF] = useState({ date: TODAY, amount: String(iv2 ? iv2.amount : 0), method: "銀行振込" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const late = iv2 && daysBetween(iv2.dueDate, f.date) > 0;
  return (<Modal onClose={onClose} title="支払い済みにする"><div style={{ background: T.blueSoft, borderRadius: 12, padding: 12, fontSize: 12, color: T.sub, marginBottom: 14, lineHeight: 1.5 }}>支払い済みにしても取引完了にはなりません。協力会社の入金確認が必要です（二者確認）。</div><div style={{ display: "flex", gap: 10 }}><Field label="支払日" req><Input type="date" value={f.date} onChange={set("date")} /></Field><Field label="支払金額" req><Input type="number" prefix="¥" value={f.amount} onChange={set("amount")} /></Field></div>{late && <div style={{ background: T.amberSoft, color: "#8A5A10", fontSize: 12, padding: "8px 12px", borderRadius: 10, marginBottom: 12, fontWeight: 700 }}>支払期日を過ぎています（遅延として記録されます）</div>}<Field label="支払方法"><Select value={f.method} onChange={set("method")} options={["銀行振込", "現金", "その他"]} /></Field><Btn full onClick={() => onSubmit({ date: f.date, amount: Number(f.amount), method: f.method, note: "" })}>支払い済みとして登録</Btn></Modal>);
}
function DepositModal({ onClose, tx, phk, onSubmit }) {
  const invAmt = tx.ph[phk].inv ? tx.ph[phk].inv.amount : 0;
  const [f, setF] = useState({ date: TODAY, amount: String(tx.ph[phk].pay ? tx.ph[phk].pay.amount : invAmt) });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const diff = Number(f.amount) !== invAmt;
  const willComplete = tx.payType === "lump" ? phk === "dismantle" : (phk === "assembly" ? tx.ph.dismantle.bill === "deposited" : tx.ph.assembly.bill === "deposited");
  return (<Modal onClose={onClose} title="入金を確認"><div style={{ background: T.blueSoft, borderRadius: 12, padding: 12, fontSize: 12, color: T.sub, marginBottom: 14, lineHeight: 1.5 }}>{tx.payType === "progress" && phk === "assembly" ? "組立分（一部）の入金を確認します。" : "入金を確認します。"}請求額（{yen(invAmt)}）と違う場合は「確認事項あり」になります。</div><div style={{ display: "flex", gap: 10 }}><Field label="入金日" req><Input type="date" value={f.date} onChange={set("date")} /></Field><Field label="入金金額" req><Input type="number" prefix="¥" value={f.amount} onChange={set("amount")} /></Field></div>{diff && <div style={{ background: T.redSoft, color: T.red, fontSize: 12, padding: "8px 12px", borderRadius: 10, marginBottom: 12, fontWeight: 700 }}>請求額と差額があります。登録すると「確認事項あり」になります。</div>}<Btn full variant={diff ? "danger" : "primary"} onClick={() => onSubmit({ date: f.date, amount: Number(f.amount), diff, note: "" })}>{diff ? "差額ありとして登録" : willComplete ? "入金を確認して取引完了" : "入金を確認"}</Btn></Modal>);
}
function ConsultModal({ onClose, onSubmit }) {
  const [text, setText] = useState("");
  return (<Modal onClose={onClose} title="運営へ相談"><div style={{ fontSize: 12, color: T.sub, marginBottom: 12, lineHeight: 1.5 }}>運営がどちらか一方を悪者にすることはありません。事実関係の記録・確認をサポートします。相談内容は相手会社には自動公開されません。</div><Field label="相談内容"><TextArea value={text} onChange={(e) => setText(e.target.value)} placeholder="例）差額について当事者間で解決できないため、事実確認をお願いします。" /></Field><Field label="証拠ファイル"><div style={{ border: `1.5px dashed ${T.line}`, borderRadius: 12, padding: 16, textAlign: "center", color: T.faint, fontSize: 13 }}>＋ ファイルを添付</div></Field><Btn full disabled={!text.trim()} onClick={() => onSubmit(text.trim())}>運営へ相談する</Btn></Modal>);
}
function OrderModal({ docType, tx, co, onClose }) {
  const isOrder = docType === "order";
  const prime = co(tx.primeId), partner = co(tx.partnerId);
  const title = isOrder ? "注文書" : "注文請書";
  const Line = ({ l, v }) => <div style={{ display: "flex", padding: "7px 0", borderBottom: `1px solid ${T.line}`, gap: 10 }}><span style={{ width: 84, fontSize: 11.5, color: T.sub, flexShrink: 0 }}>{l}</span><span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{v}</span></div>;
  return (
    <Modal onClose={onClose} title={title}>
      <div style={{ border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 }}>
        <div style={{ textAlign: "center", fontSize: 18, fontWeight: 900, letterSpacing: 4, marginBottom: 12 }}>{title}</div>
        <div style={{ fontSize: 12, color: T.sub, marginBottom: 12, lineHeight: 1.6 }}>{isOrder ? `${partner.name} 御中` : `${prime.name} 御中`}<br />{isOrder ? "下記のとおり注文いたします。" : "下記のとおり注文をお請けいたします。"}</div>
        <Line l="件名" v={tx.projectName} />
        <Line l="種別" v={JOBTYPE[tx.jobType]} />
        <Line l="現場" v={`${tx.region} ${tx.address}`} />
        <Line l="工期" v={`${dFull(tx.start)} 〜 ${dFull(tx.end)}`} />
        <Line l="組立予定" v={`${d2(tx.assemblyStart)} 〜 ${d2(tx.assemblyEnd)}`} /><Line l="解体予定" v={`${d2(tx.dismantleStart)} 〜 ${d2(tx.dismantleEnd)}`} />
        <Line l="金額" v={tx.payType === "progress" ? `${yen(tx.amount)}（組立 ${yen(tx.assemblyAmount)} / 解体 ${yen(tx.dismantleAmount)}）` : yen(tx.amount)} />
        <Line l="支払条件" v={`${tx.closing}${tx.payterm}`} />
        <Line l={isOrder ? "注文者" : "受注者"} v={isOrder ? `${prime.name}（${prime.contact}）` : `${partner.name}（${partner.contact}）`} />
        <Line l="発行日" v={dFull((isOrder ? tx.order : tx.orderAck) ? (isOrder ? tx.order.date : tx.orderAck.date) : TODAY)} />
      </div>
      <div style={{ fontSize: 11, color: T.faint, margin: "10px 0 14px", lineHeight: 1.5 }}>プロトタイプの表示です。本番ではPDF出力・電子押印・保存に対応します。</div>
      <Btn full variant="ghost" onClick={onClose}>閉じる</Btn>
    </Modal>
  );
}
function AshiBaseModal({ tx, co, onClose }) {
  const payload = ashibasePayload(tx, co);
  return (
    <Modal onClose={onClose} title="AshiBase連携データ">
      <div style={{ fontSize: 12, color: T.sub, marginBottom: 12, lineHeight: 1.6 }}>この取引から生成される正規化データです。AshiBaseの工程・勤怠・請求・原価・取引先へマッピングして連携する想定です。</div>
      <div style={{ background: "#0F1B2E", color: "#CFE0FF", borderRadius: 12, padding: 14, fontSize: 11, lineHeight: 1.6, fontFamily: "ui-monospace,Menlo,Consolas,monospace", overflowX: "auto", whiteSpace: "pre" }}>{JSON.stringify(payload, null, 2)}</div>
      <div style={{ fontSize: 10.5, color: T.faint, margin: "10px 0 14px", lineHeight: 1.5 }}>実フィールド名・単位・型はAshiBaseのAPI仕様に合わせて変換します（本接続は未実装）。</div>
      <Btn full variant="ghost" onClick={onClose}>閉じる</Btn>
    </Modal>
  );
}
function ScheduleEditModal({ tx, onClose, onSubmit }) {
  const [f, setF] = useState({ start: tx.start, end: tx.end, assemblyStart: tx.assemblyStart, assemblyEnd: tx.assemblyEnd, dismantleStart: tx.dismantleStart, dismantleEnd: tx.dismantleEnd });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <Modal onClose={onClose} title="工期・組立/解体予定を変更">
      <div style={{ fontSize: 12, color: T.sub, marginBottom: 14, lineHeight: 1.5 }}>元請として予定日を変更します。変更すると協力会社へ通知され、タイムラインに記録されます。</div>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.sub, marginBottom: 6 }}>工期</div>
      <div style={{ display: "flex", gap: 10 }}><Field label="開始"><Input type="date" value={f.start} onChange={set("start")} /></Field><Field label="終了"><Input type="date" value={f.end} onChange={set("end")} /></Field></div>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.sub, marginBottom: 6 }}>組立予定</div>
      <div style={{ display: "flex", gap: 10 }}><Field label="開始"><Input type="date" value={f.assemblyStart} onChange={set("assemblyStart")} /></Field><Field label="完了"><Input type="date" value={f.assemblyEnd} onChange={set("assemblyEnd")} /></Field></div>
      <div style={{ fontSize: 12, fontWeight: 700, color: T.sub, marginBottom: 6 }}>解体予定</div>
      <div style={{ display: "flex", gap: 10 }}><Field label="開始"><Input type="date" value={f.dismantleStart} onChange={set("dismantleStart")} /></Field><Field label="完了"><Input type="date" value={f.dismantleEnd} onChange={set("dismantleEnd")} /></Field></div>
      <Btn full onClick={() => onSubmit(f)}>変更して協力会社へ通知</Btn>
    </Modal>
  );
}

/* =========================================================================
   チャット（案件専用・応募〜取引で継続）
   ========================================================================= */
function Chat({ chat, chatKey, co, onSend }) {
  const [role, setRole] = useState("prime");
  const [text, setText] = useState("");
  const prime = co(chat.primeId), partner = co(chat.partnerId);
  const send = () => { if (!text.trim()) return; onSend(chatKey, role, text.trim()); setText(""); };
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "10px 14px", background: "#fff", borderBottom: `1px solid ${T.line}` }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>{chat.title}</div>
        <div style={{ fontSize: 11, color: T.sub, marginBottom: 8 }}>元請 {prime.name} ／ 協力 {partner.name}</div>
        <div style={{ display: "flex", background: T.bg, borderRadius: 10, padding: 3 }}>{[["prime", "元請として送信"], ["partner", "協力として送信"]].map(([k, l]) => <button key={k} onClick={() => setRole(k)} style={{ flex: 1, padding: "7px 6px", borderRadius: 8, border: "none", background: role === k ? T.blue : "transparent", color: role === k ? "#fff" : T.sub, fontSize: 11.5, fontWeight: 800, cursor: "pointer" }}>{l}</button>)}</div>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: 14, background: "#EAF0F6" }}>
        {chat.messages.length === 0 && <div style={{ textAlign: "center", color: T.faint, fontSize: 12.5, marginTop: 30 }}>まだメッセージはありません。打合せを始めましょう。</div>}
        {chat.messages.map((m, i) => { const mine = m.from === "prime"; return (
          <div key={i} style={{ display: "flex", justifyContent: mine ? "flex-end" : "flex-start", marginBottom: 10 }}>
            <div style={{ maxWidth: "78%" }}>
              <div style={{ fontSize: 10, color: T.sub, marginBottom: 2, textAlign: mine ? "right" : "left" }}>{mine ? prime.name : partner.name} ・ {m.ts}</div>
              <div style={{ background: mine ? T.blue : "#fff", color: mine ? "#fff" : T.ink, padding: "9px 12px", borderRadius: 14, fontSize: 13, lineHeight: 1.5, borderTopRightRadius: mine ? 4 : 14, borderTopLeftRadius: mine ? 14 : 4 }}>{m.text}</div>
            </div>
          </div>
        ); })}
      </div>
      <div style={{ display: "flex", gap: 8, padding: 12, background: "#fff", borderTop: `1px solid ${T.line}` }}>
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="メッセージを入力" style={{ ...inputBase, borderRadius: 999 }} />
        <button onClick={send} style={{ background: T.blue, color: "#fff", border: "none", borderRadius: 999, width: 46, flexShrink: 0, fontSize: 18, cursor: "pointer" }}>➤</button>
      </div>
    </div>
  );
}

/* =========================================================================
   登録会社一覧・会社プロフィール
   ========================================================================= */
function CompanyList({ companies, txs, go }) {
  const [sort, setSort] = useState("level");
  const order = { Platinum: 5, Gold: 4, Silver: 3, Bronze: 2, 未認証: 1 };
  const sorted = [...companies].sort((a, b) => sort === "level" ? order[creditLevel(b, txs)] - order[creditLevel(a, txs)] : b.metrics.completed - a.metrics.completed);
  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: T.blueSoft, border: `1px solid ${T.blueLight}`, borderRadius: 14, padding: 12, fontSize: 12, color: T.sub, lineHeight: 1.6, marginBottom: 14 }}>各社の信用レベル・支払い実績・認証は公開情報です。個別取引の中身（金額や現場）は関係者しか見られません。</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>{[["level", "信用レベル順"], ["completed", "取引件数順"]].map(([k, l]) => <button key={k} onClick={() => setSort(k)} style={{ border: `1px solid ${sort === k ? T.blue : T.line}`, background: sort === k ? T.blue : "#fff", color: sort === k ? "#fff" : T.sub, padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>{l}</button>)}</div>
      {sorted.map((c) => { const level = creditLevel(c, txs), m = c.metrics; return (
        <button key={c.id} onClick={() => go("company", c.id)} style={{ display: "block", width: "100%", textAlign: "left", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 16, padding: 14, marginBottom: 12, cursor: "pointer" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}><div style={{ width: 44, height: 44, borderRadius: 12, background: T.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18 }}>{c.name.slice(0, 1)}</div><div style={{ flex: 1 }}><div style={{ fontSize: 14.5, fontWeight: 800 }}>{c.name}</div><div style={{ fontSize: 11.5, color: T.sub }}>{c.region} ・ {c.works}</div></div><LevelBadge level={level} /></div>
          <div style={{ display: "flex", gap: 12, marginBottom: 10 }}><MiniStat n={m.completed} label="取引完了" /><MiniStat n={m.onTimeCount} label="期日内支払い" /><MiniStat n={m.lateCount} label="遅延" red={m.lateCount > 0} /><MiniStat n={`${m.continuous}`} label="継続取引" /></div>
          <VerifyBadges verify={c.verify} />
        </button>
      ); })}
    </div>
  );
}
function CompanyProfile({ company: c, txs, self, go }) {
  const level = creditLevel(c, txs), facts = companyFacts(c, txs), L = LEVELS[level];
  return (
    <div style={{ padding: 16, paddingBottom: 30 }}>
      <div style={{ background: "#fff", border: `1px solid ${T.line}`, borderRadius: 18, padding: 18, marginBottom: 16 }}><div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}><div style={{ width: 54, height: 54, borderRadius: 16, background: T.blue, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 22 }}>{c.name.slice(0, 1)}</div><div style={{ flex: 1 }}><div style={{ fontSize: 16.5, fontWeight: 900 }}>{c.name}</div><div style={{ fontSize: 12, color: T.sub }}>{c.region} ・ {c.areas}対応</div></div><LevelBadge level={level} size="lg" /></div><div style={{ background: L.bg, borderRadius: 12, padding: "10px 12px", fontSize: 11.5, color: L.color, fontWeight: 700, textAlign: "center" }}>信用レベルは取引実績と認証から自動判定されます</div></div>
      {!self && <div style={{ fontSize: 11.5, color: T.faint, marginBottom: 16, lineHeight: 1.5 }}>ここに表示されるのは公開情報です。この会社の個別取引の中身は、関係者以外には表示されません。</div>}
      <SectionLabel text="確認できる事実" /><div style={{ marginBottom: 16 }}><FactPanel facts={facts} /></div>
      <SectionLabel text="支払い実績" /><div style={{ marginBottom: 16 }}><PaymentMetrics m={c.metrics} /></div>
      <SectionLabel text="認証バッジ" right={self ? <button onClick={() => go("verify")} style={{ border: "none", background: "none", color: T.blue, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>認証管理 ›</button> : null} />
      <Card style={{ marginBottom: 16 }}><VerifyBadges verify={c.verify} /></Card>
      <SectionLabel text="会社情報" /><Card style={{ padding: "2px 14px", marginBottom: self ? 16 : 0 }}><InfoRow label="担当者" value={c.contact} /><InfoRow label="対応地域" value={c.areas} /><InfoRow label="対応工事" value={c.works} /><InfoRow label="登録日" value={dFull(c.registered)} /></Card>
      {self && (<><SectionLabel text="設定・管理" /><Card style={{ padding: 0, overflow: "hidden" }}>{[["登録会社一覧を見る", () => go("companyList")], ["LINE連携・通知設定", () => go("line")], ["認証書類の提出・管理", () => go("verify")], ["運営管理（デモ）", () => go("admin")]].map(([label, fn], i, arr) => <div key={label} onClick={fn} style={{ padding: "14px 16px", fontSize: 14, fontWeight: 600, display: "flex", justifyContent: "space-between", cursor: "pointer", borderBottom: i < arr.length - 1 ? `1px solid ${T.line}` : "none" }}>{label}<span style={{ color: T.faint }}>›</span></div>)}</Card></>)}
    </div>
  );
}

/* =========================================================================
   認証 / LINE / パートナー / 運営
   ========================================================================= */
function VerifyManage({ company: c }) {
  return (<div style={{ padding: 16 }}><div style={{ background: T.blueSoft, border: `1px solid ${T.blueLight}`, borderRadius: 14, padding: 12, fontSize: 12.5, color: T.sub, lineHeight: 1.6, marginBottom: 16 }}>書類を提出すると運営が確認します。確認済みの項目だけが認証バッジとして表示されます。有効期限のある書類は期限切れで自動的に表示が変わります。</div>{VERIFY_ITEMS.map((it) => { const st = c.verify[it.key] || "none", S = V_STATUS[st]; return (<div key={it.key} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8 }}><div style={{ flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 700 }}>{it.label}{it.core && <span style={{ fontSize: 10, color: T.blue, marginLeft: 6 }}>本人確認</span>}</div>{st === "rejected" && <div style={{ fontSize: 11, color: T.red, marginTop: 2 }}>差し戻し：書類が不鮮明です。再提出してください。</div>}</div><Badge color={S.color} bg={S.bg}>{S.label}</Badge>{(st === "none" || st === "rejected" || st === "expired") && <button style={{ border: "none", background: T.blueLight, color: T.blue, fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 8, cursor: "pointer" }}>提出</button>}</div>); })}</div>);
}
function LineSettings({ connected, setConnected, cats, setCats }) {
  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: connected ? "#E9F8EF" : T.bg, border: `1px solid ${connected ? T.green : T.line}`, borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}><div style={{ width: 40, height: 40, borderRadius: 10, background: "#06C755", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 11 }}>LINE</div><div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 800 }}>{connected ? "LINE連携済み" : "LINE未連携"}</div><div style={{ fontSize: 11.5, color: T.sub }}>{connected ? "足場屋グループへ通知を送信できます" : "連携すると新着通知を受け取れます"}</div></div><button onClick={() => setConnected(!connected)} style={{ background: connected ? "#fff" : "#06C755", color: connected ? T.sub : "#fff", border: connected ? `1px solid ${T.line}` : "none", fontSize: 12.5, fontWeight: 700, padding: "8px 12px", borderRadius: 10, cursor: "pointer" }}>{connected ? "解除" : "連携する"}</button></div>
      <SectionLabel text="LINE通知プレビュー" />
      <div style={{ background: "#8CA9C4", borderRadius: 16, padding: 14, marginBottom: 8 }}><div style={{ background: "#fff", borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 1.7 }}><b>【新着案件】</b><br />現場：宮城県仙台市<br />種別：応援（出来高）<br />組立：8/1 ／ 解体：8/20<br />募集：足場職人2名<br />単価：22,000円／日<br /><div style={{ marginTop: 10, background: T.blue, color: "#fff", textAlign: "center", padding: "9px", borderRadius: 8, fontWeight: 700, fontSize: 13 }}>詳細を見る（アプリが開きます）</div></div></div>
      <div style={{ fontSize: 11, color: T.faint, marginBottom: 16 }}>「詳細を見る」はアプリの案件詳細へディープリンクする想定です（本接続は未実装）。</div>
      <button style={{ width: "100%", padding: 13, borderRadius: 12, border: "none", background: connected ? "#06C755" : "#C4CCDA", color: "#fff", fontSize: 14, fontWeight: 800, cursor: connected ? "pointer" : "default", marginBottom: 20 }}>この内容でLINEへ通知を送信</button>
      <SectionLabel text="通知カテゴリ" />
      <Card style={{ padding: 0, overflow: "hidden" }}>{LINE_CATS.map((cat, i) => <div key={cat} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", borderBottom: i < LINE_CATS.length - 1 ? `1px solid ${T.line}` : "none" }}><span style={{ fontSize: 13.5, fontWeight: 600 }}>{cat}</span><button onClick={() => setCats({ ...cats, [cat]: !cats[cat] })} style={{ width: 44, height: 26, borderRadius: 999, border: "none", background: cats[cat] ? T.green : T.line, position: "relative", cursor: "pointer" }}><div style={{ width: 20, height: 20, borderRadius: 999, background: "#fff", position: "absolute", top: 3, left: cats[cat] ? 21 : 3, transition: "left .2s" }} /></button></div>)}</Card>
    </div>
  );
}
function Partners() {
  const [cat, setCat] = useState("すべて");
  const shown = PARTNERS.filter((p) => cat === "すべて" || p.cat === cat);
  return (<div style={{ padding: 16 }}><div style={{ fontSize: 12.5, color: T.sub, lineHeight: 1.6, marginBottom: 14 }}>足場会社の困りごとを解決するサービス一覧です。掲載はパートナー収益として、アプリを無料〜低価格で維持する基盤になります。</div><div style={{ display: "flex", gap: 8, marginBottom: 14, overflowX: "auto", paddingBottom: 2 }}>{PARTNER_CATS.map((c) => { const active = cat === c; return <button key={c} onClick={() => setCat(c)} style={{ border: `1px solid ${active ? T.blue : T.line}`, background: active ? T.blue : "#fff", color: active ? "#fff" : T.sub, padding: "6px 14px", borderRadius: 999, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", cursor: "pointer" }}>{c}</button>; })}</div>{shown.map((p) => (<Card key={p.name} style={{ marginBottom: 12 }}><div style={{ display: "flex", gap: 12, marginBottom: 10 }}><div style={{ width: 46, height: 46, borderRadius: 12, background: T.blueLight, color: T.blue, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18, flexShrink: 0 }}>{p.name.slice(0, 1)}</div><div style={{ flex: 1 }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><span style={{ fontSize: 14.5, fontWeight: 800 }}>{p.name}</span>{p.certified && <Badge color={T.green} bg={T.greenSoft} icon="✓">認定パートナー</Badge>}</div><div style={{ fontSize: 12, color: T.sub, marginTop: 2 }}>{p.cat} ・ {p.area}</div></div></div><div style={{ fontSize: 13, marginBottom: 8 }}>{p.svc}</div><div style={{ background: T.amberSoft, color: "#8A5A10", fontSize: 12, fontWeight: 700, padding: "6px 10px", borderRadius: 8, display: "inline-block", marginBottom: 12 }}>特典：{p.perk}</div><div style={{ display: "flex", gap: 8 }}><Btn variant="ghost">詳細を見る</Btn><Btn full>問い合わせる</Btn></div></Card>))}</div>);
}
function Admin({ companies, txs, co, go }) {
  const pending = companies.flatMap((c) => VERIFY_ITEMS.filter((i) => c.verify[i.key] === "reviewing").map((i) => ({ c: c.name, item: i.label })));
  const issues = txs.filter((t) => hasOpenIssue(t));
  const consults = txs.filter((t) => (t.consultations || []).some((c) => c.status === "open"));
  const stat = (label, n) => <div style={{ flex: 1, background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 8px", textAlign: "center" }}><div style={{ fontSize: 20, fontWeight: 900, color: T.blue }}>{n}</div><div style={{ fontSize: 10.5, color: T.sub, fontWeight: 600 }}>{label}</div></div>;
  const caseRow = (t, text) => <div key={t.id} onClick={() => go("txDetail", t.id)} style={{ padding: "10px 0", borderBottom: `1px solid ${T.line}`, cursor: "pointer" }}><div style={{ fontSize: 13, fontWeight: 700, display: "flex", justifyContent: "space-between" }}>{t.projectName}<span style={{ color: T.blue }}>›</span></div><div style={{ fontSize: 11.5, color: T.sub, marginTop: 2, lineHeight: 1.5 }}>{text}</div></div>;
  return (
    <div style={{ padding: 16 }}>
      <div style={{ background: T.amberSoft, border: `1px solid ${T.amber}`, borderRadius: 12, padding: 12, fontSize: 12, color: "#8A5A10", marginBottom: 16 }}>運営者向けのデモ画面です。信用レベル条件・パートナー・認証審査を管理する想定です。</div>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>{stat("登録会社", companies.length)}{stat("取引", txs.length)}{stat("認証審査", pending.length)}{stat("確認事項", issues.length)}</div>
      <SectionLabel text="登録会社と信用レベル" />
      {companies.map((c) => <div key={c.id} onClick={() => go("company", c.id)} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", border: `1px solid ${T.line}`, borderRadius: 12, padding: "12px 14px", marginBottom: 8, cursor: "pointer" }}><div><div style={{ fontSize: 13.5, fontWeight: 800 }}>{c.name}</div><div style={{ fontSize: 11.5, color: T.sub }}>取引{c.metrics.completed}件 ・ 遅延{c.metrics.lateCount}件</div></div><LevelBadge level={creditLevel(c, txs)} /></div>)}
      <div style={{ height: 8 }} />
      <SectionLabel text="確認事項のある取引" />
      <Card style={{ marginBottom: 16 }}>{issues.length === 0 ? <div style={{ fontSize: 13, color: T.faint }}>確認事項はありません</div> : issues.map((t) => caseRow(t, (t.issues.filter((i) => !i.resolved)[0] || {}).text))}</Card>
      <SectionLabel text="相談案件" />
      <Card style={{ marginBottom: 16 }}>{consults.length === 0 ? <div style={{ fontSize: 13, color: T.faint }}>相談はありません</div> : consults.map((t) => caseRow(t, (t.consultations.filter((c) => c.status === "open")[0] || {}).text))}</Card>
      <SectionLabel text="信用レベル条件（変更可能な想定）" />
      <Card>{[["Bronze", "会社認証完了・取引1件以上"], ["Silver", "取引5件・期日内90%・未解決なし"], ["Gold", "取引20件・期日内95%・主要認証3項目"], ["Platinum", "取引50件・期日内98%・遅延0"]].map(([lv, cond]) => <div key={lv} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${T.line}` }}><LevelBadge level={lv} /><span style={{ fontSize: 12, color: T.sub }}>{cond}</span></div>)}<div style={{ fontSize: 11, color: T.faint, marginTop: 8 }}>条件は管理画面から変更でき、全社に再判定が反映される想定です。</div></Card>
    </div>
  );
}
