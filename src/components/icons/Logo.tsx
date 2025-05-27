import type { SVGProps } from 'react';

const Logo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 200 50"
    width="120"
    height="30"
    aria-label="RSVP Now Logo"
    {...props}
  >
    <rect width="200" height="50" rx="5" fill="hsl(var(--primary))" />
    <text
      x="50%"
      y="50%"
      dominantBaseline="middle"
      textAnchor="middle"
      fontFamily="var(--font-geist-sans), sans-serif"
      fontSize="24"
      fontWeight="bold"
      fill="hsl(var(--primary-foreground))"
    >
      RSVP Now
    </text>
  </svg>
);

export default Logo;
