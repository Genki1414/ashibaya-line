import { describe, expect, it } from "vitest";
import {
  canViewDocument,
  resolveTier,
  validateUpload,
  isPreviewableImage,
  isHeic,
  isPdf,
  MAX_DOC_BYTES,
  type DocVisibility,
} from "./index";

describe("resolveTier", () => {
  it("未ログインは none、強い関係を優先", () => {
    expect(resolveTier({ isLoggedIn: false, isPrime: false, isSelected: false, isApplicant: false })).toBe("none");
    expect(resolveTier({ isLoggedIn: true, isPrime: true, isSelected: false, isApplicant: false })).toBe("prime");
    expect(resolveTier({ isLoggedIn: true, isPrime: false, isSelected: true, isApplicant: true })).toBe("selected");
    expect(resolveTier({ isLoggedIn: true, isPrime: false, isSelected: false, isApplicant: true })).toBe("applicant");
    expect(resolveTier({ isLoggedIn: true, isPrime: false, isSelected: false, isApplicant: false })).toBe("viewer");
  });
});

describe("canViewDocument", () => {
  const cases: [DocVisibility, string, boolean][] = [
    ["viewer", "viewer", true], ["applicant", "viewer", false], ["selected", "viewer", false],
    ["viewer", "applicant", true], ["applicant", "applicant", true], ["selected", "applicant", false],
    ["viewer", "selected", true], ["applicant", "selected", true], ["selected", "selected", true],
    ["viewer", "prime", true], ["applicant", "prime", true], ["selected", "prime", true],
    ["viewer", "none", false], ["applicant", "none", false], ["selected", "none", false],
  ];
  it.each(cases)("visibility=%s tier=%s → %s", (vis, tier, expected) => {
    expect(canViewDocument(vis, tier as never)).toBe(expected);
  });

  it("応募者は選定限定を見られない／登録会社は応募限定を見られない", () => {
    expect(canViewDocument("selected", "applicant")).toBe(false);
    expect(canViewDocument("applicant", "viewer")).toBe(false);
  });
});

describe("validateUpload（許可リスト）", () => {
  it("画像・PDF・Office・テキストは許可", () => {
    for (const f of ["a.jpg", "a.png", "a.heic", "b.pdf", "c.docx", "d.xlsx", "e.pptx", "f.csv", "g.txt"]) {
      expect(validateUpload(f, 1000).ok).toBe(true);
    }
  });
  it("危険な実行形式・未知拡張子は拒否", () => {
    for (const f of ["a.exe", "a.bat", "a.sh", "a.js", "a.msi", "a.apk", "a.zip", "noext"]) {
      expect(validateUpload(f, 1000).ok).toBe(false);
    }
  });
  it("25MB超過は拒否・0以下も拒否", () => {
    expect(validateUpload("a.pdf", MAX_DOC_BYTES + 1).ok).toBe(false);
    expect(validateUpload("a.pdf", MAX_DOC_BYTES).ok).toBe(true);
    expect(validateUpload("a.pdf", 0).ok).toBe(false);
  });
});

describe("プレビュー判定", () => {
  it("通常画像はサムネイル可、HEICは不可（DL誘導）、PDFは別扱い", () => {
    expect(isPreviewableImage("a.jpg")).toBe(true);
    expect(isPreviewableImage("a.heic")).toBe(false);
    expect(isHeic("a.heic")).toBe(true);
    expect(isPdf("a.pdf")).toBe(true);
    expect(isPreviewableImage("a.pdf")).toBe(false);
  });
});
