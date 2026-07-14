import { describe, expect, it } from "vitest";
import { extensionOf, validateUpload, MAX_DOC_BYTES } from "./index";

/**
 * 資料アップロードの敵対的入力（品質強化パス）。
 * 許可リスト方式が「二重拡張子・パストラバーサル・危険な実行形式・大文字」を確実に弾くことを固定する。
 */
describe("extensionOf（敵対的なファイル名）", () => {
  it.each([
    ["a.pdf.exe", "exe"], // 二重拡張子 → 最後のセグメントで判定（=exe）
    ["a.jpeg.exe", "exe"],
    ["../../etc/passwd", ""], // パストラバーサル・拡張子なし
    ["photo.JPG", "jpg"], // 大文字は小文字化
    ["archive.tar.gz", "gz"], // 圧縮の最後の拡張子
    ["file", ""], // 拡張子なし
    [".gitignore", "gitignore"], // ドットファイル
    ["a.", ""], // 末尾ドットのみ
    ["evil.php5", "php5"],
  ])("%s → %s", (name, ext) => {
    expect(extensionOf(name)).toBe(ext);
  });
});

describe("validateUpload（許可リストの厳格性）", () => {
  it("二重拡張子で実行形式を偽装しても拒否（最後の拡張子で判定）", () => {
    for (const f of ["report.pdf.exe", "photo.jpg.bat", "sheet.xlsx.js", "a.jpeg.exe"]) {
      const v = validateUpload(f, 1000);
      expect(v.ok).toBe(false);
    }
  });

  it("パストラバーサル・拡張子なしは拒否", () => {
    expect(validateUpload("../../etc/passwd", 1000).ok).toBe(false);
    expect(validateUpload("noext", 1000).ok).toBe(false);
    expect(validateUpload(".gitignore", 1000).ok).toBe(false);
  });

  it("大文字拡張子でも許可形式は通す", () => {
    for (const f of ["PHOTO.JPG", "Plan.PNG", "Doc.PDF", "Sheet.XLSX"]) {
      expect(validateUpload(f, 1000).ok).toBe(true);
    }
  });

  it("危険/未知の拡張子は網羅的に拒否", () => {
    for (const f of ["a.exe", "a.bat", "a.cmd", "a.sh", "a.ps1", "a.js", "a.jsx", "a.ts", "a.html", "a.svg", "a.msi", "a.dmg", "a.apk", "a.jar", "a.zip", "a.rar", "a.7z", "a.tar", "a.gz", "a.php", "a.php5", "a.py", "a.rb"]) {
      expect(validateUpload(f, 1000).ok).toBe(false);
    }
  });

  it("サイズ境界（0以下・NaN・上限ちょうど・上限+1）", () => {
    expect(validateUpload("a.pdf", 0).ok).toBe(false);
    expect(validateUpload("a.pdf", -1).ok).toBe(false);
    expect(validateUpload("a.pdf", Number.NaN).ok).toBe(false);
    expect(validateUpload("a.pdf", Number.POSITIVE_INFINITY).ok).toBe(false);
    expect(validateUpload("a.pdf", 1).ok).toBe(true);
    expect(validateUpload("a.pdf", MAX_DOC_BYTES).ok).toBe(true);
    expect(validateUpload("a.pdf", MAX_DOC_BYTES + 1).ok).toBe(false);
  });
});
