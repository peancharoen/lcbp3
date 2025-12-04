"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DrawingList } from "@/components/drawings/list";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import Link from "next/link";

export default function DrawingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Drawings</h1>
          <p className="text-muted-foreground mt-1">
            Manage contract and shop drawings
          </p>
        </div>
        <Link href="/drawings/upload">
          <Button>
            <Upload className="mr-2 h-4 w-4" />
            Upload Drawing
          </Button>
        </Link>
      </div>

      <Tabs defaultValue="contract" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="contract">Contract Drawings</TabsTrigger>
          <TabsTrigger value="shop">Shop Drawings</TabsTrigger>
        </TabsList>

        <TabsContent value="contract" className="mt-6">
          <DrawingList type="CONTRACT" />
        </TabsContent>

        <TabsContent value="shop" className="mt-6">
          <DrawingList type="SHOP" />
        </TabsContent>
      </Tabs>
    </div>
  );
}
