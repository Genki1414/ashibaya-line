"use server";

import { revalidatePath } from "next/cache";
import {
  createProjectDocUploadUrl,
  addProjectDocument,
  deleteProjectDocument,
  changeDocVisibility,
  updateDocMeta,
  reorderDoc,
  type AddDocInput,
  type DocsResult,
} from "@/server/projectDocs";
import type { DocVisibility } from "@/domain/projectDocs";

function revalidate(projectId: string) {
  revalidatePath(`/projects/${projectId}/documents`);
  revalidatePath(`/projects/${projectId}`);
}

export async function createDocUploadUrlAction(projectId: string, filename: string, size: number) {
  return createProjectDocUploadUrl(projectId, filename, size);
}

export async function addDocumentAction(projectId: string, input: AddDocInput): Promise<DocsResult> {
  const r = await addProjectDocument(projectId, input);
  if (r.ok) revalidate(projectId);
  return r;
}

export async function deleteDocumentAction(projectId: string, documentId: string): Promise<DocsResult> {
  const r = await deleteProjectDocument(documentId);
  if (r.ok) revalidate(projectId);
  return r;
}

export async function changeVisibilityAction(projectId: string, documentId: string, to: DocVisibility): Promise<DocsResult> {
  const r = await changeDocVisibility(documentId, to);
  if (r.ok) revalidate(projectId);
  return r;
}

export async function updateMetaAction(projectId: string, documentId: string, patch: { fileName?: string; documentType?: string; description?: string }): Promise<DocsResult> {
  const r = await updateDocMeta(documentId, patch);
  if (r.ok) revalidate(projectId);
  return r;
}

export async function reorderAction(projectId: string, documentId: string, dir: "up" | "down"): Promise<DocsResult> {
  const r = await reorderDoc(documentId, dir);
  if (r.ok) revalidate(projectId);
  return r;
}
