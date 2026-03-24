import type { Metadata, Viewport } from "next";
import {
  Architects_Daughter,
  Caveat_Brush,
  Geist,
  Geist_Mono,
  Gloria_Hallelujah,
  Handlee,
  Inter,
  Kalam,
  Lato,
  Montserrat,
  Oswald,
  Patrick_Hand,
  Permanent_Marker,
  Playfair_Display,
  Poppins,
  Roboto,
  Rock_Salt,
} from "next/font/google";
import "./globals.css";

const RAW_SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.VERCEL_PROJECT_PRODUCTION_URL ||
  "https://www.thesteakkitchenph.com";

const SITE_URL = RAW_SITE_URL.startsWith("http") ? RAW_SITE_URL : `https://${RAW_SITE_URL}`;
const SITE_DESCRIPTION = "Great steaks and delicious food delivered to your home.";
const SITE_TITLE = "The Steak Kitchen";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const roboto = Roboto({ variable: "--font-roboto", subsets: ["latin"], weight: ["400", "500", "700", "900"] });
const montserrat = Montserrat({ variable: "--font-montserrat", subsets: ["latin"], weight: ["400", "500", "700", "900"] });
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "700", "900"] });
const lato = Lato({ variable: "--font-lato", subsets: ["latin"], weight: ["400", "700", "900"] });
const playfairDisplay = Playfair_Display({ variable: "--font-playfair-display", subsets: ["latin"], weight: ["400", "700", "900"] });
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], weight: ["400", "500", "700"] });
const permanentMarker = Permanent_Marker({ variable: "--font-permanent-marker", subsets: ["latin"], weight: "400" });
const rockSalt = Rock_Salt({ variable: "--font-rock-salt", subsets: ["latin"], weight: "400" });
const caveatBrush = Caveat_Brush({ variable: "--font-caveat-brush", subsets: ["latin"], weight: "400" });
const patrickHand = Patrick_Hand({ variable: "--font-patrick-hand", subsets: ["latin"], weight: "400" });
const kalam = Kalam({ variable: "--font-kalam", subsets: ["latin"], weight: ["300", "400", "700"] });
const architectsDaughter = Architects_Daughter({ variable: "--font-architects-daughter", subsets: ["latin"], weight: "400" });
const handlee = Handlee({ variable: "--font-handlee", subsets: ["latin"], weight: "400" });
const gloriaHallelujah = Gloria_Hallelujah({ variable: "--font-gloria-hallelujah", subsets: ["latin"], weight: "400" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_TITLE,
    images: [
      {
        url: "/Logo-black.png",
        width: 1024,
        height: 1024,
        alt: SITE_TITLE,
      },
    ],
    locale: "en_PH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/Logo-black.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={[
          geistSans.variable,
          geistMono.variable,
          inter.variable,
          roboto.variable,
          montserrat.variable,
          poppins.variable,
          lato.variable,
          playfairDisplay.variable,
          oswald.variable,
          permanentMarker.variable,
          rockSalt.variable,
          caveatBrush.variable,
          patrickHand.variable,
          kalam.variable,
          architectsDaughter.variable,
          handlee.variable,
          gloriaHallelujah.variable,
        ].join(" ")}
      >
        {children}
      </body>
    </html>
  );
}
