import React from 'react';
import Link from 'next/link';
import { Swords } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';

const Header = () => {
  return (
    <header className="py-4">
      <div className="container mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-2 text-primary hover:opacity-80 transition-opacity">
          <Swords className="h-6 w-6" />
          <span className="text-xl font-bold tracking-tighter">Check!</span>
        </Link>
        <div className="flex items-center space-x-6">
          <nav>
            <ul className="flex space-x-6">
              <li>
                <Link href="/how-to-play" className="text-muted-foreground hover:text-foreground transition-colors">
                  How to Play
                </Link>
              </li>
            </ul>
          </nav>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
};

export default Header; 