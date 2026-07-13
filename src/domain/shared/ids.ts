export type CompanyId = string & { readonly __brand: "CompanyId" };
export type ProjectId = string & { readonly __brand: "ProjectId" };
export type TransactionId = string & { readonly __brand: "TransactionId" };

export const CompanyId = (value: string): CompanyId => value as CompanyId;
export const ProjectId = (value: string): ProjectId => value as ProjectId;
export const TransactionId = (value: string): TransactionId => value as TransactionId;
