"use client";

import { UserMenu } from "./user-menu";
import { Button } from "@/components/ui/button";
import { GlobalSearch } from "./global-search";
import { NotificationsDropdown } from "./notifications-dropdown";

export function Header() {
  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6 sticky top-0 z-10">
      <div className="flex items-center gap-4 flex-1">
        <h2 className="text-lg font-semibold text-gray-800">LCBP3-DMS</h2>
        <div className="ml-4 w-full max-w-md">
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
