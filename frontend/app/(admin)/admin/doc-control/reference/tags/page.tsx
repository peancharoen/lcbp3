"use client";

import { GenericCrudTable } from "@/components/admin/reference/generic-crud-table";
import { masterDataService } from "@/lib/services/master-data.service";
import { CreateTagDto } from "@/types/dto/master/tag.dto";
import { ColumnDef } from "@tanstack/react-table";

export default function TagsPage() {
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "tag_name",
      header: "Tag Name",
    },
    {
      accessorKey: "description",
      header: "Description",
    },
  ];

  return (
    <GenericCrudTable
      title="Tags"
      description="Manage system tags."
      entityName="Tag"
      queryKey={["tags"]}
      fetchFn={() => masterDataService.getTags()}
      createFn={(data: Record<string, unknown>) => masterDataService.createTag(data as unknown as CreateTagDto)}
      updateFn={(id, data) => masterDataService.updateTag(id, data)}
      deleteFn={(id) => masterDataService.deleteTag(id)}
      columns={columns}
      fields={[
        {
          name: "tag_name",
          label: "Tag Name",
          type: "text",
          required: true,
        },
        {
          name: "description",
          label: "Description",
          type: "textarea",
          required: false,
        },
      ]}
    />
  );
}
