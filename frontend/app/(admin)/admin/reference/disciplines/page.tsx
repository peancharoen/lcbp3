"use client";

import { GenericCrudTable } from "@/components/admin/reference/generic-crud-table";
import { masterDataService } from "@/lib/services/master-data.service";
import { ColumnDef } from "@tanstack/react-table";

export default function DisciplinesPage() {
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "discipline_code",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-mono font-bold">{row.getValue("discipline_code")}</span>
      ),
    },
    {
      accessorKey: "code_name_th",
      header: "Name (TH)",
    },
    {
      accessorKey: "code_name_en",
      header: "Name (EN)",
    },
    {
      accessorKey: "is_active",
      header: "Status",
      cell: ({ row }) => (
        <span
          className={`px-2 py-1 rounded-full text-xs ${
            row.getValue("is_active")
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {row.getValue("is_active") ? "Active" : "Inactive"}
        </span>
      ),
    },
  ];

  return (
    <div className="p-6">
      <GenericCrudTable
        entityName="Discipline"
        title="Disciplines Management"
        description="Manage system disciplines (e.g., ARCH, STR, MEC)"
        queryKey={["disciplines"]}
        fetchFn={() => masterDataService.getDisciplines()} // Assuming generic fetch supports no args for all
        createFn={(data) => masterDataService.createDiscipline({ ...data, contractId: 1 })} // Default contract for now
        updateFn={(id, data) => Promise.reject("Not implemented yet")} // Update endpoint might need addition
        deleteFn={(id) => masterDataService.deleteDiscipline(id)}
        columns={columns}
        fields={[
          { name: "discipline_code", label: "Code", type: "text", required: true },
          { name: "code_name_th", label: "Name (TH)", type: "text", required: true },
          { name: "code_name_en", label: "Name (EN)", type: "text" },
          { name: "is_active", label: "Active", type: "checkbox" },
        ]}
      />
    </div>
  );
}
