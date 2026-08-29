// File: backend/src/types/json-logic-js.d.ts
// Type declarations for json-logic-js (no bundled types)
// ADR-001/ADR-049 FR-015: JSON Logic evaluator for workflow transition conditions

declare module 'json-logic-js' {
  type JsonLogicRule =
    | Record<string, unknown>
    | unknown[]
    | string
    | number
    | boolean
    | null;
  type JsonLogicData = Record<string, unknown>;

  interface JsonLogic {
    apply(rule: JsonLogicRule, data?: JsonLogicData): unknown;
    addOperation(name: string, fn: (...args: unknown[]) => unknown): void;
    rmOperation(name: string): void;
    uses_operator(rule: JsonLogicRule): boolean;
  }

  const jsonLogic: JsonLogic;
  export default jsonLogic;
}
