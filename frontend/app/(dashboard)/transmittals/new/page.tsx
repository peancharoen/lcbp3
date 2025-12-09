"use client";

import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { TransmittalForm } from "@/components/transmittal/transmittal-form";

export default function CreateTransmittalPage() {
  return (
    <section className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/transmittals">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Create Transmittal</h1>
          <p className="text-muted-foreground">
            Prepare a new document transmittal slip
          </p>
        </div>
      </div>

      <TransmittalForm />
    </section>
  );
}
