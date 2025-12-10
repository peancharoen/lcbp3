// File: app/(dashboard)/projects/page.tsx
"use client";

import { useState } from "react";
import { Plus, Search, MoreHorizontal, Folder, Calendar, BarChart3 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";

// Type สำหรับข้อมูล Project (Mockup ตาม Data Dictionary)
interface Project {
  id: number;
  projectCode: string;
  projectName: string;
  status: "Active" | "Completed" | "On Hold";
  progress: number;
  startDate: string;
  endDate: string;
  contractorName: string;
}

// Mock Data
const mockProjects: Project[] = [
  {
    id: 1,
    projectCode: "LCBP3",
    projectName: "โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3 (ส่วนที่ 1-4)",
    status: "Active",
    progress: 45,
    startDate: "2021-01-01",
    endDate: "2025-12-31",
    contractorName: "Multiple Contractors",
  },
  {
    id: 2,
    projectCode: "LCBP3-C1",
    projectName: "งานก่อสร้างงานทางทะเล (ส่วนที่ 1)",
    status: "Active",
    progress: 70,
    startDate: "2021-06-01",
    endDate: "2024-06-01",
    contractorName: "CNNC",
  },
  {
    id: 3,
    projectCode: "LCBP3-C2",
    projectName: "งานก่อสร้างอาคาร ท่าเทียบเรือ (ส่วนที่ 2)",
    status: "Active",
    progress: 15,
    startDate: "2023-01-01",
    endDate: "2026-01-01",
    contractorName: "ITD-NWR Joint Venture",
  },
];

export default function ProjectsPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProjects = mockProjects.filter((project) =>
    project.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.projectCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Active": return "success"; // ใช้ variant ที่เรา custom ไว้ใน badge.tsx
      case "Completed": return "default";
      case "On Hold": return "warning";
      default: return "secondary";
    }
  };

  const handleCreateProject = () => {
    router.push("/projects/new"); // อัปเดตเป็นลิงก์จริง
  };

  const handleViewDetails = (id: number) => {
    router.push(`/projects/${id}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Projects</h2>
          <p className="text-muted-foreground">
            จัดการโครงการ สัญญา และความคืบหน้า
          </p>
        </div>
        <Button onClick={handleCreateProject} className="w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" /> New Project
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center space-x-2">
        <div className="relative flex-1 md:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Desktop View: Table */}
      <div className="hidden rounded-md border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Code</TableHead>
              <TableHead>Project Name</TableHead>
              <TableHead>Contractor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[200px]">Progress</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProjects.map((project) => (
              <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewDetails(project.id)}>
                <TableCell className="font-medium">{project.projectCode}</TableCell>
                <TableCell>
                  <div className="flex flex-col">
                    <span>{project.projectName}</span>
                    <span className="text-xs text-muted-foreground">
                      {project.startDate} - {project.endDate}
                    </span>
                  </div>
                </TableCell>
                <TableCell>{project.contractorName}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(project.status)}>
                    {project.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress value={project.progress} className="h-2" />
                    <span className="text-xs text-muted-foreground w-[30px] text-right">
                      {project.progress}%
                    </span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" className="h-8 w-8 p-0">
                        <span className="sr-only">Open menu</span>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleViewDetails(project.id); }}>
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); alert(`Manage Contracts for ${project.projectCode}`); }}>
                        Manage Contracts
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); alert(`Edit ${project.projectCode}`); }}>
                        Edit Project
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile View: Cards */}
      <div className="grid gap-4 md:hidden">
        {filteredProjects.map((project) => (
          <Card key={project.id} onClick={() => handleViewDetails(project.id)} className="cursor-pointer active:bg-muted/50">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-base font-bold">{project.projectCode}</CardTitle>
                  <CardDescription className="mt-1 line-clamp-2">
                    {project.projectName}
                  </CardDescription>
                </div>
                <Badge variant={getStatusVariant(project.status)} className="shrink-0">
                  {project.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-2 space-y-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Folder className="h-4 w-4" />
                <span>{project.contractorName}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>{project.startDate} - {project.endDate}</span>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <BarChart3 className="h-3 w-3" /> Progress
                  </span>
                  <span className="font-medium">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-2" />
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button variant="ghost" size="sm" className="w-full ml-auto">
                View Details
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
