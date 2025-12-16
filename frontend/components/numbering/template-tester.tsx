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
import { Input } from '@/components/ui/input';

interface TemplateTesterProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    template: NumberingTemplate | null;
}

export function TemplateTester({ open, onOpenChange, template }: TemplateTesterProps) {
  const [testData, setTestData] = useState({
    organizationId: "1",
    disciplineId: "1",
    year: new Date().getFullYear(),
  });
  const [generatedNumber, setGeneratedNumber] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    if (!template) return;
    setLoading(true);
    try {
        // Note: generateTestNumber expects keys: organizationId, disciplineId
        const result = await numberingApi.generateTestNumber(template.id ?? 0, {
            organizationId: testData.organizationId,
            disciplineId: testData.disciplineId
        });
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
            Template: <span className="font-mono font-bold text-foreground">{template?.formatTemplate}</span>
        </div>

        <Card className="p-6 mt-6 bg-muted/50 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Template Tester</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h4 className="text-sm font-medium mb-2">Test Parameters</h4>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-xs font-medium">Organization</label>
                                <Input
                                    value={testData.organizationId}
                                    onChange={(e) => setTestData({...testData, organizationId: e.target.value})}
                                    placeholder="Org ID"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-medium">Discipline</label>
                                <Input
                                    value={testData.disciplineId}
                                    onChange={(e) => setTestData({...testData, disciplineId: e.target.value})}
                                    placeholder="Disc ID"
                                />
                            </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Format: {template?.formatTemplate}
                        </p>
                    </div>
                </div>
            </div>
        </Card>

          <Button onClick={handleGenerate} className="w-full" disabled={loading || !template}>
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

      </DialogContent>
    </Dialog>
  );
}
