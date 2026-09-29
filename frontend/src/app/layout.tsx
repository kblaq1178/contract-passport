import type { ReactNode } from 'react';
import './globals.css';
import { WalletProvider } from '../components/WalletConnect';

export const metadata = {
  title: 'Contract Passport',
  description:
    'A self-attested on-chain registry for Stacks smart contracts — built with Scaffold Stacks.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="bg-[#131416]">
      <body className="bg-[#131416] text-white">
        <WalletProvider>
          {children}
        </WalletProvider>
      </body>
    </html>
  );
}
