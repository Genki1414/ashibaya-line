"use client";

import { useState } from "react";

/**
 * 金額入力。入力中に自動で3桁区切り（22,000）を表示する。
 * 送信値はカンマ入りの文字列になるため、サーバー側で replace(/,/g,"") してから数値化する。
 */
export function MoneyInput({
  name,
  required,
  defaultValue,
  placeholder,
  className,
}: {
  name: string;
  required?: boolean;
  defaultValue?: number | string;
  placeholder?: string;
  className?: string;
}) {
  const init =
    defaultValue === undefined || defaultValue === "" ? "" : Number(String(defaultValue).replace(/[^\d]/g, "")).toLocaleString();
  const [value, setValue] = useState(init);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^\d]/g, "");
    setValue(digits ? Number(digits).toLocaleString() : "");
  };

  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[14px] text-(--color-brand-sub)">¥</span>
      <input
        name={name}
        value={value}
        onChange={onChange}
        inputMode="numeric"
        required={required}
        placeholder={placeholder}
        className={className ?? "w-full rounded-lg border border-(--color-brand-line) py-2 pl-7 pr-3 text-[14px]"}
      />
    </div>
  );
}
