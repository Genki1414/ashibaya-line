/** 汎用の読み込み表示（認証・運営・トップなど、タブ以外のページ遷移で即表示）。 */
export default function RootLoading() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-(--color-brand-bg)">
      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-(--color-brand-line) border-t-(--color-brand-blue)" />
    </div>
  );
}
