const experiences = [
  {
    period: "Mar 2025 — Present",
    role: "Frontend Developer (Student / Self-Directed)",
    company: "Independent Learning",
    description:
      "Actively building frontend development skills alongside full-time work. Focused on modern React-based ecosystems, responsive UI design, and animation. Developing real-world projects to strengthen practical understanding of component architecture and state management.",
    technologies: [
      "JS",
      "React JS",
      "SCSS",
      "Next.js",
      "Tailwind CSS",
      "Framer Motion",
      "TypeScript",
    ],
    current: true,
  },
  {
    period: "Nov 2025 — Present",
    role: "Production Planner",
    company: "Reconext · Bydgoszcz, Poland",
    description:
      "Manage production planning and reporting for one of the world’s leading monitor brands. Coordinate with global supply and manufacturing partners including Foxconn, TPV, BOEVT, and Wistron to ensure efficient B2B and B2C operations.",
    technologies: [
      "SQL",
      "Excel",
      "Data Analysis",
      "Supply Chain Coordination",
    ],
    current: true,
  },
  {
    period: "Mar 2024 — Nov 2025",
    role: "Junior Production Planner",
    company: "Reconext · Bydgoszcz, Poland",
    description:
      "Promoted due to strong performance and initiative. Supported production planning and coordination across global manufacturing partners, contributing to smoother production, repair, and shipping workflows.",
    technologies: ["Excel", "SQL", "Reporting", "Production Planning"],
    current: false,
  },

  {
    period: "2021 — 2024",
    role: "Material Handler",
    company: "Reconext · Bydgoszcz, Poland",
    description:
      "Built a strong foundation in logistics and warehouse operations within an electronics manufacturing environment. Supported material flow, inventory accuracy, and internal production processes during high-demand periods.",
    technologies: ["Warehouse Operations", "Logistics", "Inventory Control"],
    current: false,
  },
  {
    period: "2014 — 2020",
    role: "Student",
    company: "Sumy State University",
    description: "Master`s degree in Accounting and Tax in International Business",
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
