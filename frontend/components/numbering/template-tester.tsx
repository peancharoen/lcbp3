'use client';

import { useState } from 'react';
import axios from 'axios';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NumberingTemplate, numberingApi } from '@/lib/api/numbering';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useOrganizations, useCorrespondenceTypes, useDisciplines, useContracts } from '@/hooks/use-master-data';
import { Organization } from '@/types/organization';
import { Contract, getContractPublicId } from '@/types/contract';

// Local interfaces for Master Data since centralized ones are missing/fragmented
interface CorrespondenceType {
  id: number;
  typeCode: string;
  typeName: string;
}

interface Discipline {
  id: number;
  disciplineCode: string;
}

interface TemplateTesterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: NumberingTemplate | null;
}

export function TemplateTester({ open, onOpenChange, template }: TemplateTesterProps) {
  const [testData, setTestData] = useState({
    originatorId: '',
    recipientId: '',
    correspondenceTypeId: '',
    disciplineId: '',
    year: new Date().getFullYear(),
  });
  const [testResult, setTestResult] = useState<{ number: string; isDefault?: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  // Master Data Hooks
  const templateWithProject = template as (NumberingTemplate & { project?: { id?: number; uuid?: string } }) | null;
  const projectId = templateWithProject?.project?.id ?? templateWithProject?.project?.uuid ?? template?.projectId ?? 1;
  const { data: organizations } = useOrganizations({ isActive: true });
  const { data: correspondenceTypes } = useCorrespondenceTypes();
  const { data: contractsData } = useContracts(projectId);
  const contracts = (Array.isArray(contractsData) ? contractsData : []) as Contract[];

  // Use first contract ID for disciplines, fallback to 1 or undefined
  const contractId = getContractPublicId(contracts[0]);
  const { data: disciplines } = useDisciplines(contractId);

  const handleGenerate = async () => {
    if (!template) return;
    setLoading(true);
    setTestResult(null);
    try {
      const payload = {
        projectId: projectId,
        originatorOrganizationId: testData.originatorId || '0',
        recipientOrganizationId: testData.recipientId || '0',
        correspondenceTypeId: Number(testData.correspondenceTypeId || '0'),
        disciplineId: Number(testData.disciplineId || '0'),
        year: testData.year,
      };
      const result = await numberingApi.previewNumber(payload);

      setTestResult({
        number: result.previewNumber,
        isDefault: result.isDefault,
      });
    } catch (error: unknown) {
      let errMsg = 'Unknown error';
      if (axios.isAxiosError(error)) {
        errMsg = error.response?.data?.message || error.message;
      } else if (error instanceof Error) {
        errMsg = error.message;
      }
      setTestResult({ number: `Error: ${errMsg}`, isDefault: false });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Test Number Generation</DialogTitle>
        </DialogHeader>

        <div className="mb-2 text-sm text-muted-foreground">
          Template: <span className="font-mono font-bold text-foreground">{template?.formatTemplate}</span>
        </div>

        <Card className="mt-6 rounded-lg bg-muted/50 p-6">
          <h3 className="mb-4 text-lg font-semibold">Template Tester</h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="md:col-span-2">
              <h4 className="mb-2 text-sm font-medium">Test Parameters</h4>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* Originator */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Originator (ORG)</label>
                    <Select
                      value={testData.originatorId}
                      onValueChange={(val) => setTestData({ ...testData, originatorId: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Originator" />
                      </SelectTrigger>
                      <SelectContent>
                        {(organizations as Organization[])?.map((org) => (
                          <SelectItem key={org.publicId} value={org.publicId}>
                            {org.organizationCode} - {org.organizationName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Recipient */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Recipient (REC)</label>
                    <Select
                      value={testData.recipientId}
                      onValueChange={(val) => setTestData({ ...testData, recipientId: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Recipient" />
                      </SelectTrigger>
                      <SelectContent>
                        {(organizations as Organization[])?.map((org) => (
                          <SelectItem key={org.publicId} value={org.publicId}>
                            {org.organizationCode} - {org.organizationName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Document Type */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Document Type (TYPE)</label>
                    <Select
                      value={testData.correspondenceTypeId}
                      onValueChange={(val) => setTestData({ ...testData, correspondenceTypeId: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Default (All Types)</SelectItem>
                        {(correspondenceTypes as CorrespondenceType[])?.map((type) => (
                          <SelectItem key={type.id} value={type.id.toString()}>
                            {type.typeCode} - {type.typeName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Discipline */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Discipline (DIS)</label>
                    <Select
                      value={testData.disciplineId}
                      onValueChange={(val) => setTestData({ ...testData, disciplineId: val })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Discipline" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">None</SelectItem>
                        {(disciplines as Discipline[])?.map((disc) => (
                          <SelectItem key={disc.id} value={disc.id.toString()}>
                            {disc.disciplineCode}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="mt-4 text-xs text-muted-foreground">Format Preview: {template?.formatTemplate}</p>
              </div>
            </div>
          </div>
        </Card>

        <Button onClick={handleGenerate} className="mt-4 w-full" disabled={loading || !template}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Generate Test Number
        </Button>

        {testResult && (
          <Card
            className={`mt-4 border p-4 text-center ${(testResult.number || '').startsWith('Error:') ? 'border-destructive/30 bg-destructive/10 text-destructive' : 'border-success/30 bg-success/10'}`}
          >
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {(testResult.number || '').startsWith('Error:') ? 'Generation Failed:' : 'Generated Number:'}
              </p>
              {testResult.isDefault && !(testResult.number || '').startsWith('Error:') && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px]">
                  Default Template
                </Badge>
              )}
              {!testResult.isDefault && !(testResult.number || '').startsWith('Error:') && (
                <Badge variant="outline" className="h-4 border-success/30 bg-success/10 px-1 text-[10px] text-success">
                  Specific Template
                </Badge>
              )}
            </div>
            <div
              className={`font-mono text-2xl font-bold ${(testResult.number || '').startsWith('Error:') ? 'text-destructive' : 'text-success'}`}
            >
              {testResult.number || (
                <div className="max-h-48 overflow-auto rounded border bg-muted p-2 text-left font-mono text-xs text-foreground">
                  Empty Result. Raw: {JSON.stringify(testResult, null, 2)}
                </div>
              )}
            </div>
          </Card>
        )}
      </DialogContent>
    </Dialog>
  );
}
