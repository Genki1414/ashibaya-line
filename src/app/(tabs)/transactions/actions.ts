"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { CompanyId, TransactionId } from "@/domain/shared";
import { AppResult, appErr } from "@/application";
import { getContainer, ACTING_COMPANY_COOKIE } from "@/server/container";
import type { Transaction } from "@/domain/transaction";
import type { PhaseKey, ScheduleChangeInput } from "@/domain/transaction";

export interface TransactionActionInput {
  readonly txId: string;
  readonly key: string;
  readonly phase?: PhaseKey;
  readonly payload?: Record<string, string>;
}

function str(payload: Record<string, string> | undefined, key: string): string {
  return payload?.[key] ?? "";
}
function num(payload: Record<string, string> | undefined, key: string): number {
  // 金額欄は3桁区切りで届くことがあるため数字以外を除去してから数値化する。
  return Number(String(payload?.[key] ?? "0").replace(/[^\d.]/g, "") || 0);
}
function optNum(payload: Record<string, string> | undefined, key: string): number | null {
  const raw = payload?.[key];
  if (raw === undefined || raw === "") return null;
  return Number(String(raw).replace(/[^\d.]/g, "") || 0);
}

/**
 * 取引コマンドの単一ディスパッチャ。key は availableActions が返すユースケース名に一致するので、
 * UI 側は key と入力値を渡すだけでよい（権限判定・状態遷移はドメイン＋アプリ層が担う）。
 */
export async function runTransactionAction(input: TransactionActionInput): Promise<AppResult<Transaction>> {
  const container = await getContainer();
  const company = container.actingCompanyId;
  const txId = input.txId as unknown as TransactionId;
  const phase = input.phase ?? "assembly";
  const svc = container.txService;
  const p = input.payload;

  let result: AppResult<Transaction>;
  switch (input.key) {
    case "startTransaction":
      result = await svc.accept(company, txId, str(p, "guaranteed") === "on");
      break;
    case "issueOrder":
      result = await svc.issueOrder(company, txId);
      break;
    case "acknowledgeOrder":
      result = await svc.acknowledgeOrder(company, txId);
      break;
    case "startWork":
      result = await svc.startWork(company, txId, phase, { date: str(p, "date"), people: optNum(p, "people") });
      break;
    case "recordDailySession":
      result = await svc.recordDailySession(company, txId, phase, {
        date: str(p, "date"),
        kind: str(p, "kind") === "end" ? "end" : "start",
        people: optNum(p, "people"),
        note: str(p, "note") || null,
      });
      break;
    case "reportWorkCompletion":
      result = await svc.reportWorkCompletion(company, txId, phase, {
        date: str(p, "date"),
        days: num(p, "days"),
        people: optNum(p, "people"),
        content: str(p, "content"),
        photoCount: num(p, "photoCount"),
      });
      break;
    case "confirmWork":
      result = await svc.confirmWork(company, txId, phase);
      break;
    case "requestRework":
      result = await svc.requestRework(company, txId, phase, str(p, "text"));
      break;
    case "completeRework":
      result = await svc.completeRework(company, txId, phase);
      break;
    case "submitInvoice":
      result = await svc.submitInvoice(company, txId, phase, {
        amount: num(p, "amount"),
        issuedAt: str(p, "issuedAt"),
        dueDate: str(p, "dueDate"),
        bankAccount: str(p, "bankAccount"),
      });
      break;
    case "checkInvoice":
      result = await svc.checkInvoice(company, txId, phase);
      break;
    case "registerPayment":
      result = await svc.registerPayment(company, txId, phase, { amount: num(p, "amount"), paidAt: str(p, "paidAt"), method: str(p, "method") || "銀行振込" });
      break;
    case "confirmDeposit":
      result = await svc.confirmDeposit(company, txId, phase, { amount: num(p, "amount"), confirmedAt: str(p, "confirmedAt") });
      break;
    case "raiseIssue":
      result = await svc.raiseIssue(company, txId, str(p, "text"));
      break;
    case "resolveIssue":
      result = await svc.resolveIssue(company, txId);
      break;
    case "requestConsultation":
      result = await svc.requestConsultation(company, txId, str(p, "text"));
      break;
    case "acknowledgeSchedule":
      result = await svc.acknowledgeSchedule(company, txId);
      break;
    case "acknowledgeInfo":
      result = await svc.acknowledgeInfo(company, txId);
      break;
    case "changeSchedule": {
      const sched = (sk: string, ek: string): { plannedStart: string | null; plannedEnd: string | null } | undefined => {
        const s = str(p, sk);
        const e = str(p, ek);
        return s || e ? { plannedStart: s || null, plannedEnd: e || null } : undefined;
      };
      const input: ScheduleChangeInput = {
        overallSchedule: sched("overallStart", "overallEnd"),
        assemblySchedule: sched("assemblyStart", "assemblyEnd"),
        dismantleSchedule: sched("dismantleStart", "dismantleEnd"),
      };
      result = await svc.changeSchedule(company, txId, input);
      break;
    }
    case "updateTransactionInfo": {
      const amount = (k: string): number | undefined => {
        const raw = str(p, k);
        return raw === "" ? undefined : Number(raw.replace(/[^\d]/g, ""));
      };
      result = await svc.updateTransactionInfo(company, txId, {
        region: p && "region" in p ? str(p, "region") : undefined,
        address: p && "address" in p ? str(p, "address") : undefined,
        assemblyAmount: amount("assemblyAmount"),
        dismantleAmount: amount("dismantleAmount"),
      });
      break;
    }
    case "linkAshiBase":
      result = await svc.linkAshiBase(company, txId);
      break;
    default:
      result = appErr({ code: "UNKNOWN_ACTION", message: "不明な操作です" });
  }

  if (result.ok) {
    revalidatePath("/transactions");
    revalidatePath(`/transactions/${input.txId}`);
  }
  return result;
}

/** 擬似ログイン（操作する会社）の切り替え。v8 の元請/協力ロールスイッチの置き換え。 */
export async function setActingCompany(companyId: string): Promise<void> {
  const store = await cookies();
  store.set(ACTING_COMPANY_COOKIE, CompanyId(companyId), { path: "/", httpOnly: false, sameSite: "lax" });
  revalidatePath("/", "layout");
}
