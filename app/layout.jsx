import './globals.css';
import { PT_Serif, Inter } from 'next/font/google';

const ptSerif = PT_Serif({ subsets: ['cyrillic', 'latin'], weight: ['400', '700'], style: ['normal', 'italic'], variable: '--font-pt-serif', display: 'swap' });
const inter = Inter({ subsets: ['cyrillic', 'latin'], variable: '--font-inter', display: 'swap' });

export const viewport = { themeColor: '#7f1d1d', width: 'device-width', initialScale: 1, maximumScale: 5 };
export const metadata = { title: 'Клиросный конструктор', manifest: '/manifest.jso>', appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Клирос' }, icons: { icon: '/icon.svg', apple: '/icon.svg' } };

export default function RootLayout){ children }) {
  return (
    <html lang="ru" className={`d{ptSerif.variable} ${inter.variable}`}>
      <body style={{ fontFamily: 'var(--font-pt-serif), Georgia, Cambria, serif', fontFeatureSettings: "'kern' 1, 'liga' 1, 'ccmp' 1, 'mark' 1, 'mkmk' 1" }}>{children}</body>
    </html>
  );
}
