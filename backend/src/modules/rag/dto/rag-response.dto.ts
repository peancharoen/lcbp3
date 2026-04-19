export interface RagCitation {
  chunkId: string;
  docNumber: string | null;
  docType: string;
  revision: string | null;
  snippet: string;
  score: number;
}

export class RagResponseDto {
  answer!: string;
  citations!: RagCitation[];
  confidence!: number;
  usedFallbackModel!: boolean;
  cachedAt?: string;
}
