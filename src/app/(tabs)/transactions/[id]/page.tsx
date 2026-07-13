import { notFound } from "next/navigation";
import { AppShell } from "@/components/app/AppShell";
import { TxWorkspace } from "@/components/tx/TxWorkspace";
import { loadTxDetail, statusLabel } from "@/server/txData";
import { availableActions, nextHint } from "@/domain/transaction";

export const dynamic = "force-dynamic";

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await loadTxDetail(id);
  if (!detail) notFound();
  const { tx, role, prime, partner, timeline } = detail;

  return (
    <AppShell title={tx.projectName} back="/transactions" noPad>
      <TxWorkspace
        tx={tx}
        role={role}
        actions={availableActions(tx, role)}
        prime={prime}
        partner={partner}
        statusLabel={statusLabel(tx)}
        nextHint={nextHint(tx)}
        timeline={timeline}
      />
    </AppShell>
  );
}
