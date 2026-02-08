import { Code2, Lightbulb, Rocket, Users } from "lucide-react";

const highlights = [
  {
    icon: Code2,
    title: "Clean Code",
    description:
      "Writing maintainable, scalable code that stands the test of time.",
  },
  {
    icon: Rocket,
    title: "Performance",
    description:
      "Optimizing for speed and delivering lightning-fast user experiences.",
  },
  {
    icon: Users,
    title: "Collaboration",
    description: "Working closely with teams to bring ideas to life.",
  },
  {
    icon: Lightbulb,
    title: "Innovation",
    description:
      "Staying ahead with the latest technologies and best practices.",
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
              <span
                className="text-secondary-foreground text-sm 
      font-medium tracking-wider uppercase"
              >
                About Me
              </span>
            </div>

            <h2
              className="text-4xl md:text-5xl font-bold 
    leading-tight animate-fade-in animation-delay-100 text-secondary-foreground"
            >
              Turning ideas into
              <span className="font-serif italic font-normal text-white">
                {" "}
                real, working products.
              </span>
            </h2>

            <div className="space-y-4 text-muted-foreground animate-fade-in animation-delay-200">
              <p>
                I am a motivated software developer with a strong foundation in
                web development and problem solving. I enjoy
                understanding how systems work end-to-end and turning complex
                requirements into clean, maintainable solutions.
              </p>

              <p>
                My main focus is on modern JavaScript and frontend development
                using React, Next.js, and TypeScript. I build responsive,
                user-friendly interfaces and continuously improve my skills by
                working on real projects and learning best practices.
              </p>

              <p>
                Outside of coding, I actively grow my technical knowledge,
                experiment with new tools, and challenge myself through personal
                projects, continuous learning, and disciplined routines like
                training and self-development.
              </p>
            </div>

            <div className="glass rounded-2xl p-6 glow-border animate-fade-in animation-delay-300">
              <p className="text-lg font-medium italic text-foreground">
                &quot;I aim to build software that is clear, reliable, and
                enjoyable to use — solutions that bring real value to users and
                are easy to grow and maintain over time.&quot;
              </p>
            </div>
          </div>

          {/* Right Column - Hilights */}
          <div className="grid sm:grid-cols-2 gap-6">
            {highlights.map((item, idx) => (
              <div
                key={idx}
                className="glass p-6 rounded-2xl animate-fade-in"
                style={{
                  animationDelay: `${(idx + 1) * 100}ms`,
                }}
              >
                <div
                  className="w-12 h-12 rounded-xl bg-primary/10 flex 
                items-center justify-center mb-4 hover:bg-primary/20"
                >
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
