import './styles.css';

export const metadata = {
  title: 'Noman Properties Outreach',
  description: 'Green-list outreach and property detail collection system'
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
