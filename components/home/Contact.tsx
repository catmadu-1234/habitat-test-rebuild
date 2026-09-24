import Button from "@/components/ui/Button";
import Label from "@/components/ui/Label";
import SanityImage from "@/components/ui/SanityImage";
import Section from "@/components/ui/Section";
import SectionLabel from "@/components/ui/SectionLabel";
import { fetchRequired } from "@/sanity/lib/fetch";
import { getLinks } from "@/sanity/lib/site";
import { HOME_CONTACT_QUERY } from "@/sanity/queries";

const fieldStyles =
  "w-full rounded-lg border border-brand-purple/8 bg-brand-purple/8 px-3 py-2.5 md:px-4 md:py-3 text-brand-purple outline-none placeholder:text-brand-purple/48 focus:border-brand-purple/48 focus:bg-brand-purple/16";

export default async function Contact() {
  const [contact, links] = await Promise.all([fetchRequired(HOME_CONTACT_QUERY), getLinks()]);

  return (
    <Section
      top="md"
      bottom="md"
      className="bg-[url('/images/bg/purple-background.png')] bg-contain bg-fixed bg-center"
      backdrop={<div className="absolute inset-0 bg-brand-purple/32 backdrop-blur-[10px]" />}
    >
      <div className="rounded-panel bg-canvas p-8 text-brand-purple md:p-16">
        <div className="flex flex-col md:-mx-2.5 lg:flex-row">
          {/* Left: heading + partner logo marquee */}
          <div className="mb-12 flex flex-col justify-between gap-12 md:mb-16 md:gap-16 lg:mb-0 lg:w-1/2">
            <div className="flex flex-col items-start gap-4 md:gap-6">
              <h2 className="font-heading text-h2">{contact.title}</h2>
              {/* Matches the live site, where this paragraph is the same color as the panel. */}
              <p className="text-canvas">{contact.description}</p>
            </div>

            <div className="flex w-full flex-col items-start gap-6 border-t border-brand-purple/16 pt-6 md:gap-8 md:pt-8">
              <SectionLabel className="ml-[5px]">{contact.partnersLabel}</SectionLabel>
              <div className="relative flex h-[33px] w-full items-center overflow-hidden md:h-[47px]">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-14 bg-gradient-to-r from-paper to-transparent md:w-20" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-14 bg-gradient-to-l from-paper to-transparent md:w-20" />
                <div className="flex w-max animate-marquee">
                  {[0, 1].map((copy) => (
                    <ul
                      key={copy}
                      aria-hidden={copy === 1}
                      className="flex shrink-0 items-center gap-20 pr-20"
                    >
                      {contact.partners.map((partner) => (
                        <li key={partner._key}>
                          <SanityImage
                            image={partner}
                            alt={copy === 0 ? undefined : ""}
                            width={160}
                            height={47}
                            className="h-auto w-40 max-w-none"
                          />
                        </li>
                      ))}
                    </ul>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right: form.
              TODO: static placeholder. Wire up submission (Webflow form + Turnstile on the
              live site) once the backend is decided. The button links to the sign-up flow. */}
          <div className="flex flex-col items-start gap-4 pt-3.5 md:gap-5 md:pt-0 lg:w-1/2 lg:pb-5 lg:pl-content">
            <div className="flex w-full flex-col gap-2.5">
              <Label htmlFor="contact-name" className="text-brand-purple/64">
                {contact.form.nameLabel}
              </Label>
              <input
                id="contact-name"
                type="text"
                placeholder={contact.form.namePlaceholder}
                className={fieldStyles}
              />
            </div>
            <div className="flex w-full flex-col gap-2.5">
              <Label htmlFor="contact-email" className="text-brand-purple/64">
                {contact.form.emailLabel}
              </Label>
              <input
                id="contact-email"
                type="email"
                placeholder={contact.form.emailPlaceholder}
                className={fieldStyles}
              />
            </div>
            <div className="flex w-full flex-col gap-2.5">
              <Label htmlFor="contact-message" className="text-brand-purple/64">
                {contact.form.messageLabel}
              </Label>
              <textarea
                id="contact-message"
                placeholder={contact.form.messagePlaceholder}
                className={`${fieldStyles} h-[125px] resize-y`}
              />
            </div>
            <Button href={links.apply} withArrow>
              {contact.form.submit}
            </Button>
          </div>
        </div>
      </div>
    </Section>
  );
}
