import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-brand-bg">
      <Sidebar />
      <main className="flex-1 overflow-y-auto bg-brand-bg">
        <TopBar />
        <div className="w-full max-w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 animate-fadeIn">
          {children}
        </div>
      </main>
    </div>
  );
}
