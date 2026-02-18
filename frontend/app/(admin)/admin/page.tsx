'use client';

import { useOrganizations } from '@/hooks/use-master-data';
import { useUsers } from '@/hooks/use-users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building2, FileText, Settings, Shield, Activity, ArrowRight, FileStack } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function AdminPage() {
  const { data: organizations, isLoading: orgsLoading } = useOrganizations();
  const { data: users, isLoading: usersLoading } = useUsers();

  const stats = [
    {
      title: 'Total Users',
      value: users?.length || 0,
      icon: Users,
      loading: usersLoading,
      href: '/admin/access-control/users',
      color: 'text-blue-600',
    },
    {
      title: 'Organizations',
      value: organizations?.length || 0,
      icon: Building2,
      loading: orgsLoading,
      href: '/admin/access-control/organizations',
      color: 'text-green-600',
    },
    {
      title: 'System Logs',
      value: 'View',
      icon: Activity,
      loading: false,
      href: '/admin/monitoring/system-logs',
      color: 'text-orange-600',
    },
  ];

  const quickLinks = [
    {
      title: 'User Management',
      description: 'Manage system users, roles, and permissions',
      href: '/admin/access-control/users',
      icon: Users,
    },
    {
      title: 'Organizations',
      description: 'Manage project organizations and companies',
      href: '/admin/access-control/organizations',
      icon: Building2,
    },
    {
      title: 'Workflow Config',
      description: 'Configure document approval workflows',
      href: '/admin/doc-control/workflows',
      icon: FileText,
    },
    {
      title: 'Security & RBAC',
      description: 'Configure roles, permissions, and security settings',
      href: '/admin/access-control/roles',
      icon: Shield,
    },
    {
      title: 'Numbering System',
      description: 'Setup document numbering templates',
      href: '/admin/doc-control/numbering',
      icon: Settings,
    },
    {
      title: 'Drawing Master Data',
      description: 'Manage drawing categories, volumes, and classifications',
      href: '/admin/doc-control/drawings',
      icon: FileStack,
    },
  ];

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-2">System overview and quick access to administrative functions.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, index) => (
          <Card key={index} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              {stat.loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
              {stat.href && (
                <Link href={stat.href} className="text-xs text-muted-foreground hover:underline mt-1 inline-block">
                  View details
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Access</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link, index) => (
            <Link key={index} href={link.href}>
              <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer border-l-4 border-l-transparent hover:border-l-primary">
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <link.icon className="mr-2 h-5 w-5 text-primary" />
                    {link.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{link.description}</p>
                  <Button variant="ghost" className="mt-4 p-0 h-auto font-normal text-primary hover:no-underline group">
                    Go to module <ArrowRight className="ml-1 h-3 w-3 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
