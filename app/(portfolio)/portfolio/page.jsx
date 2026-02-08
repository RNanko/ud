import "./index.css";


import Navbar from "@/components/shared/portfolio/Navbar";
import Hero from "@/components/portfolio-sections/Hero";
import About from "@/components/portfolio-sections/About";
import Projects from "@/components/portfolio-sections/Projects";
import Experience from "@/components/portfolio-sections/Experience";


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

