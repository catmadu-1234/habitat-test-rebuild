import { stegaClean } from "next-sanity";
import Label from "@/components/ui/Label";
import SanityImage from "@/components/ui/SanityImage";
import Section from "@/components/ui/Section";
import SectionHeader from "@/components/ui/SectionHeader";
import { ArrowLargeIcon } from "@/components/ui/Icons";
import { formatPostDate } from "@/lib/format-post-date";
import { fetchRequired } from "@/sanity/lib/fetch";
import { getLinks } from "@/sanity/lib/site";
import { HOME_BLOG_QUERY, HOME_POSTS_QUERY } from "@/sanity/queries";

export default async function Blog() {
  const [blog, posts, links] = await Promise.all([
    fetchRequired(HOME_BLOG_QUERY),
    fetchRequired(HOME_POSTS_QUERY),
    getLinks(),
  ]);

  return (
    <Section top="md">
      <SectionHeader
        label={blog.label}
        title={blog.title}
        size="h3"
        className="animate-on-scroll mb-12 md:mb-16"
      />

      <div className="flex flex-col gap-6 md:grid md:grid-cols-3 md:gap-x-4 md:gap-y-8">
        {posts.map((post) => (
          <a
            key={post._id}
            href={stegaClean(post.url)}
            className="animate-on-scroll flex flex-col gap-3 text-brand-purple md:gap-4"
          >
            <div className="relative h-[300px] overflow-hidden rounded-card md:h-[340px]">
              <SanityImage
                image={post.image}
                quality={90}
                fill
                sizes="(min-width: 768px) 448px, 358px"
                className="object-cover"
              />
            </div>
            <div className="flex flex-col gap-3 md:gap-4">
              <div className="flex items-center justify-between text-brand-purple/88">
                <Label>{post.category}</Label>
                <Label>{formatPostDate(stegaClean(post.date))}</Label>
              </div>
              <div className="font-heading text-h6">{post.title}</div>
            </div>
          </a>
        ))}
      </div>

      <div className="mt-12 flex justify-center md:mt-16">
        <a
          href={links.blog}
          aria-label={blog.nextPage}
          className="m-px flex items-center justify-center rounded-pill border border-brand-purple/16 px-3 py-2.5 text-brand-purple shadow-button backdrop-blur-[10px] transition-colors hover:border-paper/8 hover:bg-brand-purple/88 hover:text-paper md:px-4 md:py-3"
        >
          <ArrowLargeIcon className="h-5 w-5 md:h-6 md:w-6" />
        </a>
      </div>
    </Section>
  );
}
