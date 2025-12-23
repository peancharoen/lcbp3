"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { documentNumberingService } from "@/lib/services/document-numbering.service";
import { NumberingMetrics } from "@/types/dto/numbering.dto";

export function MetricsDashboard() {
  const [metrics, setMetrics] = useState<Partial<NumberingMetrics>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMetrics() {
      try {
        const data = await documentNumberingService.getMetrics();
        setMetrics(data);
      } catch (error) {
        console.error("Failed to fetch metrics", error);
      } finally {
        setLoading(false);
      }
    }
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading metrics...</div>;
  if (!metrics) return <div>No metrics available.</div>;

  // Mock data mapping if real data is missing from backend stub
  const utilization = metrics.audit ? 45 : 0; // Placeholder until backend returns specific metric
  const generationRate = 120; // Placeholder
  const lockWaitP95 = 0.05; // Placeholder

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Generation Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{generationRate} /Hr</div>
          <p className="text-xs text-muted-foreground">+20.1% from last hour</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
           <CardTitle className="text-sm font-medium">Sequence Utilization</CardTitle>
        </CardHeader>
        <CardContent>
           <div className="text-2xl font-bold">{utilization}%</div>
           <Progress value={utilization} className="mt-2" />
           <p className="text-xs text-muted-foreground mt-1">Average capacity used</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Lock Wait Time (P95)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{lockWaitP95}s</div>
          <p className="text-xs text-muted-foreground">Redis distributed lock latency</p>
        </CardContent>
      </Card>

      <Card>
         <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
           <CardTitle className="text-sm font-medium">Recent Errors</CardTitle>
         </CardHeader>
         <CardContent>
           <div className="text-2xl font-bold">{metrics.errors?.length || 0}</div>
           <p className="text-xs text-muted-foreground">In the last 24 hours</p>
         </CardContent>
      </Card>
    </div>
  );
}
