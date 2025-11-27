// File: app/(dashboard)/correspondences/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  FileText, 
  Calendar,
  Eye
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

// --- Type Definitions ---
type Correspondence = {
  id: string;
  documentNumber: string;
  subject: string;
  type: "Letter" | "Memo" | "RFI" | "Transmittal";
  status: "Draft" | "Submitted" | "Approved" | "Rejected";
  project: string;
  date: string;
  from: string;
  to: string;
};

// --- Mock Data ---
const mockData: Correspondence[] = [
  {
    id: "1",
    documentNumber: "LCBP3-LET-GEN-001",
    subject: "Submission of Monthly Progress Report - January 2025",
    type: "Letter",
    status: "Submitted",
    project: "LCBP3-C1",
    date: "2025-01-05",
    from: "CNNC",
    to: "PAT",
  },
  {
    id: "2",
    documentNumber: "LCBP3-RFI-STR-024",
    subject: "Clarification on Beam Reinforcement Detail at Zone A",
    type: "RFI",
    status: "Approved",
    project: "LCBP3-C2",
    date: "2025-01-10",
    from: "ITD-NWR",
    to: "TEAM",
  },
  {
    id: "3",
    documentNumber: "LCBP3-MEMO-HR-005",
    subject: "Site Access Protocol Update",
    type: "Memo",
    status: "Draft",
    project: "LCBP3",
    date: "2025-01-12",
    from: "PAT",
    to: "All Contractors",
  },
  {
    id: "4",
    documentNumber: "LCBP3-TRN-STR-011",
    subject: "Transmittal of Shop Drawings for Piling Works",
    type: "Transmittal",
    status: "Submitted",
    project: "LCBP3-C1",
    date: "2025-01-15",
    from: "CNNC",
    to: "CSC",
  },
];

export default function CorrespondencesPage() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");

  // Filter Logic
  const filteredData = mockData.filter((item) => {
    const matchesSearch = 
      item.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.documentNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesType = typeFilter === "ALL" || item.type === typeFilter;

    return matchesSearch && matchesType;
  });

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "Approved": return "success";
      case "Rejected": return "destructive";
      case "Draft": return "secondary";
      default: return "default"; // Submitted
    }
  };

  const handleCreate = () => {
    router.push("/correspondences/new");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Correspondences</h2>
          <p className="text-muted-foreground">
            จัดการเอกสารเข้า-ออกทั้งหมดในโครงการ
          </p>
        </div>
        <Button onClick={handleCreate} className="w-full md:w-auto">
          <Plus className="mr-2 h-4 w-4" /> สร้างเอกสารใหม่
        </Button>
      </div>

      {/* Toolbar (Search & Filter) */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาจากเลขที่เอกสาร หรือ หัวข้อ..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Select defaultValue="ALL" onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="ประเภทเอกสาร" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">ทั้งหมด</SelectItem>
              <SelectItem value="Letter">Letter</SelectItem>
              <SelectItem value="Memo">Memo</SelectItem>
              <SelectItem value="RFI">RFI</SelectItem>
              <SelectItem value="Transmittal">Transmittal</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon">
            <Filter className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Desktop View: Table */}
      <div className="hidden rounded-md border bg-card md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40px]">
                <Checkbox />
              </TableHead>
              <TableHead>Document No.</TableHead>
              <TableHead className="w-[400px]">Subject</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>From/To</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.map((item) => (
              <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/correspondences/${item.id}`)}>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox />
                </TableCell>
                <TableCell className="font-medium text-primary">
                  {item.documentNumber}
                  <div className="text-xs text-muted-foreground mt-0.5">{item.project}</div>
                </TableCell>
                <TableCell>
                  <span className="line-clamp-2">{item.subject}</span>
                </TableCell>
                <TableCell>{item.type}</TableCell>
                <TableCell>
                  <div className="text-xs">
                    <div className="text-muted-foreground">From: <span className="text-foreground font-medium">{item.from}</span></div>
                    <div className="text-muted-foreground">To: <span className="text-foreground font-medium">{item.to}</span></div>
                  </div>
                </TableCell>
                <TableCell>{item.date}</TableCell>
                <TableCell>
                  <Badge variant={getStatusVariant(item.status)}>{item.status}</Badge>
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
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); router.push(`/correspondences/${item.id}`); }}>
                        View Details
                      </DropdownMenuItem>
                      <DropdownMenuItem>Download PDF</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>Create Transmittal</DropdownMenuItem>
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
        {filteredData.map((item) => (
          <Card key={item.id} onClick={() => router.push(`/correspondences/${item.id}`)}>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div className="flex flex-col">
                  <Badge variant="outline" className="w-fit mb-2">{item.type}</Badge>
                  <CardTitle className="text-base font-bold">{item.documentNumber}</CardTitle>
                </div>
                <Badge variant={getStatusVariant(item.status)}>{item.status}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pb-2 text-sm">
              <p className="line-clamp-2 mb-3">{item.subject}</p>
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div className="flex items-center gap-1">
                  <FileText className="h-3 w-3" /> {item.project}
                </div>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {item.date}
                </div>
              </div>
              <div className="mt-3 pt-3 border-t grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground block">From</span>
                  <span className="font-medium">{item.from}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block">To</span>
                  <span className="font-medium">{item.to}</span>
                </div>
              </div>
            </CardContent>
            <CardFooter className="pt-2">
              <Button variant="ghost" size="sm" className="w-full text-primary">
                <Eye className="mr-2 h-4 w-4" /> View Details
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}