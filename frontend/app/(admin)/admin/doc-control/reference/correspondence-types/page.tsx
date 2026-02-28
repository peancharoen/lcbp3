"use client";

import { GenericCrudTable } from "@/components/admin/reference/generic-crud-table";
import { masterDataService } from "@/lib/services/master-data.service";
import { ColumnDef } from "@tanstack/react-table";

export default function CorrespondenceTypesPage() {
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "typeCode",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-mono font-bold">{row.getValue("typeCode")}</span>
      ),
    },
    {
      accessorKey: "typeName",
      header: "Name",
    },
    {
      accessorKey: "sortOrder",
      header: "Sort Order",
    },
    {
      accessorKey: "isActive",
      header: "Status",
      cell: ({ row }) => (
        <span
          className={`px-2 py-1 rounded-full text-xs ${
            row.getValue("isActive")
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {row.getValue("isActive") ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6">
      <GenericCrudTable
        entityName="Correspondence Type"
        title="Correspondence Types Management"
        description="Manage global correspondence types (e.g., LETTER, TRANSMITTAL)"
        queryKey={["correspondence-types"]}
        fetchFn={() => masterDataService.getCorrespondenceTypes()}
        createFn={(data: Record<string, unknown>) => masterDataService.createCorrespondenceType(data as unknown as Parameters<typeof masterDataService.createCorrespondenceType>[0])}
        updateFn={(id, data) => masterDataService.updateCorrespondenceType(id, data)}
        deleteFn={(id) => masterDataService.deleteCorrespondenceType(id)}
        columns={columns}
        fields={[
          { name: "typeCode", label: "Code", type: "text", required: true },
          { name: "typeName", label: "Name", type: "text", required: true },
          { name: "sortOrder", label: "Sort Order", type: "text" },
          { name: "isActive", label: "Active", type: "checkbox" },
        ]}
      />
    </div>
  );
}
