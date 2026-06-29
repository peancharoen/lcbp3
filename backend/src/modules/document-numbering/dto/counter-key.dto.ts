export class CounterKeyDto {
  projectId!: number;
  originatorOrganizationId!: number;
  recipientOrganizationId!: number;
  correspondenceTypeId!: number;
  subTypeId!: number;
  rfaTypeId!: number;
  disciplineId!: number;
  resetScope!: string;
}

export function buildCounterKey(context: {
  projectId: number;
  originatorOrgId: number;
  recipientOrgId?: number;
  correspondenceTypeId: number;
  subTypeId?: number;
  rfaTypeId?: number;
  disciplineId?: number;
  year?: number;
  isRFA?: boolean;
}): CounterKeyDto {
  const currentYear = context.year || new Date().getFullYear();

  return {
    projectId: context.projectId,
    originatorOrganizationId: context.originatorOrgId,
    recipientOrganizationId: context.recipientOrgId || 0,
    correspondenceTypeId: context.correspondenceTypeId,
    subTypeId: context.subTypeId || 0,
    rfaTypeId: context.rfaTypeId || 0,
    disciplineId: context.disciplineId || 0,
    resetScope: context.isRFA ? 'NONE' : `YEAR_${currentYear + 543}`, // Buddhist year
  };
}
