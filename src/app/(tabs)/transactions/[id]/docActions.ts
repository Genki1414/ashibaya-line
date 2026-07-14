"use server";

import { revalidatePath } from "next/cache";
import { createProjectDocUploadUrl, addProjectDocument, type AddDocInput, type DocsResult } from "@/server/projectDocs";

/** 取引画面からの添付アップロード用 署名付きURL（元請のみ・許可リスト＋サイズ検証はサーバ側）。 */
export async function createTxDocUploadUrlAction(projectId: string, filename: string, size: number) {
  return createProjectDocUploadUrl(projectId, filename, size);
}

/**
 * 取引画面からの案件資料追加。公開範囲は「選定会社のみ(selected)」に固定する
 * （クライアント値は信用せずサーバ側で上書き）。追加後に取引詳細を再検証。
 */
export async function addTxDocumentAction(txId: string, projectId: string, input: Omit<AddDocInput, "visibility">): Promise<DocsResult> {
  const r = await addProjectDocument(projectId, { ...input, visibility: "selected" });
  if (r.ok) {
    revalidatePath(`/transactions/${txId}`);
    revalidatePath(`/projects/${projectId}`);
    revalidatePath(`/projects/${projectId}/documents`);
  }
  return r;
}
