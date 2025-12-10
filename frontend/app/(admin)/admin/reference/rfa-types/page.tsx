"use client";

import { GenericCrudTable } from "@/components/admin/reference/generic-crud-table";
import { masterDataService } from "@/lib/services/master-data.service";
import { projectService } from "@/lib/services/project.service";
import { ColumnDef } from "@tanstack/react-table";
import { useState, useEffect } from "react";
import apiClient from "@/lib/api/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function RfaTypesPage() {
  const [contracts, setContracts] = useState<any[]>([]);
  const [selectedContractId, setSelectedContractId] = useState<string | null>(
    null
  );

  useEffect(() => {
    // Fetch contracts for filter and form options
    // Fetch contracts for filter and form options
    projectService.getAllContracts().then((data) => {
      setContracts(Array.isArray(data) ? data : []);
    }).catch(err => {
        console.error("Failed to load contracts:", err);
        setContracts([]);
    });
  }, []);

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: "typeCode",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-mono font-bold">{row.getValue("typeCode")}</span>
      ),
    },
    {
      accessorKey: "typeNameTh",
      header: "Name (TH)",
    },
    {
      accessorKey: "typeNameEn",
      header: "Name (EN)",
    },
    {
      accessorKey: "remark",
      header: "Remark",
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

  const contractOptions = contracts.map((c) => ({
    label: `${c.contractName} (${c.contractNo})`,
    value: c.id,
  }));

  return (
    <div className="p-6">
      <GenericCrudTable
        entityName="RFA Type"
        title="RFA Types Management"
        queryKey={["rfa-types", selectedContractId ?? "all"]}
        fetchFn={() =>
          masterDataService.getRfaTypes(
            selectedContractId ? parseInt(selectedContractId) : undefined
          )
        }
        createFn={(data) => masterDataService.createRfaType(data)}
        updateFn={(id, data) => masterDataService.updateRfaType(id, data)}
        deleteFn={(id) => masterDataService.deleteRfaType(id)}
        columns={columns}
        filters={
          <div className="w-[300px]">
            <Select
              value={selectedContractId || "all"}
              onValueChange={(val) =>
                setSelectedContractId(val === "all" ? null : val)
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by Contract" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Contracts</SelectItem>
                {contracts.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.contractName} ({c.contractNo})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        }
        fields={[
          {
            name: "contractId",
            label: "Contract",
            type: "select",
            required: true,
            options: contractOptions,
          },
          { name: "typeCode", label: "Code", type: "text", required: true },
          { name: "typeNameTh", label: "Name (TH)", type: "text", required: true },
          { name: "typeNameEn", label: "Name (EN)", type: "text" },
          { name: "remark", label: "Remark", type: "textarea" },
          { name: "isActive", label: "Active", type: "checkbox" },
        ]}
      />
    </div>
  );
}
