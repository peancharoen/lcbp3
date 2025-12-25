'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { NumberingTemplate, numberingApi } from '@/lib/api/numbering';
import { Loader2 } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useOrganizations, useCorrespondenceTypes, useDisciplines, useContracts } from '@/hooks/use-master-data';
import { Organization } from '@/types/organization';

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
    originatorId: "",
    recipientId: "",
    correspondenceTypeId: "",
    disciplineId: "",
    year: new Date().getFullYear(),
  });
  const [generatedNumber, setGeneratedNumber] = useState('');
  const [loading, setLoading] = useState(false);

  // Master Data Hooks
  const projectId = template?.projectId || 1;
  const { data: organizations } = useOrganizations({ isActive: true });
  const { data: correspondenceTypes } = useCorrespondenceTypes();
  const { data: contracts } = useContracts(projectId);

  // Use first contract ID for disciplines, fallback to 1 or undefined
  const contractId = contracts?.[0]?.id;
  const { data: disciplines } = useDisciplines(contractId);

  const handleGenerate = async () => {
    if (!template) return;
    setLoading(true);
    try {
        const result = await numberingApi.previewNumber({
            projectId: projectId,
            originatorOrganizationId: parseInt(testData.originatorId || "0"),
            recipientOrganizationId: parseInt(testData.recipientId || "0"),
            correspondenceTypeId: parseInt(testData.correspondenceTypeId || "0"),
            disciplineId: parseInt(testData.disciplineId || "0"),
        });
        setGeneratedNumber(result.previewNumber);
    } catch (error: any) {
        console.error("Failed to generate test number", error);
        setGeneratedNumber("");
        // Assuming toast is available globally or we can use console for now,
        // but better to show visible error.
        // Alert is primitive but effective for 'tester' component debugging if toast not imported.
        // Actually, let's just set the error string in display if we can, or add a simple red text.
        setGeneratedNumber(`Error: ${error.response?.data?.message || error.message || "Unknown error"}`);
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

        <div className="text-sm text-muted-foreground mb-2">
            Template: <span className="font-mono font-bold text-foreground">{template?.formatTemplate}</span>
        </div>

        <Card className="p-6 mt-6 bg-muted/50 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Template Tester</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                    <h4 className="text-sm font-medium mb-2">Test Parameters</h4>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            {/* Originator */}
                            <div className="space-y-2">
                                <label className="text-xs font-medium">Originator (ORG)</label>
                                <Select
                                    value={testData.originatorId}
                                    onValueChange={(val) => setTestData({...testData, originatorId: val})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Originator" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(organizations as Organization[])?.map((org) => (
                                            <SelectItem key={org.id} value={org.id.toString()}>
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
                                    onValueChange={(val) => setTestData({...testData, recipientId: val})}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select Recipient" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(organizations as Organization[])?.map((org) => (
                                            <SelectItem key={org.id} value={org.id.toString()}>
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
                                    onValueChange={(val) => setTestData({...testData, correspondenceTypeId: val})}
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
                                    onValueChange={(val) => setTestData({...testData, disciplineId: val})}
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
                        <p className="text-xs text-muted-foreground mt-4">
                            Format Preview: {template?.formatTemplate}
                        </p>
                    </div>
                </div>
            </div>
        </Card>

          <Button onClick={handleGenerate} className="w-full mt-4" disabled={loading || !template}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Test Number
          </Button>

          {generatedNumber && (
            <Card className={`p-4 mt-4 border text-center ${generatedNumber.startsWith('Error:') ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900'}`}>
              <p className="text-sm text-muted-foreground mb-1">{generatedNumber.startsWith('Error:') ? 'Generation Failed:' : 'Generated Number:'}</p>
              <p className={`text-2xl font-mono font-bold ${generatedNumber.startsWith('Error:') ? 'text-red-700' : 'text-green-700 dark:text-green-400'}`}>
                {generatedNumber}
              </p>
            </Card>
          )}

      </DialogContent>
    </Dialog>
  );
}
