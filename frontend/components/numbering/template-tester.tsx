'use client';

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { NumberingTemplate, numberingApi } from '@/lib/api/numbering';
import { Loader2 } from 'lucide-react';

interface TemplateTesterProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    template: NumberingTemplate | null;
}

export function TemplateTester({ open, onOpenChange, template }: TemplateTesterProps) {
  const [testData, setTestData] = useState({
    organization_id: '1',
    discipline_id: '1',
    year: new Date().getFullYear(),
  });
  const [generatedNumber, setGeneratedNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    if (!template) return;
    setLoading(true);
    try {
        const result = await numberingApi.generateTestNumber(template.template_id, testData);
        setGeneratedNumber(result.number);
    } finally {
        setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Test Number Generation</DialogTitle>
        </DialogHeader>

        <div className="text-sm text-muted-foreground mb-2">
            Template: <span className="font-mono font-bold text-foreground">{template?.template_format}</span>
        </div>

        <div className="space-y-4">
          <div>
            <Label>Organization (Mock Context)</Label>
            <Select value={testData.organization_id} onValueChange={v => setTestData({...testData, organization_id: v})}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Port Authority (PAT/กทท)</SelectItem>
                <SelectItem value="2">Contractor (CN/สค)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Discipline (Mock Context)</Label>
            <Select value={testData.discipline_id} onValueChange={v => setTestData({...testData, discipline_id: v})}>
              <SelectTrigger>
                <SelectValue placeholder="Select discipline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Structure (STR)</SelectItem>
                <SelectItem value="2">Architecture (ARC)</SelectItem>
                <SelectItem value="3">General (GEN)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleTest} className="w-full" disabled={loading || !template}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Test Number
          </Button>

          {generatedNumber && (
            <Card className="p-4 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900 border text-center">
              <p className="text-sm text-muted-foreground mb-1">Generated Number:</p>
              <p className="text-2xl font-mono font-bold text-green-700 dark:text-green-400">
                {generatedNumber}
              </p>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
