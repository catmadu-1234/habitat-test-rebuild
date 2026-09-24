import { defineQuery } from "next-sanity";

// Query names must be unique across the codebase (TypeGen keys types by name).
export const SITE_SETTINGS_QUERY = defineQuery(
  `*[_type == "siteSettings" && _id == "siteSettings-en"][0]`,
);
export const SITE_META_QUERY = defineQuery(
  `*[_type == "siteSettings" && _id == "siteSettings-en"][0].meta`,
);
export const SITE_LINKS_QUERY = defineQuery(
  `*[_type == "siteSettings" && _id == "siteSettings-en"][0].links`,
);

export const HOME_HERO_QUERY = defineQuery(
  `*[_type == "homePage" && _id == "homePage-en"][0].hero`,
);
export const HOME_VALUES_QUERY = defineQuery(
  `*[_type == "homePage" && _id == "homePage-en"][0].values`,
);
export const HOME_PRODUCTS_QUERY = defineQuery(
  `*[_type == "homePage" && _id == "homePage-en"][0].products`,
);
export const HOME_BLOG_QUERY = defineQuery(
  `*[_type == "homePage" && _id == "homePage-en"][0].blog`,
);
export const HOME_CONTACT_QUERY = defineQuery(
  `*[_type == "homePage" && _id == "homePage-en"][0].contact`,
);

// Only complete posts: in Draft Mode a half-filled draft would otherwise crash the page mid-edit.
export const HOME_POSTS_QUERY = defineQuery(
  `*[_type == "post" && defined(date) && defined(url) && defined(image.asset)] | order(date desc)[0...3]`,
);
