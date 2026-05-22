'use client';

import { useOrganizations } from '@/hooks/use-master-data';
import { useUsers } from '@/hooks/use-users';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Building2, Activity, ArrowRight, Shield, FolderOpen, BookOpen, Ruler, Brain } from 'lucide-react';
import Link from 'next/link';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

export default function AdminPage() {
  const { data: organizations, isLoading: orgsLoading } = useOrganizations();
  const { data: users, isLoading: usersLoading } = useUsers();

  const stats = [
    {
      title: 'ผู้ใช้งานทั้งหมด',
      subtitle: 'Total Users',
      value: users?.length || 0,
      icon: Users,
      loading: usersLoading,
      href: '/admin/access-control/users',
      color: 'text-blue-600',
      bg: 'bg-blue-50 dark:bg-blue-950/30',
    },
    {
      title: 'องค์กร',
      subtitle: 'Organizations',
      value: organizations?.length || 0,
      icon: Building2,
      loading: orgsLoading,
      href: '/admin/access-control/organizations',
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    },
    {
      title: 'บันทึกการปฏิบัติการ',
      subtitle: 'Operations Log',
      value: 'ดูทั้งหมด',
      icon: Activity,
      loading: false,
      href: '/admin/monitoring/audit-logs',
      color: 'text-orange-600',
      bg: 'bg-orange-50 dark:bg-orange-950/30',
    },
  ];

  const groups = [
    {
      label: 'ผู้ใช้งาน & การเข้าถึง',
      sublabel: 'Identity & Access',
      href: '/admin/access-control/users',
      icon: Shield,
      color: 'text-blue-600',
      hoverBorder: 'hover:border-l-blue-500',
      description: 'จัดการผู้ใช้, บทบาท, สิทธิ์ และองค์กรในระบบ',
    },
    {
      label: 'ตั้งค่าโครงการ',
      sublabel: 'Project Setup',
      href: '/admin/doc-control/projects',
      icon: FolderOpen,
      color: 'text-violet-600',
      hoverBorder: 'hover:border-l-violet-500',
      description: 'โครงการ, สัญญา, รูปแบบเลขที่เอกสาร และ Workflow',
    },
    {
      label: 'ข้อมูลอ้างอิง',
      sublabel: 'Reference Data',
      href: '/admin/doc-control/reference/disciplines',
      icon: BookOpen,
      color: 'text-teal-600',
      hoverBorder: 'hover:border-l-teal-500',
      description: 'สาขาวิชาชีพ, ประเภท RFA, ประเภทหนังสือ และแท็ก',
    },
    {
      label: 'ข้อมูลแบบ Drawing',
      sublabel: 'Drawing Master',
      href: '/admin/doc-control/drawings/contract/volumes',
      icon: Ruler,
      color: 'text-amber-600',
      hoverBorder: 'hover:border-l-amber-500',
      description: 'Volume, หมวดหมู่ และหมวดหมู่ย่อย สำหรับ Contract & Shop Drawing',
    },
    {
      label: 'การปฏิบัติการ',
      sublabel: 'Operations',
      href: '/admin/monitoring/audit-logs',
      icon: Activity,
      color: 'text-rose-600',
      hoverBorder: 'hover:border-l-rose-500',
      description: 'Audit Log, System Log, Active Sessions และ Migration Queue',
    },
    {
      label: 'AI Console',
      sublabel: 'AI Intelligence',
      href: '/admin/ai',
      icon: Brain,
      color: 'text-purple-600',
      hoverBorder: 'hover:border-l-purple-500',
      description: 'ตรวจสอบ AI Queue, Analytics และ Threshold Recalibration',
    },
  ];

  return (
    <div className="space-y-8 p-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground mt-1">ภาพรวมระบบและเมนูลัดสำหรับงานบริหารจัดการ</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                <p className="text-xs text-muted-foreground">{stat.subtitle}</p>
              </div>
              <div className={`p-2 rounded-lg ${stat.bg}`}>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              {stat.loading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stat.value}</div>
              )}
              {stat.href && (
                <Link href={stat.href} className="text-xs text-muted-foreground hover:underline mt-1 inline-block">
                  ดูรายละเอียด
                </Link>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-1">เมนูหลัก</h2>
        <p className="text-sm text-muted-foreground mb-4">เลือกกลุ่มงานที่ต้องการจัดการ</p>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <Link key={group.href} href={group.href}>
              <Card className={`h-full hover:bg-muted/50 transition-colors cursor-pointer border-l-4 border-l-transparent ${group.hoverBorder}`}>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2">
                    <group.icon className={`h-5 w-5 ${group.color}`} />
                    <span className="flex flex-col">
                      <span className="text-base font-semibold leading-tight">{group.label}</span>
                      <span className="text-xs font-normal text-muted-foreground leading-tight">{group.sublabel}</span>
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{group.description}</p>
                  <Button variant="ghost" className="mt-3 p-0 h-auto font-normal text-primary hover:no-underline group/btn">
                    เข้าสู่เมนู <ArrowRight className="ml-1 h-3 w-3 group-hover/btn:translate-x-1 transition-transform" />
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
