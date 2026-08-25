import type { Metadata, Viewport } from 'next';
import './globals.css';
import PwaRegister from './pwa-register';

export const metadata: Metadata = {
  title: '乾坤節奏王｜節奏互動遊戲',
  description: '跟著節拍辨識手勢、顏色與數字，訓練反應、專注及左右手協調。',
  manifest: './manifest.webmanifest',
  applicationName: '乾坤節奏王',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: '乾坤節奏王',
  },
  formatDetection: { telephone: false },
  icons: {
    icon: './favicon.svg',
    apple: './icon-192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fff8ec',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}<PwaRegister /></body></html>;
}

