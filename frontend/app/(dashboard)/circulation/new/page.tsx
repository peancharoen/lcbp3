"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

import { circulationService } from "@/lib/services/circulation.service";
import { userService } from "@/lib/services/user.service";
import { correspondenceService } from "@/lib/services/correspondence.service";
import { CreateCirculationDto } from "@/types/circulation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Check, ChevronsUpDown, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Form validation schema
const formSchema = z.object({
  correspondenceId: z.number({ required_error: "Please select a document" }),
  subject: z.string().min(1, "Subject is required"),
  assigneeIds: z.array(z.number()).min(1, "At least one assignee is required"),
  remarks: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function CreateCirculationPage() {
  const router = useRouter();
  const [assigneeOpen, setAssigneeOpen] = useState(false);
  const [docOpen, setDocOpen] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      subject: "",
      assigneeIds: [],
      remarks: "",
    },
  });

  // Fetch users for assignee selection
  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: () => userService.getAll(),
  });

  // Fetch correspondences for document selection
  const { data: correspondences } = useQuery({
    queryKey: ["correspondences-dropdown"],
    queryFn: () => correspondenceService.getAll({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: (data: CreateCirculationDto) => circulationService.create(data),
    onSuccess: (result) => {
      toast.success("Circulation created successfully");
      router.push(`/circulation/${result.id}`);
    },
    onError: () => {
      toast.error("Failed to create circulation");
    },
  });

  const onSubmit = (data: FormData) => {
    createMutation.mutate(data);
  };

  const selectedAssignees = form.watch("assigneeIds");
  const selectedDocId = form.watch("correspondenceId");

  const selectedDoc = correspondences?.data?.find(
    (c: { id: number }) => c.id === selectedDocId
  );

  const toggleAssignee = (userId: number) => {
    const current = form.getValues("assigneeIds");
    if (current.includes(userId)) {
      form.setValue(
        "assigneeIds",
        current.filter((id) => id !== userId)
      );
    } else {
      form.setValue("assigneeIds", [...current, userId]);
    }
  };

  return (
    <section className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/circulation">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Create Circulation</h1>
          <p className="text-muted-foreground">
            Create a new internal document circulation
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Circulation Details</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Document Selection */}
              <FormField
                control={form.control}
                name="correspondenceId"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Document</FormLabel>
                    <Popover open={docOpen} onOpenChange={setDocOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className={cn(
                              "justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {selectedDoc
                              ? selectedDoc.correspondence_number
                              : "Select document..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search documents..." />
                          <CommandList>
                            <CommandEmpty>No document found.</CommandEmpty>
                            <CommandGroup>
                              {correspondences?.data?.map((doc: { id: number; correspondence_number: string }) => (
                                <CommandItem
                                  key={doc.id}
                                  value={doc.correspondence_number}
                                  onSelect={() => {
                                    form.setValue("correspondenceId", doc.id);
                                    setDocOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      doc.id === field.value
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {doc.correspondence_number}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Subject */}
              <FormField
                control={form.control}
                name="subject"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Subject</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter circulation subject" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Assignees Multi-select */}
              <FormField
                control={form.control}
                name="assigneeIds"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Assignees</FormLabel>
                    <Popover open={assigneeOpen} onOpenChange={setAssigneeOpen}>
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            className="justify-between h-auto min-h-10"
                          >
                            {selectedAssignees.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {selectedAssignees.map((userId) => {
                                  const user = users.find(
                                    (u: { user_id: number }) => u.user_id === userId
                                  );
                                  return user ? (
                                    <Badge
                                      key={userId}
                                      variant="secondary"
                                      className="mr-1"
                                    >
                                      {user.first_name || user.username}
                                      <X
                                        className="ml-1 h-3 w-3 cursor-pointer"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          toggleAssignee(userId);
                                        }}
                                      />
                                    </Badge>
                                  ) : null;
                                })}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">
                                Select assignees...
                              </span>
                            )}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0">
                        <Command>
                          <CommandInput placeholder="Search users..." />
                          <CommandList>
                            <CommandEmpty>No user found.</CommandEmpty>
                            <CommandGroup>
                              {users.map((user: { user_id: number; username: string; first_name?: string; last_name?: string }) => (
                                <CommandItem
                                  key={user.user_id}
                                  value={user.username}
                                  onSelect={() => toggleAssignee(user.user_id)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedAssignees.includes(user.user_id)
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {user.first_name && user.last_name
                                    ? `${user.first_name} ${user.last_name}`
                                    : user.username}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Remarks */}
              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes..."
                        className="resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <Link href="/circulation">
                  <Button variant="outline" type="button">
                    Cancel
                  </Button>
                </Link>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Creating..." : "Create Circulation"}
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </section>
  );
}
