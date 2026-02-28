"use client";

import { GenericCrudTable } from "@/components/admin/reference/generic-crud-table";
import { masterDataService } from "@/lib/services/master-data.service";
import { ColumnDef } from "@tanstack/react-table";

export default function DrawingCategoriesPage() {
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "subTypeCode",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-mono font-bold">{row.getValue("subTypeCode")}</span>
      ),
    },
    {
      accessorKey: "subTypeName",
      header: "Name",
    },
    {
      accessorKey: "subTypeNumber",
      header: "Running Code",
      cell: ({ row }) => (
        <span className="font-mono">{row.getValue("subTypeNumber") || "-"}</span>
      ),
    },
  ];

  return (
    <div className="p-6">
      <GenericCrudTable
        entityName="Drawing Category (Sub-Type)"
        title="Drawing Categories Management"
        description="Manage drawing sub-types and categories"
        queryKey={["drawing-categories"]}
        fetchFn={() => masterDataService.getSubTypes(1)} // Default contract ID 1
        createFn={(data: Record<string, unknown>) => masterDataService.createSubType({ ...(data as unknown as Parameters<typeof masterDataService.createSubType>[0]), contractId: 1, correspondenceTypeId: 3 })} // Assuming 3 is Drawings, hardcoded for now to prevent error
        updateFn={() => Promise.reject("Not implemented yet")}
        deleteFn={() => Promise.reject("Not implemented yet")} // Delete might be restricted
        columns={columns}
        fields={[
          { name: "subTypeCode", label: "Code", type: "text", required: true },
          { name: "subTypeName", label: "Name", type: "text", required: true },
          { name: "subTypeNumber", label: "Running Code", type: "text" },
        ]}
      />
    </div>
  );
}
