import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthContext } from "@/server/auth";
import { loadTxDetail } from "@/server/txData";
import { buildInvoiceDoc, buildStatementDoc, buildCertificateDoc, type TxDocType } from "@/lib/txDocs";
import { InvoiceView, StatementView, CertificateView } from "@/components/print/TxDocView";
import { PrintButton } from "@/components/print/PrintButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "帳票" };

const DOC_TYPES: TxDocType[] = ["invoice", "statement", "certificate"];

function Notice({ title, message, backHref }: { title: string; message: string; backHref: string }) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-(--color-brand-bg) p-8">
      <div className="max-w-[360px] rounded-2xl bg-white p-6 text-center">
        <div className="text-[14px] font-bold text-(--color-brand-ink)">{title}</div>
        <div className="mt-2 text-[12.5px] leading-relaxed text-(--color-brand-sub)">{message}</div>
        <Link href={backHref} className="mt-4 inline-block rounded-xl border border-(--color-brand-line) px-4 py-2 text-[13px] font-bold text-(--color-brand-blue)">取引に戻る</Link>
      </div>
    </div>
  );
}

export default async function TxPrintPage({ params }: { params: Promise<{ id: string; doc: string }> }) {
  const { id, doc } = await params;
  if (!DOC_TYPES.includes(doc as TxDocType)) {
    return <Notice title="不明な帳票です" message="指定された帳票は存在しません。" backHref={`/transactions/${id}`} />;
  }

  let ctx;
  try {
    ctx = await getAuthContext();
  } catch {
    redirect("/login");
  }
  if (!ctx.user) redirect(`/login?next=/print/tx/${id}/${doc}`);

  // loadTxDetail は当事者（元請/協力）でなければ null を返す（第三者は閲覧不可）。
  const detail = await loadTxDetail(id);
  if (!detail) {
    return <Notice title="この帳票は表示できません" message="取引が見つからないか、閲覧権限がありません。" backHref="/transactions" />;
  }

  const { tx, prime, partner } = detail;
  const issuedOn = new Date().toISOString().slice(0, 10);
  const backHref = `/transactions/${id}`;

  const back = (
    <Link href={backHref} className="fixed left-4 top-4 z-50 rounded-full border border-(--color-brand-line) bg-white px-3 py-1.5 text-[12px] font-bold text-(--color-brand-sub) shadow-sm print:hidden">‹ 取引に戻る</Link>
  );

  if (doc === "invoice") {
    const d = buildInvoiceDoc(tx, prime, partner);
    if (!d) return <Notice title="請求書はまだ発行できません" message="協力会社が請求書を提出すると発行できます。" backHref={backHref} />;
    return <>{back}<InvoiceView doc={d} txId={id} issuedOn={issuedOn} /><PrintButton /></>;
  }
  if (doc === "certificate") {
    const d = buildCertificateDoc(tx, prime, partner);
    if (!d) return <Notice title="証明書はまだ発行できません" message="取引が完了（入金確認まで）すると発行できます。" backHref={backHref} />;
    return <>{back}<CertificateView doc={d} txId={id} issuedOn={issuedOn} /><PrintButton /></>;
  }
  // statement
  const d = buildStatementDoc(tx, prime, partner);
  return <>{back}<StatementView doc={d} txId={id} /><PrintButton /></>;
}
