"use client";

import { useForm, type SubmitErrorHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useCreateRFA } from "@/hooks/use-rfa";
import { useDrawings } from "@/hooks/use-drawing";
import { useDisciplines, useContracts, useOrganizations } from "@/hooks/use-master-data";
import { useCorrespondenceTypes, useRfaTypes } from "@/hooks/use-reference-data";
import { useProjects } from "@/hooks/use-projects";
import { CreateRfaDto } from "@/types/dto/rfa/rfa.dto";
import { useState, useEffect, type FormEvent } from "react";
import { correspondenceService } from "@/lib/services/correspondence.service";

const rfaSchema = z.object({
  projectId: z.string().min(1, "Project is required"), // ADR-019: UUID
  contractId: z.string().min(1, "Contract is required"),
  disciplineId: z.number().min(1, "Discipline is required"),
  rfaTypeId: z.number().min(1, "Type is required"),
  subject: z.string().min(5, "Subject must be at least 5 characters"),
  description: z.string().optional(),
  body: z.string().optional(),
  remarks: z.string().optional(),
  toOrganizationId: z.string().min(1, "Please select To Organization"),
  dueDate: z.string().optional(),
  shopDrawingRevisionIds: z.array(z.string()).optional(),
  asBuiltDrawingRevisionIds: z.array(z.string()).optional(),
});

type RFAFormData = z.infer<typeof rfaSchema>;

type ProjectOption = {
  uuid?: string;
  id?: number;
  projectName?: string;
  projectCode?: string;
};

type ContractOption = {
  uuid?: string;
  id?: number;
  contractName?: string;
  name?: string;
  contractCode?: string;
};

type DisciplineOption = {
  id: number;
  disciplineCode: string;
  codeNameEn?: string;
  codeNameTh?: string;
};

type RfaTypeOption = {
  id: number;
  typeCode?: string;
  typeName?: string;
  typeNameEn?: string;
  typeNameTh?: string;
};

type CorrespondenceTypeOption = {
  id: number;
  typeCode?: string;
  typeName?: string;
};

type OrganizationOption = {
  uuid?: string;
  id?: number;
  organizationCode?: string;
  organizationName?: string;
};

type SelectableDrawingOption = {
  uuid?: string;
  drawingNumber?: string;
  title?: string;
  legacyDrawingNumber?: string;
  currentRevisionUuid?: string;
  currentRevision?: {
    uuid?: string;
    revisionLabel?: string;
    revisionNumber?: number | string;
    title?: string;
    legacyDrawingNumber?: string;
  };
};

const extractArrayData = <T,>(value: unknown): T[] => {
  let current: unknown = value;

  for (let i = 0; i < 5; i += 1) {
    if (Array.isArray(current)) {
      return current as T[];
    }

    if (!current || typeof current !== "object" || !("data" in current)) {
      return [];
    }

    current = (current as { data?: unknown }).data;
  }

  return Array.isArray(current) ? (current as T[]) : [];
};

const dedupeByKey = <T,>(items: T[], getKey: (item: T) => string | number | undefined): T[] => {
  const seen = new Set<string | number>();

  return items.filter((item) => {
    const key = getKey(item);

    if (key === undefined || key === "" || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const getOptionValue = (value?: string | number): string | undefined => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  return String(value);
};

export function RFAForm() {
  const router = useRouter();
  const createMutation = useCreateRFA();

  const { data: projectsData, isLoading: isLoadingProjects } = useProjects();
  const projects = dedupeByKey(
    extractArrayData<ProjectOption>(projectsData),
    (project) => project.uuid ?? project.id
  );
  const { data: organizationsData, isLoading: isLoadingOrganizations } = useOrganizations({ isActive: true });
  const organizations = dedupeByKey(
    extractArrayData<OrganizationOption>(organizationsData),
    (organization) => organization.uuid ?? organization.id
  );
  const { data: correspondenceTypesData } = useCorrespondenceTypes();
  const correspondenceTypes = extractArrayData<CorrespondenceTypeOption>(correspondenceTypesData);
  const rfaCorrespondenceType = correspondenceTypes.find(
    (type) => type.typeCode?.toUpperCase() === "RFA"
  );

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<RFAFormData>({
    resolver: zodResolver(rfaSchema),
    defaultValues: {
      projectId: "",
      contractId: "",
      disciplineId: 0,
      rfaTypeId: 0,
      subject: "",
      description: "",
      body: "",
      remarks: "",
      toOrganizationId: "",
      dueDate: "",
      shopDrawingRevisionIds: [],
      asBuiltDrawingRevisionIds: [],
    },
  });

  const selectedProjectId = watch("projectId");
  const { data: contractsData, isLoading: isLoadingContracts } = useContracts(selectedProjectId);
  const contracts = dedupeByKey(
    extractArrayData<ContractOption>(contractsData),
    (contract) => contract.uuid ?? contract.id
  );

  const selectedContractId = watch("contractId");
  const { data: disciplinesData, isLoading: isLoadingDisciplines } = useDisciplines(selectedContractId);
  const disciplines = dedupeByKey(extractArrayData<DisciplineOption>(disciplinesData), (discipline) => discipline.id);
  const { data: rfaTypesData, isLoading: isLoadingRfaTypes } = useRfaTypes(selectedContractId);
  const rfaTypes = dedupeByKey(extractArrayData<RfaTypeOption>(rfaTypesData), (rfaType) => rfaType.id);
  const [shopDrawingSearch, setShopDrawingSearch] = useState("");
  const [shopDrawingPage, setShopDrawingPage] = useState(1);
  const { data: shopDrawingsData, isLoading: isLoadingShopDrawings } = useDrawings("SHOP", {
    projectUuid: selectedProjectId || "",
    search: shopDrawingSearch,
    page: shopDrawingPage,
    limit: 10,
  });
  const shopDrawings = dedupeByKey(
    extractArrayData<SelectableDrawingOption>(shopDrawingsData),
    (drawing) => drawing.currentRevisionUuid ?? drawing.currentRevision?.uuid ?? drawing.uuid
  );

  const [asBuiltDrawingSearch, setAsBuiltDrawingSearch] = useState("");
  const [asBuiltDrawingPage, setAsBuiltDrawingPage] = useState(1);
  const { data: asBuiltDrawingsData, isLoading: isLoadingAsBuiltDrawings } = useDrawings("AS_BUILT", {
    projectUuid: selectedProjectId || "",
    search: asBuiltDrawingSearch,
    page: asBuiltDrawingPage,
    limit: 10,
  });
  const asBuiltDrawings = dedupeByKey(
    extractArrayData<SelectableDrawingOption>(asBuiltDrawingsData),
    (drawing) => drawing.currentRevisionUuid ?? drawing.currentRevision?.uuid ?? drawing.uuid
  );
  const selectedDisciplineId = watch("disciplineId");

  const rfaTypeId = watch("rfaTypeId");
  const disciplineId = watch("disciplineId");
  const toOrganizationId = watch("toOrganizationId");
  const selectedShopDrawingRevisionIds = watch("shopDrawingRevisionIds") ?? [];
  const selectedAsBuiltDrawingRevisionIds = watch("asBuiltDrawingRevisionIds") ?? [];
  const selectedRfaType = rfaTypes.find((rfaType) => rfaType.id === rfaTypeId);
  const selectedRfaTypeCode = selectedRfaType?.typeCode?.toUpperCase();
  const requiresShopDrawings = selectedRfaTypeCode === "DDW" || selectedRfaTypeCode === "SDW";
  const requiresAsBuiltDrawings = selectedRfaTypeCode === "ADW";

  useEffect(() => {
    // Reset page and search when project changes
    setShopDrawingPage(1);
    setShopDrawingSearch("");
    setAsBuiltDrawingPage(1);
    setAsBuiltDrawingSearch("");

    if (requiresShopDrawings) {
      setValue("asBuiltDrawingRevisionIds", []);
      clearErrors("asBuiltDrawingRevisionIds");
      return;
    }

    if (requiresAsBuiltDrawings) {
      setValue("shopDrawingRevisionIds", []);
      clearErrors("shopDrawingRevisionIds");
      return;
    }

    setValue("shopDrawingRevisionIds", []);
    setValue("asBuiltDrawingRevisionIds", []);
    clearErrors("shopDrawingRevisionIds");
    clearErrors("asBuiltDrawingRevisionIds");
  }, [requiresShopDrawings, requiresAsBuiltDrawings, selectedProjectId, setValue, clearErrors]);

  // -- Preview Logic --
  const [preview, setPreview] = useState<{ number: string; isDefaultTemplate: boolean } | null>(null);

  useEffect(() => {
    if (!selectedProjectId || !rfaCorrespondenceType?.id || !rfaTypeId || !disciplineId || !toOrganizationId) {
       setPreview(null);
       return;
    }

    const fetchPreview = async () => {
       try {
         const res = await correspondenceService.previewNumber({
             projectId: selectedProjectId,
             typeId: rfaCorrespondenceType.id,
             disciplineId,
             recipients: [{ organizationId: toOrganizationId, type: 'TO' }],
             subject: watch("subject") || "Preview Subject"
         });
         setPreview(res);
       } catch (err) {
         setPreview(null);
       }
    };

    const timer = setTimeout(fetchPreview, 500);
    return () => clearTimeout(timer);
  }, [rfaTypeId, disciplineId, toOrganizationId, selectedProjectId, rfaCorrespondenceType?.id, watch]);

  const onSubmit = (data: RFAFormData) => {
    if (requiresShopDrawings && data.shopDrawingRevisionIds?.length === 0) {
      setError("shopDrawingRevisionIds", {
        type: "manual",
        message: "Please select at least one Shop Drawing Revision",
      });
      return;
    }

    if (requiresAsBuiltDrawings && data.asBuiltDrawingRevisionIds?.length === 0) {
      setError("asBuiltDrawingRevisionIds", {
        type: "manual",
        message: "Please select at least one As-Built Drawing Revision",
      });
      return;
    }

    clearErrors("shopDrawingRevisionIds");
    clearErrors("asBuiltDrawingRevisionIds");

    const payload: CreateRfaDto = {
      ...data,
      shopDrawingRevisionIds: requiresShopDrawings ? data.shopDrawingRevisionIds : undefined,
      asBuiltDrawingRevisionIds: requiresAsBuiltDrawings ? data.asBuiltDrawingRevisionIds : undefined,
    };
    createMutation.mutate(payload, {
      onSuccess: () => {
        router.push("/rfas");
      },
    });
  };

  const onInvalidSubmit: SubmitErrorHandler<RFAFormData> = () => undefined;
  const submitForm = handleSubmit(onSubmit, onInvalidSubmit);
  const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
    void submitForm(event).catch(() => undefined);
  };

  return (
    <form onSubmit={handleFormSubmit} className="max-w-4xl space-y-6">
      {preview && (
        <Card className="p-4 bg-muted border-l-4 border-l-primary">
           <p className="text-sm text-muted-foreground mb-1">Document Number Preview</p>
           <div className="flex items-center gap-3">
             <span className="text-xl font-bold font-mono text-primary tracking-wide">{preview.number}</span>
             {preview.isDefaultTemplate && (
                <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200">
                   Default Template
                </span>
             )}
           </div>
        </Card>
      )}

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">RFA Information</h3>

        <div className="space-y-4">
          <div>
            <Label htmlFor="subject">Subject *</Label>
            <Input id="subject" {...register("subject")} placeholder="Enter subject" />
            {errors.subject && (
              <p className="text-sm text-destructive mt-1">
                {errors.subject.message}
              </p>
            )}
          </div>

          <div>
             <Label htmlFor="body">Body (Content)</Label>
             <Textarea id="body" {...register("body")} rows={4} placeholder="Enter content..." />
          </div>

           <div>
             <Label htmlFor="remarks">Remarks</Label>
             <Input id="remarks" {...register("remarks")} placeholder="Optional remarks" />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Input id="description" {...register("description")} placeholder="Enter key description" />
          </div>

          <div>
            <Label>Project *</Label>
            <Select
              value={selectedProjectId || undefined}
              onValueChange={(val) => {
                setValue("projectId", val);
                setValue("contractId", "");
                setValue("disciplineId", 0);
                setValue("rfaTypeId", 0);
                setValue("shopDrawingRevisionIds", []);
                setValue("asBuiltDrawingRevisionIds", []);
              }}
              disabled={isLoadingProjects}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingProjects ? "Loading..." : "Select Project"} />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => {
                  const projectValue = getOptionValue(p.uuid ?? p.id);

                  if (!projectValue) {
                    return null;
                  }

                  return (
                  <SelectItem key={projectValue} value={projectValue}>
                    {p.projectName || p.projectCode}
                  </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {errors.projectId && (
              <p className="text-sm text-destructive mt-1">{errors.projectId.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Contract *</Label>
              <Select
                value={selectedContractId || undefined}
                onValueChange={(val) => {
                  setValue("contractId", val);
                  setValue("disciplineId", 0);
                  setValue("rfaTypeId", 0);
                  setValue("shopDrawingRevisionIds", []);
                  setValue("asBuiltDrawingRevisionIds", []);
                }}
                disabled={!selectedProjectId || isLoadingContracts}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingContracts ? "Loading..." : "Select Contract"} />
                </SelectTrigger>
                <SelectContent>
                  {contracts.map((c) => {
                    const contractValue = getOptionValue(c.uuid ?? c.id);

                    if (!contractValue) {
                      return null;
                    }

                    return (
                    <SelectItem key={contractValue} value={contractValue}>
                      {c.contractName || c.name || c.contractCode}
                    </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {errors.contractId && (
                <p className="text-sm text-destructive mt-1">{errors.contractId.message}</p>
              )}
            </div>

            <div>
              <Label>Discipline *</Label>
              <Select
                value={selectedDisciplineId > 0 ? String(selectedDisciplineId) : undefined}
                onValueChange={(val) => setValue("disciplineId", Number(val))}
                disabled={!selectedContractId || isLoadingDisciplines}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingDisciplines ? "Loading..." : "Select Discipline"} />
                </SelectTrigger>
                <SelectContent>
                  {disciplines.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {`${d.codeNameEn || d.codeNameTh || d.disciplineCode} (${d.disciplineCode})`}
                    </SelectItem>
                  ))}
                  {!isLoadingDisciplines && disciplines.length === 0 && (
                     <SelectItem value="0" disabled>No disciplines found</SelectItem>
                  )}
                </SelectContent>
              </Select>
              {errors.disciplineId && (
                <p className="text-sm text-destructive mt-1">{errors.disciplineId.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>RFA Type *</Label>
              <Select
                value={rfaTypeId > 0 ? String(rfaTypeId) : undefined}
                onValueChange={(val) => {
                  setValue("rfaTypeId", Number(val));
                  setValue("shopDrawingRevisionIds", []);
                  setValue("asBuiltDrawingRevisionIds", []);
                }}
                disabled={!selectedContractId || isLoadingRfaTypes}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingRfaTypes ? "Loading..." : "Select RFA Type"} />
                </SelectTrigger>
                <SelectContent>
                  {rfaTypes.map((rfaType) => (
                    <SelectItem key={rfaType.id} value={String(rfaType.id)}>
                      {`${rfaType.typeCode || "RFA"} - ${rfaType.typeName || rfaType.typeNameEn || rfaType.typeNameTh || "Unnamed Type"}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.rfaTypeId && (
                <p className="text-sm text-destructive mt-1">{errors.rfaTypeId.message}</p>
              )}
            </div>

            <div>
              <Label>To Organization *</Label>
              <Select
                value={toOrganizationId || undefined}
                onValueChange={(val) => setValue("toOrganizationId", val)}
                disabled={isLoadingOrganizations}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoadingOrganizations ? "Loading..." : "Select To Organization"} />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((organization) => {
                    const organizationValue = getOptionValue(organization.uuid ?? organization.id);

                    if (!organizationValue) {
                      return null;
                    }

                    return (
                    <SelectItem key={organizationValue} value={organizationValue}>
                      {`${organization.organizationCode || "ORG"} - ${organization.organizationName || "Unnamed Organization"}`}
                    </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {errors.toOrganizationId && (
                <p className="text-sm text-destructive mt-1">{errors.toOrganizationId.message}</p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {(requiresShopDrawings || requiresAsBuiltDrawings) && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4">New Item</h3>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              {requiresShopDrawings
                ? "RFA Type นี้ต้องอ้างอิง Shop Drawing Revision อย่างน้อย 1 รายการ"
                : "RFA Type นี้ต้องอ้างอิง As-Built Drawing Revision อย่างน้อย 1 รายการ"}
            </p>

            {requiresShopDrawings && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    placeholder="ค้นหาตาม Drawing Number..."
                    value={shopDrawingSearch}
                    onChange={(e) => {
                      setShopDrawingSearch(e.target.value);
                      setShopDrawingPage(1);
                    }}
                    className="max-w-xs"
                  />
                </div>

                {isLoadingShopDrawings && (
                  <p className="text-sm text-muted-foreground">Loading Shop Drawings...</p>
                )}
                {!isLoadingShopDrawings && shopDrawings.length === 0 && (
                  <p className="text-sm text-muted-foreground">No Shop Drawings found for the selected project.</p>
                )}
                <div className="grid grid-cols-1 gap-3">
                  {shopDrawings.map((drawing) => {
                    const revisionUuid = drawing.currentRevisionUuid ?? drawing.currentRevision?.uuid;

                    if (!revisionUuid) {
                      return null;
                    }

                    return (
                      <label
                        key={revisionUuid}
                        className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedShopDrawingRevisionIds.includes(revisionUuid)}
                          onCheckedChange={(checked) => {
                            const nextValues = checked === true
                              ? [...selectedShopDrawingRevisionIds, revisionUuid]
                              : selectedShopDrawingRevisionIds.filter((value) => value !== revisionUuid);
                            setValue("shopDrawingRevisionIds", nextValues, { shouldDirty: true, shouldValidate: true });
                            clearErrors("shopDrawingRevisionIds");
                          }}
                        />
                        <div className="space-y-1">
                          <p className="font-medium">{drawing.drawingNumber || "Unnamed Shop Drawing"}</p>
                          <p className="text-sm text-muted-foreground">{drawing.currentRevision?.title || drawing.title || "Untitled Revision"}</p>
                          <p className="text-xs text-muted-foreground">
                            Revision {drawing.currentRevision?.revisionLabel || drawing.currentRevision?.revisionNumber || "-"}
                            {drawing.currentRevision?.legacyDrawingNumber ? ` • Legacy ${drawing.currentRevision.legacyDrawingNumber}` : ""}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {shopDrawingsData?.meta && shopDrawingsData.meta.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-muted-foreground">
                      Page {shopDrawingPage} of {shopDrawingsData.meta.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={shopDrawingPage === 1 || isLoadingShopDrawings}
                        onClick={() => setShopDrawingPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={shopDrawingPage >= shopDrawingsData.meta.totalPages || isLoadingShopDrawings}
                        onClick={() => setShopDrawingPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}

                {errors.shopDrawingRevisionIds && (
                  <p className="text-sm text-destructive mt-2">{errors.shopDrawingRevisionIds.message}</p>
                )}
              </div>
            )}

            {requiresAsBuiltDrawings && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    placeholder="ค้นหาตาม Drawing Number..."
                    value={asBuiltDrawingSearch}
                    onChange={(e) => {
                      setAsBuiltDrawingSearch(e.target.value);
                      setAsBuiltDrawingPage(1);
                    }}
                    className="max-w-xs"
                  />
                </div>

                {isLoadingAsBuiltDrawings && (
                  <p className="text-sm text-muted-foreground">Loading As-Built Drawings...</p>
                )}
                {!isLoadingAsBuiltDrawings && asBuiltDrawings.length === 0 && (
                  <p className="text-sm text-muted-foreground">No As-Built Drawings found for the selected project.</p>
                )}
                <div className="grid grid-cols-1 gap-3">
                  {asBuiltDrawings.map((drawing) => {
                    const revisionUuid = drawing.currentRevisionUuid ?? drawing.currentRevision?.uuid;

                    if (!revisionUuid) {
                      return null;
                    }

                    return (
                      <label
                        key={revisionUuid}
                        className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={selectedAsBuiltDrawingRevisionIds.includes(revisionUuid)}
                          onCheckedChange={(checked) => {
                            const nextValues = checked === true
                              ? [...selectedAsBuiltDrawingRevisionIds, revisionUuid]
                              : selectedAsBuiltDrawingRevisionIds.filter((value) => value !== revisionUuid);
                            setValue("asBuiltDrawingRevisionIds", nextValues, { shouldDirty: true, shouldValidate: true });
                            clearErrors("asBuiltDrawingRevisionIds");
                          }}
                        />
                        <div className="space-y-1">
                          <p className="font-medium">{drawing.drawingNumber || "Unnamed As-Built Drawing"}</p>
                          <p className="text-sm text-muted-foreground">{drawing.currentRevision?.title || drawing.title || "Untitled Revision"}</p>
                          <p className="text-xs text-muted-foreground">
                            Revision {drawing.currentRevision?.revisionLabel || drawing.currentRevision?.revisionNumber || "-"}
                            {drawing.currentRevision?.legacyDrawingNumber ? ` • Legacy ${drawing.currentRevision.legacyDrawingNumber}` : ""}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {asBuiltDrawingsData?.meta && asBuiltDrawingsData.meta.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-muted-foreground">
                      Page {asBuiltDrawingPage} of {asBuiltDrawingsData.meta.totalPages}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={asBuiltDrawingPage === 1 || isLoadingAsBuiltDrawings}
                        onClick={() => setAsBuiltDrawingPage((p) => Math.max(1, p - 1))}
                      >
                        Previous
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={asBuiltDrawingPage >= asBuiltDrawingsData.meta.totalPages || isLoadingAsBuiltDrawings}
                        onClick={() => setAsBuiltDrawingPage((p) => p + 1)}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}

                {errors.asBuiltDrawingRevisionIds && (
                  <p className="text-sm text-destructive mt-2">{errors.asBuiltDrawingRevisionIds.message}</p>
                )}
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create RFA
        </Button>
      </div>
    </form>
  );
}
