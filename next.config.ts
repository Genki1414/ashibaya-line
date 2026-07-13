import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // クライアント側 Router Cache の保持時間（秒）。
    // dynamic の既定は 0（毎回サーバ往復）。一度開いたタブへの再遷移を
    // 瞬時にするため保持する。prefetch={true} の全体先読みは static 側を使う。
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
