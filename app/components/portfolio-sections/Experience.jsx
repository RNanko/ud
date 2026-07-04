const experiences = [
  {
    period: "Mar 2025 — Present",
    role: "Software Developer (Self-Directed Projects)",
    company: "Personal / Open Source",
    description:
      "Building production-grade web applications alongside full-time work. Focused on React/Next.js ecosystems, data-driven interfaces, and AI integrations (RAG, API-based tools). Developing real-world projects to strengthen full-stack and AI engineering skills.",
    technologies: [
      "Python",
      "JavaScript",
      "TypeScript",
      "React",
      "Next.js",
      "Tailwind CSS",
      "Framer Motion",
      "AI APIs",
    ],
    current: true,
  },
  {
    period: "Nov 2025 — Present",
    role: "Production Planner / Data Analyst",
    company: "Reconext · Bydgoszcz, Poland",
    description:
      "Responsible for production planning, reporting, and operational analytics for global electronics manufacturing supply chains. Work closely with international partners (Foxconn, TPV, Wistron, BOEVT) to ensure efficient production flow, logistics coordination, and KPI-driven decision-making.",
    technologies: [
      "SQL",
      "Python",
      "Excel",
      "Power Query",
      "Data Analysis",
      "Supply Chain Planning",
    ],
    current: true,
  },
  {
    period: "Mar 2024 — Nov 2025",
    role: "Junior Production Planner",
    company: "Reconext · Bydgoszcz, Poland",
    description:
      "Supported production planning and operational reporting across manufacturing and repair workflows. Contributed to KPI tracking, reporting automation, and coordination between production and logistics teams.",
    technologies: ["Excel", "SQL", "Reporting", "Operations Support"],
    current: false,
  },
  {
    period: "2021 — 2024",
    role: "Material Handler",
    company: "Reconext · Bydgoszcz, Poland",
    description:
      "Worked in warehouse and logistics operations within an electronics manufacturing environment. Ensured accurate material flow, inventory control, and timely supply of production lines.",
    technologies: ["Warehouse Operations", "Logistics", "Inventory Control"],
    current: false,
  },
  {
    period: "2014 — 2020",
    role: "Master’s Degree — Accounting & Tax in International Business",
    company: "Sumy State University",
    description:
      "Academic background in accounting, taxation, and international business operations. Built strong analytical and structured thinking foundation.",
    technologies: [],
    current: false,
  },
];

export default function Experience() {
  return (
    <section id="experience" className="py-32 relative overflow-hidden">
      {/* Background blur */}
      <div
        className="absolute top-1/2 left-1/4 w-96 h-96 
        bg-primary/5 rounded-full blur-3xl -translate-y-1/2"
      />

      {/* Content */}
      <div className="container mx-auto px-6 relative z-10">
        <div className="max-w-3xl mb-16">
          <span
            className="text-secondary-foreground text-sm 
            font-medium tracking-wider uppercase animate-fade-in"
          >
            Career Journey
          </span>

          <h2
            className="text-4xl md:text-5xl font-bold 
            leading-tight animate-fade-in animation-delay-100 text-secondary-foreground"
          >
            Experience{" "}
            <span className="font-serif italic font-normal text-white">
              speaks volumes.
            </span>
          </h2>
          <p
            className="text-muted-foreground
           animate-fade-in animation-delay-200 my-6"
          >
            A timeline of my professional growth.
          </p>
        </div>

        {/* Timeline */}
        <div className="relative">
          <div
            className="timeline-glow absolute left-0 md:left-1/2 top-0 bottom-0 
          w-0.5 bg-linear-to-b from-primary/70 via-primary/30 to-transparent 
          md:-translate-x-1/2 shadow-[0_0_25px_rgba(32,178,166,0.8)]"
          />

          {/* Experince */}
          <div className="space-y-12">
            {experiences.map((exp, idx) => (
              <div
                key={idx}
                className="relative grid md:grid-cols-2 gap-8 animate-fade-in"
                style={{ animationDelay: `${(idx + 1) * 150}ms` }}
              >
                {/* Timeline Dot */}
                <div
                  className="absolute left-0 md:left-1/2 top-0 w-3 h-3 bg-primary
                rounded-full -translate-x-1/2 ring-4 ring-background z-10"
                >
                  {exp.current && (
                    <span
                      className="absolute inset-0 rounded-full bg-primary animate-ping 
                    opacity-75"
                    />
                  )}
                </div>

                {/* Content */}
                <div
                  className={`pl-8 md:pl-0 ${
                    idx % 2 === 0
                      ? "md:pr-16 md:text-right"
                      : "md:col-start-2 md:pl-16"
                  }`}
                >
                  <div
                    className={`glass p-6 rounded-2xl border-primary/30 
                    hover:border-primary/50 transition-all duration-500 
                    `}
                  >
                    <span className="text-sm text-primary font-medium">
                      {exp.period}
                    </span>
                    <h3 className="text-xl font-semibold mt-2">{exp.role}</h3>
                    <p className="text-muted-foreground">{exp.company}</p>
                    <p className="text-sm text-muted-foreground mt-4">
                      {exp.description}
                    </p>
                    <div
                      className={`flex flex-wrap gap-2 mt-4 ${
                        idx % 2 === 0 ? "md:justify-end" : ""
                      }`}
                    >
                      {exp.technologies.map((tech, techIdx) => (
                        <span
                          key={techIdx}
                          className="px-3 py-1 bg-surface rounded-full text-muted-foreground"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
