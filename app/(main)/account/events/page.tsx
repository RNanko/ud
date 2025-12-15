export default function Page() {
  return (
    <section className="grid md:grid-cols-[1fr_200px] 2xl:grid-cols-[1fr_400px]">
      {/* SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <div className="w-full bg-amber-300">1</div>
        <div className="w-full bg-blue-600">1</div>
        <div className="w-full bg-gray-800">1</div>
        <div className="w-full bg-emerald-600">1</div>
      </div>

      {/* DROP */}
      <div className="w-full bg-accent-foreground hidden md:block">1</div>
    </section>
  );
}
// const DEFAULT_CARDS = [
//   { title: "Look into render bug in dashboard", id: "1", column: "backlog" },
//   { title: "SOX compliance checklist", id: "2", column: "backlog" },
//   { title: "[SPIKE] Migrate to Azure", id: "3", column: "backlog" },
//   { title: "Document Notifications service", id: "4", column: "backlog" },

//   { title: "Research DB for new service", id: "5", column: "todo" },
//   { title: "Postmortem for outage", id: "6", column: "todo" },
//   { title: "Sync with product", id: "7", column: "todo" },

//   { title: "Refactor to Zustand", id: "8", column: "doing" },
//   { title: "Add logging to cronjob", id: "9", column: "doing" },

//   { title: "Set up dashboards", id: "10", column: "done" },
// ];
