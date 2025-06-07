import React from 'react';

const Footer = () => {
  return (
    <footer className="py-6 mt-auto">
      <div className="container mx-auto text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Check! The Game.</p>
      </div>
    </footer>
  );
};

export default Footer; 