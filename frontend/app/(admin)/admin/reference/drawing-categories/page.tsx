"use client";

import { GenericCrudTable } from "@/components/admin/reference/generic-crud-table";
import { masterDataService } from "@/lib/services/master-data.service";
import { ColumnDef } from "@tanstack/react-table";

export default function DrawingCategoriesPage() {
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "type_code",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-mono font-bold">{row.getValue("type_code")}</span>
      ),
    },
    {
      accessorKey: "type_name",
      header: "Name",
    },
    {
      accessorKey: "classification",
      header: "Classification",
      cell: ({ row }) => (
        <span className="capitalize">{row.getValue("classification") || "General"}</span>
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
        createFn={(data) => masterDataService.createSubType({ ...data, contractId: 1 })}
        updateFn={(id, data) => Promise.reject("Not implemented yet")}
        deleteFn={(id) => Promise.reject("Not implemented yet")} // Delete might be restricted
        columns={columns}
        fields={[
          { name: "type_code", label: "Code", type: "text", required: true },
          { name: "type_name", label: "Name", type: "text", required: true },
          { name: "classification", label: "Classification", type: "text" },
        ]}
      />
    </div>
  );
}
