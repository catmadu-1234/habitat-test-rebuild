import SanityImage from "@/components/ui/SanityImage";
import Section from "@/components/ui/Section";
import SectionHeader from "@/components/ui/SectionHeader";
import { fetchRequired } from "@/sanity/lib/fetch";
import { HOME_VALUES_QUERY } from "@/sanity/queries";

export default async function Values() {
  const values = await fetchRequired(HOME_VALUES_QUERY);

  return (
    <Section top="sm" bottom="md">
      <SectionHeader
        label={values.label}
        title={values.title}
        size="h4"
        spacing="tight"
        className="animate-on-scroll mb-14 md:mb-20"
      />

      <div className="grid grid-cols-1 gap-8 md:gap-12 lg:grid-cols-2 lg:gap-[132px]">
        <div className="animate-on-scroll relative h-[362px] overflow-hidden rounded-card border border-brand-purple/16 lg:h-auto">
          <SanityImage
            image={values.image}
            quality={90}
            fill
            sizes="(min-width: 992px) 622px, 100vw"
            className="object-cover"
          />
        </div>

        <div className="border-t border-brand-purple/16">
          {(values.items ?? []).map((item) => (
            <div
              key={item._key}
              className="animate-on-scroll grid grid-cols-1 gap-3 border-b border-brand-purple/16 py-4 md:grid-cols-2 md:gap-4 md:py-6"
            >
              <div className="font-medium text-brand-purple">{item.title}</div>
              <div className="text-brand-purple">{item.description}</div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
