import { ArrowUpRight, Github } from "lucide-react";
// import AnimatedBorderButton from "@/components/shared/portfolio/AnimatedBorderButton";
import Image from "next/image";

const projects = [
  {
    title: "UD",
    description:
      "Your Daily tools to optimize your life.",
    image: "/portfolio/UD.png",
    tags: ["React", "Typescript", "Next.JS", "Tailwind CSS"],
    link: "https://ud-youdaily.vercel.app/",
    github: "https://github.com/RNanko/ud",
  },
];

export default function Projects() {
  return (
    <section id="projects" className="py-16 relative overflow-hidden">
      {/* Bg */}
      <div className="absolute top-1/4 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-1/4 left-0 w-64 h-64 bg-highlight/5 rounded-full blur-3xl" />
      <div className="container mx-auto px-6 relative z-10">
        {/* Section Header */}
        <div className="text-center mx-auto max-w-2xl mb-16">
          <span
            className="text-secondary-foreground text-sm font-medium 
          tracking-wider uppercase animate-fade-in"
          >
            Featured Work
          </span>
          <h2
            className="text-4xl md:text-5xl font-bold mt-4 mb-6 animate-fade-in 
          animation-delay-100 text-secondary-foreground"
          >
            Projects that
            <span className="font-serif italic font-normal text-white">
              {" "}
              make inpact.
            </span>
          </h2>

        </div>

        {/* Projects Grid */}

        <div className="grid md:grid-cols-2 gap-8">
          {projects.map((project, idx) => (
            <div
              key={idx}
              className="group glass rounded-2xl overflow-hidden 
            animate-fade-in md:row-span-1"
            >
              {/* Image */}
              <div className="relative overflow-hidden aspect-video">
                <Image
                fill
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover 
                  transition-transform duration-500 group-hover:scale-110"
                />
                <h1>IMAHE</h1>
                <div
                  className="absolute inset-0 bg-linear-to-t from-card 
                via-card/50 to-transparent opacity-60"
                />
                {/* Overlay Links */}
                <div
                  className="absolute inset-0 z-15 flex items-center justify-center gap-4 
                opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                >
                  <a
                    href={project.link}
                    className="p-3 rounded-full glass hover:bg-primary 
                    hover:text-primary-foreground transition-all"
                  >
                    <ArrowUpRight className="w-5 h-5" />
                  </a>
                  <a href="#">
                    <Github className="w-5 h-5" />
                  </a>
                </div>
              </div>

              {/*  */}
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between">
                  <h3
                    className="text-xl font-semibold group-hover:text-primary 
                  transition-colors"
                  >
                    {project.title}
                  </h3>
                  <ArrowUpRight
                    className="w-5 h-5 text-muted-foreground group-hover:translate-1
                  transition-all"
                  />
                </div>
                <p className="text-muted-foreground text-sm">
                  {project.description}
                </p>
                <div className="flex flex-wrap gap-2">
                  {project.tags.map((tag, tagIdx) => (
                    <span
                      key={tagIdx}
                      className="px-4 py-1.5 rounded-full bg-surface text-xs 
                      font-medium border 
                      border-border/50 hover:border-primary/50 
                      hover:text-primary transition-all duration-300"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* View All CTA */}
        {/* <div className="text-center mt-12 animate-fade-in animation-delay-500">
          <AnimatedBorderButton>
            View All Projects
            <ArrowUpRight className="w-5 h-5" />
          </AnimatedBorderButton>
        </div> */}
      </div>
    </section>
  );
}
