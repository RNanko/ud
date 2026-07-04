import { Code2, Lightbulb, Rocket, Users } from "lucide-react";

const highlights = [
  {
    icon: Code2,
    title: "Data & Systems Thinking",
    description:
      "Designing SQL, Python, and data-driven systems that connect business logic with real operational data.",
  },
  {
    icon: Rocket,
    title: "Automation & Efficiency",
    description:
      "Building automated reporting and workflows that reduce manual work and improve decision speed.",
  },
  {
    icon: Users,
    title: "Cross-Team Collaboration",
    description:
      "Working with production, logistics, and planning teams to translate operations into clear analytics.",
  },
  {
    icon: Lightbulb,
    title: "AI & Modern Tech",
    description:
      "Integrating AI tools, RAG systems, and modern web technologies into real business use cases.",
  },
];

export default function About() {
  return (
    <section id="about" className="py-32 relative overflow-hidden">
      <div className="container mx-auto px-6 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Left Column */}
          <div className="space-y-8">
            <div className="animate-fade-in">
              <span className="text-secondary-foreground text-sm font-medium tracking-wider uppercase">
                About Me
              </span>
            </div>

            <h2 className="text-4xl md:text-5xl font-bold leading-tight animate-fade-in animation-delay-100 text-secondary-foreground">
              Turning data and ideas into
              <span className="font-serif italic font-normal text-white">
                {" "}real, working systems.
              </span>
            </h2>

            <div className="space-y-4 text-muted-foreground animate-fade-in animation-delay-200">
              <p>
                I’m a Business and Data Analyst with hands-on experience in manufacturing operations,
                production planning, and logistics. I specialize in turning operational data into
                structured insights that support real business decisions.
              </p>

              <p>
                My technical focus is on SQL, Python, and modern web development (React, Next.js).
                I build reporting systems, automate KPI tracking, and develop AI-powered tools that
                improve efficiency across business processes.
              </p>

              <p>
                I enjoy working at the intersection of data, software, and operations — especially
                where analytics can directly improve planning, forecasting, and decision-making in
                real production environments.
              </p>
            </div>

            <div className="glass rounded-2xl p-6 glow-border animate-fade-in animation-delay-300">
              <p className="text-lg font-medium italic text-foreground">
                I build systems that turn raw operational data into clear insights —
                helping teams move from guesswork to data-driven decisions.
              </p>
            </div>
          </div>

          {/* Right Column - Highlights */}
          <div className="grid sm:grid-cols-2 gap-6">
            {highlights.map((item, idx) => (
              <div
                key={idx}
                className="glass p-6 rounded-2xl animate-fade-in"
                style={{
                  animationDelay: `${(idx + 1) * 100}ms`,
                }}
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4 hover:bg-primary/20">
                  <item.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}