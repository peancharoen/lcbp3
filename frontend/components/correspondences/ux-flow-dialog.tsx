'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { ChevronDown, GitBranch, Info } from 'lucide-react';

const flowSteps = [
  {
    step: '1',
    icon: '📝',
    title: 'Create Correspondence Master',
    table: 'correspondences',
    detail:
      'Create parent record with number, type, project, originator, and recipients (TO/CC).',
  },
  {
    step: '2',
    icon: '📋',
    title: 'Create Current Revision',
    table: 'correspondence_revisions',
    detail:
      'Create revision 0 as current revision (is_current=true) with subject/body/date fields and initial status.',
  },
  {
    step: '3',
    icon: '⬆️',
    title: 'Two-Phase Attachment',
    table: 'attachments (temp) -> correspondence_revision_attachments',
    detail:
      'Upload files into temporary storage first, then commit and link each file to a specific revision.',
  },
  {
    step: '4',
    icon: '✉️',
    title: 'Submit and Workflow',
    table: 'correspondence_routing / workflow',
    detail:
      'Submit document and move through routing/workflow actions (review/approve/reject) with status transitions.',
  },
  {
    step: '5',
    icon: '🔄',
    title: 'New Revision Cycle',
    table: 'correspondence_revisions',
    detail:
      'When editing after response, create a new revision and switch previous current revision to non-current.',
  },
  {
    step: '6',
    icon: '🧩',
    title: 'RFA Extension Path',
    table: 'rfas + rfa_revisions + rfa_items',
    detail:
      'RFA list is unified in Correspondences (?type=RFA), while RFA new/detail/edit remain specialized routes.',
  },
];

const keyRules = [
  'Only one current revision is allowed per correspondence at any time.',
  'Recipients (TO/CC) are linked at correspondence master level, not per revision.',
  'References and tags are correspondence-level relations for search and traceability.',
  'Attachment links are revision-level using correspondence_revision_attachments.',
  'Use publicId as API identifier in frontend routing and payload handling.',
];

const relationshipChips = [
  'correspondence_recipients (M:N)',
  'correspondence_tags (M:N)',
  'correspondence_references (M:N)',
  'correspondence_revision_attachments (Junction)',
];

const statusLegend = [
  { code: 'DRAFT', label: 'Draft' },
  { code: 'SUB*', label: 'Submitted' },
  { code: 'REP*', label: 'Reply' },
  { code: 'RSB*', label: 'Resubmitted' },
  { code: 'CLB*', label: 'Closed' },
  { code: 'CCB*', label: 'Cancelled' },
];

export function CorrespondenceUxFlowDialog() {
  const [openStep, setOpenStep] = useState(flowSteps[0]?.step ?? '1');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 gap-1.5">
          <GitBranch className="h-4 w-4" />
          UX Flow
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Correspondence UX Flow Diagram</DialogTitle>
          <DialogDescription>
            Master-Revision lifecycle, two-phase attachment model, and RFA extension behavior.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-card p-4 space-y-3">
          <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Table Relationship (Master-Revision Pattern)
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-amber-400/40 bg-amber-500/10 px-2 py-1 text-xs font-medium">
              correspondences
            </span>
            <span className="text-xs text-muted-foreground">1:N</span>
            <span className="rounded-md border border-sky-400/40 bg-sky-500/10 px-2 py-1 text-xs font-medium">
              correspondence_revisions
            </span>
            <span className="text-xs text-muted-foreground">M:N</span>
            <span className="rounded-md border border-violet-400/40 bg-violet-500/10 px-2 py-1 text-xs font-medium">
              attachments
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {relationshipChips.map((chip) => (
              <span
                key={chip}
                className="rounded border bg-muted/60 px-2 py-1 text-[11px] text-muted-foreground"
              >
                {chip}
              </span>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {flowSteps.map((item) => (
            <div key={item.step} className="rounded-md border bg-card">
              <button
                type="button"
                className="w-full p-2.5 flex items-center gap-2 text-left"
                onClick={() =>
                  setOpenStep((current) =>
                    current === item.step ? '' : item.step
                  )
                }
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold shrink-0">
                  {item.step}
                </span>
                <h4 className="font-semibold text-sm flex-1 min-w-0 truncate pr-2">
                  {item.icon} {item.title}
                </h4>
                <ChevronDown
                  className={`h-4 w-4 text-muted-foreground transition-transform shrink-0 ${
                    openStep === item.step ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {openStep === item.step && (
                <div className="px-2.5 pb-2.5 space-y-1.5">
                  <div className="rounded border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary w-fit">
                    {item.table}
                  </div>
                  <p className="text-sm text-muted-foreground">{item.detail}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="rounded-md border bg-card p-2.5">
          <div className="mb-2 text-sm font-semibold">Status Legend</div>
          <div className="flex flex-wrap gap-2">
            {statusLegend.map((item) => (
              <span
                key={item.code}
                className="rounded border px-1.5 py-0.5 text-xs bg-muted/60 text-foreground"
              >
                {item.code} - {item.label}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-primary/20 bg-primary/5 p-2.5">
          <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Info className="h-4 w-4" />
            Key UX Rules
          </div>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {keyRules.map((rule) => (
              <li key={rule}>- {rule}</li>
            ))}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
