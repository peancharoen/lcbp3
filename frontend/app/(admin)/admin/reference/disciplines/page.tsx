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

export default function DisciplinesPage() {
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
      accessorKey: "disciplineCode",
      header: "Code",
      cell: ({ row }) => (
        <span className="font-mono font-bold">
          {row.getValue("disciplineCode")}
        </span>
      ),
    },
    {
      accessorKey: "codeNameTh",
      header: "Name (TH)",
    },
    {
      accessorKey: "codeNameEn",
      header: "Name (EN)",
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
        entityName="Discipline"
        title="Disciplines Management"
        description="Manage system disciplines (e.g., ARCH, STR, MEC)"
        queryKey={["disciplines", selectedContractId ?? "all"]}
        fetchFn={() =>
          masterDataService.getDisciplines(
            selectedContractId ? parseInt(selectedContractId) : undefined
          )
        }
        createFn={(data) => masterDataService.createDiscipline(data)}
        updateFn={(id, data) => Promise.reject("Not implemented yet")} // Update endpoint needs to be verified/added if missing
        deleteFn={(id) => masterDataService.deleteDiscipline(id)}
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
          {
            name: "disciplineCode",
            label: "Code",
            type: "text",
            required: true,
          },
          {
            name: "codeNameTh",
            label: "Name (TH)",
            type: "text",
            required: true,
          },
          { name: "codeNameEn", label: "Name (EN)", type: "text" },
          { name: "isActive", label: "Active", type: "checkbox" },
        ]}
      />
    </div>
  );
}
