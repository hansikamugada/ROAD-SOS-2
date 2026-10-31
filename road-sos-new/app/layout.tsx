import type { Metadata } from 'next';
import './globals.css';
import { Header } from '@/components/header';
import { SosButton } from '@/components/sos-button';
export const metadata: Metadata = { title: 'ROAD SOS — Smart Roadside Assistance', description: 'Connect with nearby roadside mechanics when your vehicle needs help.' };
export default function RootLayout({ children }: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body><Header/>{children}<SosButton/></body></html>; }
