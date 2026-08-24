import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '乾坤節奏王｜節奏互動遊戲',
  description: '跟著節拍辨識手勢、顏色與數字，訓練反應、專注及左右手協調。',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}

