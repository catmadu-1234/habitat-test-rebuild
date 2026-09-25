import Blog from "@/components/home/Blog";
import Contact from "@/components/home/Contact";
import Hero from "@/components/home/Hero";
import Products from "@/components/home/Products";
import Values from "@/components/home/Values";

export default function HomePage() {
  return (
    <>
      <Hero />
      <Values />
      <Products />
      <Blog />
      <Contact />
    </>
  );
}
