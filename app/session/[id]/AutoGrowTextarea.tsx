"use client";

export default function AutoGrowTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => {
        const el = e.target;
        el.style.height = "auto";
        el.style.height = `${el.scrollHeight}px`;
        onChange(el.value);
      }}
      rows={1}
      className={
        className ??
        "w-full min-h-[90px] px-3 py-2.5 border-[1.5px] border-grey-200 rounded-lg text-[13px] resize-none overflow-hidden"
      }
    />
  );
}
