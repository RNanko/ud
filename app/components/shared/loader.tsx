const Loader = ({ label = "Loading…" }: { label?: string }) => {
  return (
    <div role="status" aria-live="polite" className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="flex h-8 items-end gap-2">
        <span className="jump block size-3 rounded-full bg-chart-1" />
        <span className="jump block size-3 rounded-full bg-chart-2" />
        <span className="jump block size-3 rounded-full bg-chart-3" />
      </div>
    </div>
  );
};


export default Loader;
