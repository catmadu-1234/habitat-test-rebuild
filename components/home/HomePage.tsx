import Blog from "./Blog";
import Contact from "./Contact";
import Hero from "./Hero";
import Products from "./Products";
import Values from "./Values";

export default function HomePage({ locale }: { locale: string }) {
  return (
    <>
      <Hero locale={locale} />
      <Values locale={locale} />
      <Products locale={locale} />
      <Blog locale={locale} />
      <Contact locale={locale} />
    </>
  );
}
