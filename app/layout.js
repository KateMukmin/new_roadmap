import './globals.css';

export const metadata = {
  title: 'New Roadmap',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
