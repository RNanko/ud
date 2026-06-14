import "./index.css";


import Navbar from "@/app/components/shared/portfolio/Navbar";
import Hero from "@/app/components/portfolio-sections/Hero";
import About from "@/app/components/portfolio-sections/About";
import Projects from "@/app/components/portfolio-sections/Projects";
import Experience from "@/app/components/portfolio-sections/Experience";


export default function page() {
  return (
    <div className="min-h-screen ">
      <Navbar />
      <main>
        <Hero />
        <About />
        <Projects />
        <Experience />

      </main>
    </div>
  );
}

