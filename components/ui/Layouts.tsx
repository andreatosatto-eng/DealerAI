import React from 'react';

export const Container: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = "" }) => (
  <div className={`p-8 max-w-[1600px] mx-auto w-full ${className}`}>
    {children}
  </div>
);

export const Section: React.FC<{ title: string, children: React.ReactNode }> = ({ title, children }) => (
  <div className="mb-8">
    <h3 className="text-lg font-semibold text-brand-dark mb-4 border-b border-gray-200 pb-2 uppercase tracking-wide">
      {title}
    </h3>
    {children}
  </div>
);