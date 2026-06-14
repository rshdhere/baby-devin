export function AuthDivider() {
  return (
    <div className="my-6 flex items-center gap-4">
      <div className="h-px flex-1 bg-[#333]" />
      <span className="text-[12px] font-medium tracking-wider text-gray-500 uppercase">
        or
      </span>
      <div className="h-px flex-1 bg-[#333]" />
    </div>
  );
}
