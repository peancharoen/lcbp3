"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { circulationService } from "@/lib/services/circulation.service";
import { Circulation, UpdateCirculationRoutingDto } from "@/types/circulation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ArrowLeft, RefreshCw, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { toast } from "sonner";

/**
 * Get initials from name
 */
function getInitials(firstName?: string, lastName?: string): string {
  const first = firstName?.charAt(0) || "";
  const last = lastName?.charAt(0) || "";
  return (first + last).toUpperCase() || "?";
}

/**
 * Get status badge variant
 */
function getStatusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status?.toUpperCase()) {
    case "PENDING":
      return "outline";
    case "IN_PROGRESS":
      return "default";
    case "COMPLETED":
      return "secondary";
    case "REJECTED":
      return "destructive";
    default:
      return "outline";
  }
}

export default function CirculationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const { data: circulation, isLoading, error } = useQuery<Circulation>({
    queryKey: ["circulation", id],
    queryFn: () => circulationService.getById(id),
    enabled: !!id,
  });

  const completeMutation = useMutation({
    mutationFn: ({ routingId, data }: { routingId: number; data: UpdateCirculationRoutingDto }) =>
      circulationService.updateRouting(routingId, data),
    onSuccess: () => {
      toast.success("Task completed successfully");
      queryClient.invalidateQueries({ queryKey: ["circulation", id] });
    },
    onError: () => {
      toast.error("Failed to update task status");
    },
  });

  const handleComplete = (routingId: number) => {
    completeMutation.mutate({
      routingId,
      data: { status: "COMPLETED", comments: "Completed via UI" },
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !circulation) {
    return (
      <div className="space-y-4">
        <Link href="/circulation">
          <Button variant="ghost">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Circulations
          </Button>
        </Link>
        <div className="bg-destructive/10 text-destructive px-4 py-3 rounded-md">
          Failed to load circulation details.
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/circulation">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{circulation.circulationNo}</h1>
            <p className="text-muted-foreground">{circulation.subject}</p>
          </div>
        </div>
        <Badge variant={getStatusVariant(circulation.statusCode)}>
          {circulation.statusCode}
        </Badge>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Circulation Details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-sm text-muted-foreground">Organization</p>
            <p className="font-medium">
              {circulation.organization?.organization_name || "-"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Created By</p>
            <p className="font-medium">
              {circulation.creator
                ? `${circulation.creator.first_name || ""} ${circulation.creator.last_name || ""}`.trim() ||
                  circulation.creator.username
                : "-"}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Created At</p>
            <p className="font-medium">
              {format(new Date(circulation.createdAt), "dd MMM yyyy, HH:mm")}
            </p>
          </div>
          {circulation.correspondence && (
            <div>
              <p className="text-sm text-muted-foreground">Linked Document</p>
              <Link
                href={`/correspondences/${circulation.correspondenceId}`}
                className="font-medium text-primary hover:underline"
              >
                {circulation.correspondence.correspondence_number}
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Assignees/Routings */}
      <Card>
        <CardHeader>
          <CardTitle>Assignees</CardTitle>
        </CardHeader>
        <CardContent>
          {circulation.routings && circulation.routings.length > 0 ? (
            <div className="space-y-3">
              {circulation.routings.map((routing) => (
                <div
                  key={routing.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarFallback>
                        {getInitials(
                          routing.assignee?.first_name,
                          routing.assignee?.last_name
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">
                        {routing.assignee
                          ? `${routing.assignee.first_name || ""} ${routing.assignee.last_name || ""}`.trim() ||
                            routing.assignee.username
                          : "Unassigned"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Step {routing.stepNumber}
                        {routing.comments && ` • ${routing.comments}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusVariant(routing.status)}>
                      {routing.status}
                    </Badge>
                    {routing.status === "PENDING" && (
                      <Button
                        size="sm"
                        onClick={() => handleComplete(routing.id)}
                        disabled={completeMutation.isPending}
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1" />
                        Complete
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No assignees found</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
