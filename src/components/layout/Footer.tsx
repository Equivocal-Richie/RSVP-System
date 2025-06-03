
import Link from 'next/link';
import { Heart } from 'lucide-react';

const Footer = () => {
  return (
    <footer className="w-full border-t border-border bg-card text-card-foreground mt-auto">
      <div className="container mx-auto px-4 py-6 text-center text-sm text-muted-foreground">
        Made with <Heart className="inline h-4 w-4 text-red-500 fill-red-500" /> by{' '}
        <Link
          href="https://richardmuchoki.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-primary hover:underline"
        >
          Richie
        </Link>
      </div>
    </footer>
  );
};

export default Footer;
