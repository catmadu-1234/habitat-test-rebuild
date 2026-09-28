import { Manrope } from "next/font/google";
import localFont from "next/font/local";

export const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-manrope",
  display: "swap",
});

// PP Woodland (Pangram Pangram), licensed; only the Regular weight is used on the homepage.
export const woodland = localFont({
  src: "./fonts/PPWoodland-Regular.woff2",
  weight: "400",
  variable: "--font-woodland",
  display: "swap",
});
