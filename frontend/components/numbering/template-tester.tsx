"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { NumberingTemplate } from "@/types/numbering";
import { numberingApi } from "@/lib/api/numbering";
import { Loader2 } from "lucide-react";

interface TemplateTesterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: NumberingTemplate | null;
}

export function TemplateTester({ open, onOpenChange, template }: TemplateTesterProps) {
  const [testData, setTestData] = useState({
    organization_id: "1",
    discipline_id: "1",
    year: new Date().getFullYear(),
  });
  const [generatedNumber, setGeneratedNumber] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTest = async () => {
    if (!template) return;
    setLoading(true);
    try {
      const result = await numberingApi.testTemplate(template.template_id, testData);
      setGeneratedNumber(result.number);
    } catch (error) {
      console.error("Failed to generate test number", error);
      setGeneratedNumber("Error generating number");
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

        <div className="space-y-4">
          <div>
            <Label>Organization</Label>
            <Select
              value={testData.organization_id}
              onValueChange={(value) => setTestData({ ...testData, organization_id: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">กทท.</SelectItem>
                <SelectItem value="2">สค©.</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Discipline (Optional)</Label>
            <Select
              value={testData.discipline_id}
              onValueChange={(value) => setTestData({ ...testData, discipline_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select discipline" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">STR</SelectItem>
                <SelectItem value="2">ARC</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button onClick={handleTest} className="w-full" disabled={loading || !template}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Test Number
          </Button>

          {generatedNumber && (
            <Card className="p-4 bg-green-50 border-green-200">
              <p className="text-sm text-muted-foreground mb-1">Generated Number:</p>
              <p className="text-2xl font-mono font-bold text-green-700">
                {generatedNumber}
              </p>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
