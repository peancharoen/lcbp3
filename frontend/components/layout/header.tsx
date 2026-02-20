'use client';

import { UserMenu } from './user-menu';
import { GlobalSearch } from './global-search';
import { NotificationsDropdown } from './notifications-dropdown';
import { MobileSidebar } from './sidebar';

export function Header() {
  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1">
        <MobileSidebar />
        <h2 className="text-lg font-semibold text-gray-800 hidden md:block">LCBP3-DMS</h2>
        <div className="ml-0 md:ml-4 w-full max-w-md">
          <GlobalSearch />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <NotificationsDropdown />
        <UserMenu />
      </div>
    </header>
  );
}
