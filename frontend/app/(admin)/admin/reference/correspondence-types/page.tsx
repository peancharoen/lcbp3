"use client";

import { GenericCrudTable } from "@/components/admin/reference/generic-crud-table";
import { ColumnDef } from "@tanstack/react-table";
import apiClient from "@/lib/api/client";

// Service wrapper
const correspondenceTypeService = {
  getAll: async () => (await apiClient.get("/master/correspondence-types")).data,
  create: async (data: any) => (await apiClient.post("/master/correspondence-types", data)).data,
  update: async (id: number, data: any) => (await apiClient.patch(`/master/correspondence-types/${id}`, data)).data,
  delete: async (id: number) => (await apiClient.delete(`/master/correspondence-types/${id}`)).data,
};

export default function CorrespondenceTypesPage() {
  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "type_code",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-mono font-bold">{row.getValue("type_code")}</span>
      ),
    },
    {
      accessorKey: "type_name_th",
      header: "Name (TH)",
    },
    {
      accessorKey: "type_name_en",
      header: "Name (EN)",
    },
  ];

  return (
    <div className="p-6">
      <GenericCrudTable
        entityName="Correspondence Type"
        title="Correspondence Types Management"
        queryKey={["correspondence-types"]}
        fetchFn={correspondenceTypeService.getAll}
        createFn={correspondenceTypeService.create}
        updateFn={correspondenceTypeService.update}
        deleteFn={correspondenceTypeService.delete}
        columns={columns}
        fields={[
          { name: "type_code", label: "Code", type: "text", required: true },
          { name: "type_name_th", label: "Name (TH)", type: "text", required: true },
          { name: "type_name_en", label: "Name (EN)", type: "text" },
        ]}
      />
    </div>
  );
}
