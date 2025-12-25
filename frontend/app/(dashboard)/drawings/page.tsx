"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DrawingList } from "@/components/drawings/list";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Upload, Loader2 } from "lucide-react";
import Link from "next/link";
import { useProjects } from "@/hooks/use-master-data";

export default function DrawingsPage() {
  const [selectedProjectId, setSelectedProjectId] = useState<number | undefined>(undefined);
  const { data: projects = [], isLoading: isLoadingProjects } = useProjects();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Drawings</h1>
          <p className="text-muted-foreground mt-1">
            Manage contract, shop, and as-built drawings
          </p>
        </div>
        <Link href="/drawings/upload">
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload Drawing
          </Button>
        </Link>
      </div>

      {/* Project Selector */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium">Project:</span>
        <Select
          value={selectedProjectId?.toString() ?? ""}
          onValueChange={(v) => setSelectedProjectId(v ? parseInt(v) : undefined)}
        >
          <SelectTrigger className="w-[300px]">
            {isLoadingProjects ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <SelectValue placeholder="Select Project" />
            )}
          </SelectTrigger>
          <SelectContent>
            {projects.map((project: { id: number; projectName: string; projectCode: string }) => (
              <SelectItem key={project.id} value={String(project.id)}>
                {project.projectCode} - {project.projectName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedProjectId ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg border-dashed">
          Please select a project to view drawings.
        </div>
      ) : (
        <DrawingTabs projectId={selectedProjectId} />
      )}
    </div>
  );
}

function DrawingTabs({ projectId }: { projectId: number }) {
  const [search, setSearch] = useState("");
  // We can add more specific filters here (e.g. category) later

  return (
        <Tabs defaultValue="contract" className="w-full">
          <div className="flex justify-between items-center mb-6">
              <TabsList className="grid w-full grid-cols-3 max-w-[400px]">
                <TabsTrigger value="contract">Contract</TabsTrigger>
                <TabsTrigger value="shop">Shop</TabsTrigger>
                <TabsTrigger value="asbuilt">As Built</TabsTrigger>
              </TabsList>

              <div className="flex gap-2">
                  <div className="relative">
                       <input
                          type="text"
                          placeholder="Search drawings..."
                          className="h-10 w-[250px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                       />
                  </div>
              </div>
          </div>

          <TabsContent value="contract" className="mt-0">
            <DrawingList type="CONTRACT" projectId={projectId} filters={{ search }} />
          </TabsContent>

          <TabsContent value="shop" className="mt-0">
            <DrawingList type="SHOP" projectId={projectId} filters={{ search }} />
          </TabsContent>

          <TabsContent value="asbuilt" className="mt-0">
            <DrawingList type="AS_BUILT" projectId={projectId} filters={{ search }} />
          </TabsContent>
        </Tabs>
  )
}

