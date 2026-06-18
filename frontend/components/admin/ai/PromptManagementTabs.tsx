// File: frontend/components/admin/ai/PromptManagementTabs.tsx
// Change Log
// - 2026-06-17: Created PromptManagementTabs for OCR & AI Extraction prompt separation (Feature 238)

'use client';

import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { OcrPromptTab } from './OcrPromptTab';
import { AiExtractionPromptTab } from './AiExtractionPromptTab';

/**
 * Component หลักสำหรับจัดการ Prompt Management แบบแยก Tab
 * - OCR System Prompt Tab: จัดการ system prompt สำหรับ OCR engine
 * - AI Extraction Prompt Tab: จัดการ extraction prompt สำหรับ LLM
 */
export function PromptManagementTabs() {
  const [activeTab, setActiveTab] = useState('ocr-system');

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="ocr-system">OCR System Prompt</TabsTrigger>
        <TabsTrigger value="ai-extraction">AI Extraction Prompt</TabsTrigger>
      </TabsList>
      <TabsContent value="ocr-system">
        <OcrPromptTab />
      </TabsContent>
      <TabsContent value="ai-extraction">
        <AiExtractionPromptTab />
      </TabsContent>
    </Tabs>
  );
}
