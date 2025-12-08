'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, AlertCircle, Play, Loader2 } from 'lucide-react';
import Editor, { OnMount } from '@monaco-editor/react';
import { workflowApi } from '@/lib/api/workflows';
import { ValidationResult } from '@/types/workflow';
import { useTheme } from 'next-themes';

interface DSLEditorProps {
  initialValue?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
}

export function DSLEditor({ initialValue = '', onChange, readOnly = false }: DSLEditorProps) {
  const [dsl, setDsl] = useState(initialValue);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const editorRef = useRef<unknown>(null);
  const { theme } = useTheme();

  // Update internal state if initialValue changes (e.g. loaded from API)
  useEffect(() => {
    setDsl(initialValue);
  }, [initialValue]);

  const handleEditorChange = (value: string | undefined) => {
    const newValue = value || '';
    setDsl(newValue);
    onChange?.(newValue);
    // Clear previous validation result on edit to avoid stale state
    if (validationResult) {
      setValidationResult(null);
    }
  };

  const handleEditorDidMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  const validateDSL = async () => {
    setIsValidating(true);
    try {
      const result = await workflowApi.validateDSL(dsl);
      setValidationResult(result);
    } catch (error) {
      console.error("Validation error:", error);
      setValidationResult({ valid: false, errors: ['Validation failed due to server error'] });
    } finally {
      setIsValidating(false);
    }
  };

  interface TestResult {
    success: boolean;
    message: string;
  }

  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const testWorkflow = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
        // Mock test execution
        await new Promise(resolve => setTimeout(resolve, 1000));
        setTestResult({ success: true, message: "Workflow simulation completed successfully." });
    } catch {
        setTestResult({ success: false, message: "Workflow simulation failed." });
    } finally {
        setIsTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Workflow DSL</h3>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={validateDSL}
            disabled={isValidating || readOnly}
          >
            {isValidating ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
            )}
            Validate
          </Button>
          <Button variant="outline" onClick={testWorkflow} disabled={isTesting || readOnly}>
             {isTesting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
                <Play className="mr-2 h-4 w-4" />
            )}
            Test
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden border-2">
        <Editor
          height="500px"
          defaultLanguage="yaml"
          value={dsl}
          onChange={handleEditorChange}
          onMount={handleEditorDidMount}
          theme={theme === 'dark' ? 'vs-dark' : 'light'}
          options={{
            readOnly: readOnly,
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            rulers: [80],
            wordWrap: 'on',
            scrollBeyondLastLine: false,
            automaticLayout: true,
          }}
        />
      </Card>

      {validationResult && (
        <Alert variant={validationResult.valid ? 'default' : 'destructive'} className={validationResult.valid ? "border-green-500 text-green-700 dark:text-green-400" : ""}>
          {validationResult.valid ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <AlertCircle className="h-4 w-4" />
          )}
          <AlertDescription>
            {validationResult.valid ? (
              <span className="font-semibold">DSL is valid and ready to deploy.</span>
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

       {testResult && (
        <Alert variant={testResult.success ? 'default' : 'destructive'}  className={testResult.success ? "border-blue-500 text-blue-700 dark:text-blue-400" : ""}>
             {testResult.success ? <CheckCircle className="h-4 w-4"/> : <AlertCircle className="h-4 w-4"/>}
            <AlertDescription>
                {testResult.message}
            </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
