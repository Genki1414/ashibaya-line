"use client";

/** 印刷ダイアログを開く（ブラウザの「PDFに保存」でPDF化できる）。印刷時は自身を隠す。 */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full bg-(--color-brand-blue) px-6 py-3 text-[14px] font-bold text-white shadow-lg print:hidden"
    >
      🖨 印刷 / PDFに保存
    </button>
  );
}
