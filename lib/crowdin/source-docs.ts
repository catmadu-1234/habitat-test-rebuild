// Documents whose copy is translated. Blog posts are the same newest-three that the homepage shows.
export const SOURCE_IDS = ["homePage-en", "siteSettings-en"];

// Must stay identical to HOME_POSTS_QUERY in sanity/queries.ts (checked by source-docs.test.ts).
export const SOURCE_POSTS_QUERY = `*[_type == "post" && defined(date) && defined(url) && defined(image.asset)] | order(date desc)[0...3]`;
