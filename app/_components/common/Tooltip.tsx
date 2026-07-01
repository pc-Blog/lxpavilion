export default function Tooltip({ text, children, position = "top" }: { text: string; children: React.ReactNode; position?: "top" | "bottom" }) {
  return (
    <span className="relative group/tip inline-flex">
      {children}
      <span className={`absolute left-1/2 -translate-x-1/2 glass-card !rounded-lg text-[11px] leading-relaxed font-medium px-3 py-1.5 w-max max-w-[360px] whitespace-normal text-left text-slate-600 dark:text-slate-300 opacity-0 group-hover/tip:opacity-100 transition-opacity pointer-events-none z-[100] ${position === "bottom" ? "top-full mt-2" : "bottom-full mb-2"}`}>
        {text}
      </span>
    </span>
  );
}
