import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'VendorHub Dashboard',
  description: 'Admin and merchant dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactNode {
  return <>{children}</>;
}
