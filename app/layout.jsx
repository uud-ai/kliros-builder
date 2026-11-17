import './globals.css';
import { PT_Serif, Inter } from 'next/font/google';

const ptSerif = PT_Serif({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '700'],
  style: ['normal', 'italic'],
  variable: '--font-pt-serif',
  display: 'swap',
});

const inter = Inter({
  subsets: ['cyrillic', 'latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata = {
  title: 'Клиросный конструктор богослужений',
  description: 'Богослужебные указания Патриархии.ру с текстами Часослова, Октоиха и Минеи',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru" className={`${ptSerif.variable} ${inter.variable}`}>
      <body
        style={{
          fontFamily: 'var(--font-pt-serif), Georgia, Cambria, serif',
          fontVariantLigatures: 'common-ligatures',
          fontFeatureSettings: '"kern" 1, "liga" 1, "ccmp" 1, "mark" 1, "mkmk" 1',
          textRendering: 'optimizeLegibility',
        }}
      >
        {children}
      </body>
    </html>
  );
}