'use client';

import { UserMenu } from './user-menu';
import { GlobalSearch } from './global-search';
import { NotificationsDropdown } from './notifications-dropdown';
import { MobileSidebar } from './sidebar';
import { ThemeToggle } from './theme-toggle';
import { ProjectSwitcher } from './project-switcher';

export function Header() {
  return (
    <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/90 px-6 backdrop-blur">
      <div className="flex flex-1 items-center gap-4">
        <MobileSidebar />
        <h2 className="hidden text-lg font-semibold text-foreground md:block">LCBP3-DMS</h2>
        <div className="ml-0 w-full max-w-md md:ml-4">
          <GlobalSearch />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <ProjectSwitcher />
        <ThemeToggle />
        <NotificationsDropdown />
        <UserMenu />
      </div>
    </header>
  );
}
