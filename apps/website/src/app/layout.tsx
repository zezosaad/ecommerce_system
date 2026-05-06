import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VendorHub',
  description: 'Multi-vendor marketplace',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  return <>{children}</>;
}
