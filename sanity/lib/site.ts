import { cache } from "react";
import { stegaClean } from "next-sanity";
import { SITE_LINKS_QUERY, SITE_SETTINGS_QUERY } from "@/sanity/queries";
import { fetchRequired } from "./fetch";

export const getSiteSettings = cache(() => fetchRequired(SITE_SETTINGS_QUERY));

// URLs are never rendered as visible text, so strip stega before using them as hrefs.
export const getLinks = cache(async () => stegaClean(await fetchRequired(SITE_LINKS_QUERY)));
