import { describe, expect, it } from "vitest";
import { chatTargetHref } from "../lib/chatTarget";

describe("chatTargetHref（チャット通知の遷移先を一元生成）", () => {
  it("取引成立後は取引詳細のチャットセクション（#tx-chat）へ", () => {
    expect(chatTargetHref({ txId: "t1", projectId: "p1", partnerCompanyId: "B" })).toBe("/transactions/t1#tx-chat");
  });
  it("取引成立前は全画面の案件チャットへ（companyId は協力会社ID）", () => {
    expect(chatTargetHref({ txId: null, projectId: "p1", partnerCompanyId: "B" })).toBe("/projects/p1/chat/B");
    expect(chatTargetHref({ projectId: "p1", partnerCompanyId: "B" })).toBe("/projects/p1/chat/B");
  });
});
