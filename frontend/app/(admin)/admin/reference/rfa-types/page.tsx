"use client";

import { GenericCrudTable } from "@/components/admin/reference/generic-crud-table";
import { masterDataService } from "@/lib/services/master-data.service";
import { ColumnDef } from "@tanstack/react-table";
import apiClient from "@/lib/api/client";

// Extending masterDataService locally if needed or using direct API calls for specific RFA types logic
const rfaTypeService = {
  getAll: async () => (await apiClient.get("/master/rfa-types")).data,
  create: async (data: any) => (await apiClient.post("/master/rfa-types", data)).data, // Endpoint assumption
  update: async (id: number, data: any) => (await apiClient.patch(`/master/rfa-types/${id}`, data)).data,
  delete: async (id: number) => (await apiClient.delete(`/master/rfa-types/${id}`)).data,
};

export default function RfaTypesPage() {
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
        entityName="RFA Type"
        title="RFA Types Management"
        queryKey={["rfa-types"]}
        fetchFn={rfaTypeService.getAll}
        createFn={rfaTypeService.create}
        updateFn={rfaTypeService.update}
        deleteFn={rfaTypeService.delete}
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
