import SanityImage from "@/components/ui/SanityImage";
import Section from "@/components/ui/Section";
import SectionHeader from "@/components/ui/SectionHeader";
import { ArrowIcon } from "@/components/ui/Icons";
import { fetchRequired } from "@/sanity/lib/fetch";
import { getLinks } from "@/sanity/lib/site";
import { HOME_PRODUCTS_QUERY } from "@/sanity/queries";

export default async function Products() {
  const [products, links] = await Promise.all([fetchRequired(HOME_PRODUCTS_QUERY), getLinks()]);

  // On tablet and desktop each card sticks while scrolling and is offset from
  // the previous one (`offset`), giving the staggered "stacking" effect.
  const cards = [
    { key: "messengerPigeon", href: links.messengerPigeon, offset: "" },
    { key: "podium", href: links.podium, offset: "md:mt-16" },
    { key: "liveServices", href: links.liveServices, offset: "md:mt-[120px]" },
  ] as const;

  return (
    <Section top="md" bottom="md">
      <SectionHeader
        label={products.label}
        title={products.title}
        description={products.description}
        align="center"
        className="animate-on-scroll mb-14 md:mb-20"
      />

      <div className="mx-auto grid max-w-products grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
        {cards.map(({ key, href, offset }) => {
          const card = products.items[key];
          return (
            <div key={key} className="relative">
              <div
                className={`flex min-h-[330px] flex-col items-start justify-between rounded-panel bg-lift p-6 md:sticky md:top-[360px] md:min-h-[443px] md:p-8 ${offset}`}
              >
                <h3 className="text-body-lg font-medium text-brand-purple">{card.title}</h3>
                <SanityImage
                  image={card.image}
                  width={118}
                  height={118}
                  className="mx-auto h-[90px] w-[90px] md:h-[118px] md:w-[118px]"
                />
                <div className="text-brand-purple">{card.description}</div>
                <a
                  href={href}
                  className="relative flex items-center gap-2.5 text-button font-medium text-brand-purple transition-colors hover:text-brand-purple/88"
                >
                  <ArrowIcon className="h-3 w-3 md:h-4 md:w-4" />
                  <span>{products.learnMore}</span>
                  <span className="absolute inset-x-0 bottom-0 h-px bg-brand-purple" />
                </a>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
