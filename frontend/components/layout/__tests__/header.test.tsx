// File: frontend/components/layout/__tests__/header.test.tsx
// Change Log
// - 2026-06-13: Add coverage for Header composition.

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Header } from '../header';

vi.mock('../user-menu', () => ({ UserMenu: () => <div>User menu</div> }));
vi.mock('../global-search', () => ({ GlobalSearch: () => <label>Search<input aria-label="Search" /></label> }));
vi.mock('../notifications-dropdown', () => ({ NotificationsDropdown: () => <button>Notifications</button> }));
vi.mock('../sidebar', () => ({ MobileSidebar: () => <button>Mobile sidebar</button> }));
vi.mock('../theme-toggle', () => ({ ThemeToggle: () => <button>Theme</button> }));
vi.mock('../project-switcher', () => ({ ProjectSwitcher: () => <button>Project</button> }));

describe('Header', () => {
  it('renders application title and composed controls', () => {
    render(<Header />);
    expect(screen.getByText('LCBP3-DMS')).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mobile sidebar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Project' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Theme' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(screen.getByText('User menu')).toBeInTheDocument();
  });
});
