"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Transaction, AvailableAction, Actor, PhaseKey } from "@/domain/transaction";
import { activePhaseKeys, phaseLabel } from "@/domain/transaction";
import { runTransactionAction, type TransactionActionInput } from "@/app/(tabs)/transactions/actions";
import { CreditTimeline } from "./CreditTimeline";
import type { TimelineEntry } from "@/lib/txTimeline";
import { ChatBox } from "@/app/(tabs)/projects/[id]/chat/[companyId]/ChatBox";
import type { ChatMessage } from "@/server/chatData";

export interface EmbeddedChat {
  projectId: string;
  partnerCompanyId: string;
  role: Actor;
  messages: ChatMessage[];
}

type Field = {
  name: string;
  label: string;
  type: "date" | "number" | "text" | "textarea" | "money";
  required?: boolean;
  optional?: boolean;
};

const TODAY = "2026-07-11";
const fmtMoney = (raw: string | number) => {
  const digits = String(raw).replace(/[^\d]/g, "");
  return digits ? Number(digits).toLocaleString() : "";
};

/** アクション key ごとの入力フォーム定義。定義が無い key は入力なしで即実行。 */
const FIELDS: Record<string, Field[]> = {
  startWork: [
    { name: "date", label: "作業開始日", type: "date", required: true },
    { name: "people", label: "人数（応援）", type: "number", optional: true },
  ],
  reportWorkCompletion: [
    { name: "date", label: "完了日", type: "date", required: true },
    { name: "days", label: "のべ作業日数", type: "number", required: true },
    { name: "people", label: "人数（応援は必須）", type: "number", optional: true },
    { name: "content", label: "作業内容", type: "text", required: true },
    { name: "photoCount", label: "写真枚数", type: "number", optional: true },
  ],
  submitInvoice: [
    { name: "amount", label: "請求額", type: "money", required: true },
    { name: "issuedAt", label: "請求日", type: "date", required: true },
    { name: "dueDate", label: "支払期日", type: "date", required: true },
    { name: "bankAccount", label: "振込先", type: "text", required: true },
  ],
  registerPayment: [
    { name: "amount", label: "支払額", type: "money", required: true },
    { name: "paidAt", label: "支払日", type: "date", required: true },
    { name: "method", label: "支払方法", type: "text", optional: true },
  ],
  confirmDeposit: [
    { name: "amount", label: "入金額", type: "money", required: true },
    { name: "confirmedAt", label: "入金確認日", type: "date", required: true },
  ],
  requestRework: [{ name: "text", label: "是正・手直しの内容", type: "textarea", required: true }],
  raiseIssue: [{ name: "text", label: "確認事項の内容", type: "textarea", required: true }],
  requestConsultation: [{ name: "text", label: "運営への相談内容", type: "textarea", required: true }],
};

const yen = (n: number | null | undefined) => (n == null ? "-" : "¥" + Number(n).toLocaleString());
const dmd = (s: string | null | undefined) => (s ? `${Number(s.split("-")[1])}/${Number(s.split("-")[2])}` : "-");

const WORK_JP: Record<string, string> = {
  waiting: "開始前",
  working: "作業中",
  reported: "完了報告あり（確認待ち）",
  rework: "是正・手直し中",
  confirmed: "完了確認済み",
};
const BILL_JP: Record<string, string> = {
  none: "未請求",
  invoiced: "請求済み（確認待ち）",
  checked: "請求確認済み（支払い待ち）",
  paid: "支払い済み（入金確認待ち）",
  deposited: "入金確認済み",
};

interface CompanyBrief {
  id: string;
  name: string;
  level: string;
}

const LEVEL_JP: Record<string, string> = {
  unverified: "未認証",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

export interface TxWorkspaceProps {
  tx: Transaction;
  role: Actor;
  actions: AvailableAction[];
  prime: CompanyBrief;
  partner: CompanyBrief;
  statusLabel: string;
  nextHint: string;
  timeline: TimelineEntry[];
  chat: EmbeddedChat | null;
}

export function TxWorkspace({ tx, role, actions, prime, partner, statusLabel, nextHint, timeline, chat }: TxWorkspaceProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);
  const [modal, setModal] = useState<{ action: AvailableAction; fields: Field[]; overrideKey?: string } | null>(null);
  const [confirmChoice, setConfirmChoice] = useState<AvailableAction | null>(null);
  const [acceptChoice, setAcceptChoice] = useState<AvailableAction | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ key: string; label: string; phase?: PhaseKey } | null>(null);

  const showToast = (ok: boolean, message: string) => {
    setToast({ ok, message });
    setTimeout(() => setToast(null), 3000);
  };

  const dispatch = (input: TransactionActionInput) => {
    startTransition(async () => {
      const result = await runTransactionAction(input);
      if (result.ok) {
        showToast(true, "更新しました");
        router.refresh();
      } else {
        showToast(false, result.error.message);
      }
    });
  };

  const onAction = (action: AvailableAction) => {
    // 受注側の「取引を開始」は、売掛保証を適用するか選ぶモーダルを開く。
    if (action.key === "startTransaction") {
      setAcceptChoice(action);
      return;
    }
    // 元請の「完了確認 / 是正依頼」は確認 or 是正の二択モーダルを開く。
    if (action.key === "confirmWork") {
      setConfirmChoice(action);
      return;
    }
    const fields = FIELDS[action.key];
    if (!fields) {
      // 入力なしの操作も、実行前に必ず確認する。
      setConfirmAction({ key: action.key, label: action.label, phase: action.phase });
      return;
    }
    setModal({ action, fields });
  };

  const sectionActions = (section: AvailableAction["section"]) => actions.filter((a) => a.section === section);
  const hasPending = (section: AvailableAction["section"]) => sectionActions(section).length > 0;

  return (
    <div className="space-y-3 p-4 pb-24">
      {/* 現在のステータス */}
      <div className="rounded-2xl bg-(--color-brand-blue-light) p-4 text-center">
        <div className="text-[12px] font-bold text-(--color-brand-blue)">現在のステータス</div>
        <div className="text-[20px] font-black text-(--color-brand-blue)">{statusLabel}</div>
        {nextHint && <div className="mt-1 text-[12px] text-(--color-brand-sub)">{nextHint}</div>}
      </div>

      {/* あなたの操作（要対応） */}
      <div className="rounded-2xl border border-(--color-brand-amber) bg-(--color-brand-amber-soft) p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[13px] font-bold text-(--color-brand-ink)">あなたの操作（要対応）</span>
          <span className="rounded-full bg-(--color-brand-amber) px-2 py-0.5 text-[11px] font-bold text-white">{actions.length}</span>
          <span className="ml-auto text-[11px] font-semibold text-(--color-brand-sub)">{role === "prime" ? "元請として表示" : "協力会社として表示"}</span>
        </div>
        {actions.length === 0 ? (
          <div className="text-[12.5px] text-(--color-brand-sub)">いま対応が必要な操作はありません。</div>
        ) : (
          <div className="flex flex-col gap-2">
            {actions.map((action, i) => (
              <button
                key={`${action.key}-${action.phase ?? ""}-${i}`}
                disabled={pending}
                onClick={() => onAction(action)}
                className="rounded-xl bg-(--color-brand-blue) px-4 py-2.5 text-[14px] font-bold text-white disabled:opacity-50"
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 契約書類 */}
      <Section title="契約書類（注文書・注文請書）" highlight={hasPending("order")}>
        <Row label="注文書" value={tx.order.order ? `発行済み（${dmd(tx.order.order.issuedAt)}）` : "未発行"} />
        <Row label="注文請書" value={tx.order.acknowledgement ? `発行済み（${dmd(tx.order.acknowledgement.issuedAt)}）` : "未発行"} />
      </Section>

      {/* 作業フェーズ（請負＝組立/解体、応援＝作業のみ） */}
      {activePhaseKeys(tx).map((phase) => (
        <PhasePanel key={phase} tx={tx} phase={phase} highlight={hasPending(phase)} />
      ))}

      {/* 確認事項 / 相談 */}
      <Section title="確認事項・運営への相談" highlight={hasPending("issue")}>
        {tx.issues.length === 0 && tx.consultations.length === 0 && <div className="text-[12.5px] text-(--color-brand-sub)">確認事項はありません。</div>}
        {tx.issues.map((issue, i) => (
          <div key={i} className="mb-2 rounded-xl bg-(--color-brand-bg) p-3">
            <div className="text-[12.5px] font-semibold">{issue.resolved ? "✅ 解決済み" : "⚠️ 未解決"}</div>
            <div className="text-[12.5px] text-(--color-brand-sub)">{issue.text}</div>
          </div>
        ))}
        {tx.consultations.map((c, i) => (
          <div key={i} className="mb-2 rounded-xl bg-(--color-brand-bg) p-3 text-[12.5px] text-(--color-brand-sub)">運営へ相談: {c.text}</div>
        ))}
        <div className="mt-2 flex gap-2">
          <SmallButton disabled={pending} onClick={() => setModal({ action: { key: "raiseIssue", label: "確認事項を登録", urgent: false, section: "issue" }, fields: FIELDS.raiseIssue })}>
            確認事項を登録
          </SmallButton>
          <SmallButton disabled={pending} onClick={() => setModal({ action: { key: "requestConsultation", label: "運営へ相談", urgent: false, section: "issue" }, fields: FIELDS.requestConsultation })}>
            運営へ相談
          </SmallButton>
        </div>
      </Section>

      {/* 工期・予定変更 */}
      <Section title="工期・予定" highlight={hasPending("schedule")}>
        {tx.scheduleNotice && !tx.scheduleNotice.acknowledged && (
          <div className="mb-2.5 rounded-xl border border-(--color-brand-amber) bg-(--color-brand-amber-soft) p-3">
            <div className="mb-1.5 text-[12.5px] font-bold" style={{ color: "#9A6612" }}>
              {role === "prime" ? "工期・予定を変更しました（相手の確認待ち）" : "工期・予定の変更があります（要確認）"}
            </div>
            {tx.scheduleNotice.changes.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-1.5 text-[12.5px]" style={{ color: "#7A5410" }}>
                <span className="font-bold">{c.field}</span>
                <span className="line-through opacity-70">{dmd(c.from)}</span>
                <span>→</span>
                <span className="font-bold">{dmd(c.to)}</span>
              </div>
            ))}
          </div>
        )}
        <Row label="工期" value={`${dmd(tx.overallSchedule.plannedStart)}〜${dmd(tx.overallSchedule.plannedEnd)}`} />
        {activePhaseKeys(tx).map((phase) => (
          <Row
            key={phase}
            label={phaseLabel(tx, phase) ? `${phaseLabel(tx, phase)}予定` : "作業予定"}
            value={`${dmd(tx.phases[phase].schedule.plannedStart)}〜${dmd(tx.phases[phase].schedule.plannedEnd)}`}
          />
        ))}
        {role === "prime" && tx.status !== "completed" && (
          <div className="mt-2.5">
            <SmallButton disabled={pending} onClick={() => setScheduleOpen(true)}>
              工期・予定を変更する
            </SmallButton>
          </div>
        )}
      </Section>

      {/* 案件情報 */}
      <Section title="案件情報 / 当事者" highlight={hasPending("info")}>
        {tx.infoNotice && !tx.infoNotice.acknowledged && (
          <div className="mb-2.5 rounded-xl border border-(--color-brand-amber) bg-(--color-brand-amber-soft) p-3">
            <div className="mb-1.5 text-[12.5px] font-bold" style={{ color: "#9A6612" }}>
              {role === "prime" ? "案件情報を変更しました（相手の確認待ち）" : "案件情報の変更があります（要確認）"}
            </div>
            {tx.infoNotice.changes.map((c, i) => (
              <div key={i} className="flex flex-wrap items-center gap-x-1.5 text-[12.5px]" style={{ color: "#7A5410" }}>
                <span className="font-bold">{c.field}</span>
                <span className="line-through opacity-70">{c.from}</span>
                <span>→</span>
                <span className="font-bold">{c.to}</span>
              </div>
            ))}
          </div>
        )}
        <Row label="現場" value={`${tx.region} ${tx.address}`} />
        <Row label="元請" value={`${prime.name}（${LEVEL_JP[prime.level] ?? prime.level}）`} />
        <Row label="協力会社" value={`${partner.name}（${LEVEL_JP[partner.level] ?? partner.level}）`} />
        <Row
          label={`金額内訳（${tx.payType === "progress" ? "出来高" : "一括"}）`}
          value={yen(activePhaseKeys(tx).reduce((s, k) => s + (tx.phases[k].amount ?? 0), 0))}
        />
        {activePhaseKeys(tx).length > 1 &&
          activePhaseKeys(tx).map((phase) => (
            <Row
              key={phase}
              label={`　└ ${phaseLabel(tx, phase)}分`}
              value={`${yen(tx.phases[phase].amount)}${tx.phases[phase].bill.status !== "none" ? "（請求開始済み）" : ""}`}
            />
          ))}
        <Row label="支払条件" value={`${tx.closing}締め / ${tx.payTerm}払い`} />
        <Row label="売掛保証" value={tx.startedAt ? (tx.guaranteed ? "適用（受注側が選択）" : "なし") : "受注時に受注側が選択"} />
        {role === "prime" && tx.status !== "completed" && (
          <div className="mt-2">
            <SmallButton disabled={pending} onClick={() => setInfoOpen(true)}>
              現場・金額を変更する
            </SmallButton>
          </div>
        )}
        <div className="mt-2 flex items-center gap-2">
          <SmallButton disabled={pending || tx.ashibase.linked} onClick={() => setConfirmAction({ key: "linkAshiBase", label: "AshiBaseへ連携" })}>
            {tx.ashibase.linked ? "AshiBase連携済み" : "AshiBaseへ連携"}
          </SmallButton>
        </div>
      </Section>

      {/* 案件チャット（応募〜取引で同一チャットを継続） */}
      <Section title="案件チャット" defaultOpen>
        <div className="mb-2 text-[12px] text-(--color-brand-sub)">応募時からのやり取りをそのまま継続できます。</div>
        {chat ? (
          <>
            <ChatBox projectId={chat.projectId} partnerCompanyId={chat.partnerCompanyId} role={chat.role} messages={chat.messages} embedded />
            <div className="mt-2 text-right">
              <Link href={`/projects/${chat.projectId}/chat/${chat.partnerCompanyId}`} className="text-[12.5px] font-bold text-(--color-brand-blue)">
                全画面で開く ›
              </Link>
            </div>
          </>
        ) : (
          <div className="text-[12.5px] text-(--color-brand-sub)">チャットは本番環境（Supabase接続時）で利用できます。</div>
        )}
      </Section>

      {/* 信用タイムライン：この取引で起きたこと（完了時に信用実績へ反映） */}
      <div>
        <div className="mb-2 flex items-center gap-1.5 px-1">
          <span className="h-3.5 w-1 rounded-full bg-(--color-brand-green)" />
          <span className="text-[13.5px] font-bold text-(--color-brand-ink)">信用タイムライン</span>
        </div>
        <CreditTimeline entries={timeline} />
      </div>

      {/* 入力モーダル */}
      {modal && (
        <FormModal
          title={modal.action.label}
          fields={modal.fields}
          pending={pending}
          defaults={defaultsFor(tx, modal.action)}
          onClose={() => setModal(null)}
          onSubmit={(payload) => {
            dispatch({ txId: tx.id, key: modal.overrideKey ?? modal.action.key, phase: modal.action.phase, payload });
            setModal(null);
          }}
        />
      )}

      {/* 工期・予定の変更（元請）：現在値を初期表示し、変更分だけ通知される */}
      {scheduleOpen &&
        (() => {
          const l = (phase: PhaseKey) => phaseLabel(tx, phase) || "作業";
          const fields: Field[] = [
            { name: "overallStart", label: "工期 開始", type: "date" },
            { name: "overallEnd", label: "工期 終了", type: "date" },
            ...activePhaseKeys(tx).flatMap((phase): Field[] => [
              { name: `${phase}Start`, label: `${l(phase)} 開始予定`, type: "date" },
              { name: `${phase}End`, label: `${l(phase)} 完了予定`, type: "date" },
            ]),
          ];
          const defaults: Record<string, string> = {
            overallStart: tx.overallSchedule.plannedStart ?? "",
            overallEnd: tx.overallSchedule.plannedEnd ?? "",
            ...Object.fromEntries(
              activePhaseKeys(tx).flatMap((phase) => [
                [`${phase}Start`, tx.phases[phase].schedule.plannedStart ?? ""],
                [`${phase}End`, tx.phases[phase].schedule.plannedEnd ?? ""],
              ]),
            ),
          };
          return (
            <FormModal
              title="工期・予定を変更"
              fields={fields}
              defaults={defaults}
              pending={pending}
              onClose={() => setScheduleOpen(false)}
              onSubmit={(payload) => {
                dispatch({ txId: tx.id, key: "changeSchedule", payload });
                setScheduleOpen(false);
              }}
            />
          );
        })()}

      {/* 案件情報（現場・金額）の変更（元請）。金額は未請求フェーズのみ編集可。 */}
      {infoOpen &&
        (() => {
          const editablePhases = activePhaseKeys(tx).filter((phase) => tx.phases[phase].bill.status === "none");
          const fields: Field[] = [
            { name: "region", label: "現場（地域）", type: "text" },
            { name: "address", label: "現場住所", type: "text" },
            ...editablePhases.map((phase): Field => ({ name: `${phase}Amount`, label: `${phaseLabel(tx, phase) || ""}金額`, type: "money" })),
          ];
          const defaults: Record<string, string> = {
            region: tx.region ?? "",
            address: tx.address ?? "",
            ...Object.fromEntries(editablePhases.map((phase) => [`${phase}Amount`, tx.phases[phase].amount != null ? fmtMoney(tx.phases[phase].amount as number) : ""])),
          };
          return (
            <FormModal
              title="現場・金額を変更"
              fields={fields}
              defaults={defaults}
              pending={pending}
              onClose={() => setInfoOpen(false)}
              onSubmit={(payload) => {
                dispatch({ txId: tx.id, key: "updateTransactionInfo", payload });
                setInfoOpen(false);
              }}
            />
          );
        })()}

      {/* 取引開始（受注側の受諾）：売掛保証の適用可否を選ぶ */}
      {acceptChoice && (
        <AcceptModal
          pending={pending}
          onClose={() => setAcceptChoice(null)}
          onConfirm={(guaranteed) => {
            dispatch({ txId: tx.id, key: "startTransaction", phase: acceptChoice.phase, payload: { guaranteed: guaranteed ? "on" : "" } });
            setAcceptChoice(null);
          }}
        />
      )}

      {/* 入力なし操作の確認 */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.label}
          pending={pending}
          onClose={() => setConfirmAction(null)}
          onConfirm={() => {
            dispatch({ txId: tx.id, key: confirmAction.key, phase: confirmAction.phase });
            setConfirmAction(null);
          }}
        />
      )}

      {/* 完了確認 / 是正依頼の二択 */}
      {confirmChoice && (
        <ChoiceModal
          title={confirmChoice.label}
          onClose={() => setConfirmChoice(null)}
          onConfirm={() => {
            dispatch({ txId: tx.id, key: "confirmWork", phase: confirmChoice.phase });
            setConfirmChoice(null);
          }}
          onRework={() => {
            setModal({ action: { ...confirmChoice, label: "是正・手直しを依頼" }, fields: FIELDS.requestRework, overrideKey: "requestRework" });
            setConfirmChoice(null);
          }}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-[13px] font-bold text-white shadow-lg"
          style={{ background: toast.ok ? "var(--color-brand-green)" : "var(--color-brand-red)" }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

function defaultsFor(tx: Transaction, action: AvailableAction): Record<string, string> {
  const d: Record<string, string> = {};
  for (const f of FIELDS[action.key] ?? []) {
    if (f.type === "date") d[f.name] = TODAY;
  }
  if (action.key === "submitInvoice" && action.phase) {
    const amount = tx.phases[action.phase].amount;
    if (amount != null) d.amount = fmtMoney(amount);
  }
  if ((action.key === "registerPayment" || action.key === "confirmDeposit") && action.phase) {
    const inv = tx.phases[action.phase].bill.invoice;
    if (inv) d.amount = fmtMoney(inv.amount);
  }
  return d;
}

function Section({ title, highlight, defaultOpen, children }: { title: string; highlight?: boolean; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(!!highlight || !!defaultOpen);
  return (
    <div
      className="overflow-hidden rounded-2xl border bg-white"
      style={{ borderColor: highlight ? "var(--color-brand-amber)" : "var(--color-brand-line)" }}
    >
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <span className="text-[13.5px] font-bold text-(--color-brand-ink)">{title}</span>
        {highlight && <span className="rounded-full bg-(--color-brand-amber) px-2 py-0.5 text-[10.5px] font-bold text-white">要対応</span>}
        <span className="ml-auto text-(--color-brand-faint)">{open ? "▲" : "▼"}</span>
      </button>
      {open && <div className="border-t border-(--color-brand-line) px-4 py-3">{children}</div>}
    </div>
  );
}

function PhasePanel({ tx, phase, highlight }: { tx: Transaction; phase: PhaseKey; highlight?: boolean }) {
  const p = tx.phases[phase];
  const label = phaseLabel(tx, phase); // 応援（単相）は空文字
  return (
    <Section title={label ? `${label}フェーズ` : "作業フェーズ"} highlight={highlight}>
      <Row label="予定" value={`${dmd(p.schedule.plannedStart)}〜${dmd(p.schedule.plannedEnd)}`} />
      <Row label="実績" value={`${dmd(p.work.startDate)}〜${dmd(p.work.endDate)}`} />
      <Row label="作業" value={WORK_JP[p.work.status]} />
      <Row label="請求" value={BILL_JP[p.bill.status]} />
      {p.amount != null && <Row label="金額" value={yen(p.amount)} />}
      {p.work.rework && <div className="mt-1 rounded-lg bg-(--color-brand-amber-soft) p-2 text-[12px]">是正依頼: {p.work.rework.text}</div>}
    </Section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 border-b border-(--color-brand-line) py-2 last:border-0">
      <div className="w-24 shrink-0 text-[12px] font-semibold text-(--color-brand-sub)">{label}</div>
      <div className="text-[13px] font-semibold">{value}</div>
    </div>
  );
}

function SmallButton({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg border border-(--color-brand-blue) px-3 py-1.5 text-[12.5px] font-bold text-(--color-brand-blue) disabled:opacity-50"
    >
      {children}
    </button>
  );
}

function FormModal({
  title,
  fields,
  defaults,
  pending,
  onClose,
  onSubmit,
}: {
  title: string;
  fields: Field[];
  defaults: Record<string, string>;
  pending: boolean;
  onClose: () => void;
  onSubmit: (payload: Record<string, string>) => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(defaults);
  const [confirming, setConfirming] = useState(false);
  const set = (f: Field) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const raw = e.target.value;
    setValues((v) => ({ ...v, [f.name]: f.type === "money" ? fmtMoney(raw) : raw }));
  };
  const missingRequired = fields.some((f) => f.required && !(values[f.name] ?? "").trim());
  const display = (f: Field) => {
    const v = (values[f.name] ?? "").trim();
    if (!v) return "-";
    return f.type === "money" ? `¥${v}` : v;
  };

  return (
    <Overlay onClose={onClose}>
      <div className="text-[15px] font-bold">{title}</div>
      {!confirming ? (
        <>
          <div className="mt-3 space-y-3">
            {fields.map((f) => (
              <div key={f.name}>
                <label className="mb-1 block text-[12px] font-bold text-(--color-brand-sub)">
                  {f.label}
                  {f.required && <span className="ml-1 text-(--color-brand-red)">必須</span>}
                  {f.optional && <span className="ml-1 text-(--color-brand-faint)">任意</span>}
                </label>
                {f.type === "textarea" ? (
                  <textarea value={values[f.name] ?? ""} onChange={set(f)} rows={3} className="w-full rounded-lg border border-(--color-brand-line) px-3 py-2 text-[14px]" />
                ) : f.type === "money" ? (
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-bold text-(--color-brand-sub)">¥</span>
                    <input inputMode="numeric" value={values[f.name] ?? ""} onChange={set(f)} placeholder="0" className="w-full rounded-lg border border-(--color-brand-line) px-3 py-2 pl-7 text-[14px]" />
                  </div>
                ) : (
                  <input
                    type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
                    value={values[f.name] ?? ""}
                    onChange={set(f)}
                    className="w-full rounded-lg border border-(--color-brand-line) px-3 py-2 text-[14px]"
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={onClose} className="flex-1 rounded-xl border border-(--color-brand-line) py-2.5 text-[14px] font-bold text-(--color-brand-sub)">
              キャンセル
            </button>
            <button onClick={() => setConfirming(true)} disabled={missingRequired} className="flex-1 rounded-xl bg-(--color-brand-blue) py-2.5 text-[14px] font-bold text-white disabled:opacity-50">
              確認へ進む
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="mt-1 text-[12.5px] text-(--color-brand-sub)">この内容で実行します。よろしいですか？</div>
          <div className="mt-3 overflow-hidden rounded-xl border border-(--color-brand-line)">
            {fields.map((f, i) => (
              <div key={f.name} className="flex gap-3 px-3.5 py-2.5" style={{ borderBottom: i < fields.length - 1 ? "1px solid var(--color-brand-line)" : "none" }}>
                <div className="w-24 shrink-0 text-[12px] font-semibold text-(--color-brand-sub)">{f.label}</div>
                <div className="text-[13px] font-semibold text-(--color-brand-ink)">{display(f)}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-2">
            <button onClick={() => setConfirming(false)} className="flex-1 rounded-xl border border-(--color-brand-line) py-2.5 text-[14px] font-bold text-(--color-brand-sub)">
              戻る
            </button>
            <button onClick={() => onSubmit(values)} disabled={pending} className="flex-1 rounded-xl bg-(--color-brand-blue) py-2.5 text-[14px] font-bold text-white disabled:opacity-50">
              {pending ? "実行中…" : "実行する"}
            </button>
          </div>
        </>
      )}
    </Overlay>
  );
}

function ConfirmModal({ title, message, pending, onConfirm, onClose }: { title: string; message?: string; pending: boolean; onConfirm: () => void; onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <div className="text-[15px] font-bold">{title}</div>
      <div className="mt-2 text-[12.5px] text-(--color-brand-sub)">{message ?? "この操作を実行します。よろしいですか？"}</div>
      <div className="mt-4 flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-xl border border-(--color-brand-line) py-2.5 text-[14px] font-bold text-(--color-brand-sub)">キャンセル</button>
        <button onClick={onConfirm} disabled={pending} className="flex-1 rounded-xl bg-(--color-brand-blue) py-2.5 text-[14px] font-bold text-white disabled:opacity-50">
          {pending ? "実行中…" : "実行する"}
        </button>
      </div>
    </Overlay>
  );
}

function AcceptModal({ pending, onConfirm, onClose }: { pending: boolean; onConfirm: (guaranteed: boolean) => void; onClose: () => void }) {
  const [guaranteed, setGuaranteed] = useState(true);
  return (
    <Overlay onClose={onClose}>
      <div className="text-[15px] font-bold">取引を開始する</div>
      <div className="mt-2 text-[12.5px] text-(--color-brand-sub)">受注側として、この取引に売掛保証を適用するか選べます（代金を受け取る側の判断です）。</div>
      <button
        type="button"
        onClick={() => setGuaranteed((g) => !g)}
        className="mt-3 flex w-full items-center gap-2.5 rounded-2xl border p-3.5 text-left"
        style={{ background: guaranteed ? "var(--color-brand-green-soft)" : "#fff", borderColor: guaranteed ? "var(--color-brand-green)" : "var(--color-brand-line)" }}
      >
        <span className="text-[20px]" aria-hidden>🛡️</span>
        <div className="flex-1">
          <div className="text-[13.5px] font-bold text-(--color-brand-ink)">売掛保証をつける</div>
          <div className="text-[11.5px] text-(--color-brand-sub)">保証会社と連携予定（表示のみ）</div>
        </div>
        <span className="relative h-[26px] w-11 rounded-full transition-colors" style={{ background: guaranteed ? "var(--color-brand-green)" : "var(--color-brand-line)" }}>
          <span className="absolute top-[3px] h-5 w-5 rounded-full bg-white transition-all" style={{ left: guaranteed ? 21 : 3 }} />
        </span>
      </button>
      <div className="mt-4 flex gap-2">
        <button onClick={onClose} className="flex-1 rounded-xl border border-(--color-brand-line) py-2.5 text-[14px] font-bold text-(--color-brand-sub)">キャンセル</button>
        <button onClick={() => onConfirm(guaranteed)} disabled={pending} className="flex-1 rounded-xl bg-(--color-brand-blue) py-2.5 text-[14px] font-bold text-white disabled:opacity-50">取引を開始する</button>
      </div>
    </Overlay>
  );
}

function ChoiceModal({ title, onConfirm, onRework, onClose }: { title: string; onConfirm: () => void; onRework: () => void; onClose: () => void }) {
  return (
    <Overlay onClose={onClose}>
      <div className="text-[15px] font-bold">{title}</div>
      <div className="mt-2 text-[12.5px] text-(--color-brand-sub)">作業結果を確認して、完了として承認するか、是正・手直しを依頼します。</div>
      <div className="mt-4 space-y-2">
        <button onClick={onConfirm} className="w-full rounded-xl bg-(--color-brand-green) py-2.5 text-[14px] font-bold text-white">完了を確認する</button>
        <button onClick={onRework} className="w-full rounded-xl bg-(--color-brand-amber) py-2.5 text-[14px] font-bold text-white">是正・手直しを依頼</button>
        <button onClick={onClose} className="w-full rounded-xl border border-(--color-brand-line) py-2.5 text-[14px] font-bold text-(--color-brand-sub)">閉じる</button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-[360px] rounded-t-2xl bg-white p-5 sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}
