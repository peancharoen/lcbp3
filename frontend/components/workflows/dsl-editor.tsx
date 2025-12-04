"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle, AlertCircle, Play, Loader2 } from "lucide-react";
import Editor from "@monaco-editor/react";
import { workflowApi } from "@/lib/api/workflows";
import { ValidationResult } from "@/types/workflow";

interface DSLEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
}

export function DSLEditor({ initialValue = "", onChange }: DSLEditorProps) {
  const [dsl, setDsl] = useState(initialValue);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const handleEditorChange = (value: string | undefined) => {
    const newValue = value || "";
    setDsl(newValue);
    onChange?.(newValue);
    setValidationResult(null); // Clear validation on change
  };

  const validateDSL = async () => {
    setIsValidating(true);
    try {
      const result = await workflowApi.validateDSL(dsl);
      setValidationResult(result);
    } catch (error) {
      console.error(error);
      setValidationResult({ valid: false, errors: ["Validation failed due to an error"] });
    } finally {
      setIsValidating(false);
    }
  };

  const testWorkflow = async () => {
    alert("Test workflow functionality to be implemented");
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Workflow DSL</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={validateDSL}
            disabled={isValidating}
          >
            {isValidating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Validate
          </Button>
          <Button variant="outline" onClick={testWorkflow}>
            <Play className="mr-2 h-4 w-4" />
            Test
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border rounded-md">
        <Editor
          height="500px"
          defaultLanguage="yaml"
          value={dsl}
          onChange={handleEditorChange}
          theme="vs-dark"
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            rulers: [80],
            wordWrap: "on",
            scrollBeyondLastLine: false,
          }}
        />
      </Card>

      {validationResult && (
        <Alert variant={validationResult.valid ? "default" : "destructive"} className={validationResult.valid ? "border-green-500 text-green-700 bg-green-50" : ""}>
          {validationResult.valid ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {validationResult.valid ? (
              "DSL is valid ✓"
            ) : (
              <div>
                <p className="font-medium mb-2">Validation Errors:</p>
                <ul className="list-disc list-inside space-y-1">
                  {validationResult.errors?.map((error: string, i: number) => (
                    <li key={i} className="text-sm">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
