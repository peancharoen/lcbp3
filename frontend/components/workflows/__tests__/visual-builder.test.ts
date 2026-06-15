// File: components/workflows/__tests__/visual-builder.test.ts
// Change Log:
// - 2026-06-14: สร้างใหม่สำหรับ Phase 3 Coverage

import { describe, it, expect } from 'vitest';

// Mock ReactFlow to avoid dependency issues
vi.mock('reactflow', () => ({
  ReactFlow: () => null,
  Controls: () => null,
  Background: () => null,
  Panel: () => null,
  useNodesState: () => [[], () => {}, () => {}],
  useEdgesState: () => [[], () => {}, () => {}],
  addEdge: (params: any, edges: any) => [...edges, params],
  useReactFlow: () => ({ fitView: () => {} }),
  MarkerType: { ArrowClosed: 'arrowclosed' },
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Import helper functions after mocking
import { createNode, createEdge, parseDSL } from '../visual-builder';

describe('visual-builder helper functions', () => {
  describe('createNode', () => {
    it('ควรสร้าง node ปกติ', () => {
      const node = createNode('TestNode', 100);

      expect(node.id).toBe('TestNode');
      expect(node.type).toBe('default');
      expect(node.data.label).toBe('TestNode\n(No Role)');
      expect(node.data.name).toBe('TestNode');
    });

    it('ควรสร้าง start node เมื่อ isStart=true', () => {
      const node = createNode('Start', 100, { isStart: true });

      expect(node.type).toBe('input');
      expect(node.data.type).toBe('START');
      expect(node.style?.background).toBe('#10b981');
    });

    it('ควรสร้าง end node เมื่อ isEnd=true', () => {
      const node = createNode('End', 100, { isEnd: true });

      expect(node.type).toBe('output');
      expect(node.data.type).toBe('END');
      expect(node.style?.background).toBe('#ef4444');
    });

    it('ควรสร้าง condition node เมื่อ isCondition=true', () => {
      const node = createNode('Condition', 100, { isCondition: true });

      expect(node.style?.background).toBe('#fef3c7');
      expect(node.style?.borderStyle).toBe('dashed');
    });

    it('ควรใส่ role ใน label เมื่อมี role', () => {
      const node = createNode('Task', 100, { role: 'Manager' });

      expect(node.data.label).toBe('Task\n(Manager)');
      expect(node.data.role).toBe('Manager');
    });
  });

  describe('createEdge', () => {
    it('ควรสร้าง edge ระหว่าง source และ target', () => {
      const edge = createEdge('node1', 'node2', 'TRANSITION');

      expect(edge.source).toBe('node1');
      expect(edge.target).toBe('node2');
      expect(edge.label).toBe('TRANSITION');
      expect(edge.id).toBe('e-node1-TRANSITION-node2');
    });

    it('ควรมี markerEnd', () => {
      const edge = createEdge('node1', 'node2', 'TRANSITION');

      expect(edge.markerEnd).toBeDefined();
    });
  });

  describe('parseDSL', () => {
    it('ควร return empty nodes/edges เมื่อ DSL เป็น empty string', () => {
      const result = parseDSL('');

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('ควร return empty nodes/edges เมื่อ JSON parse fail', () => {
      const result = parseDSL('invalid json');

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('ควร parse DSL ที่มี states array', () => {
      const dsl = JSON.stringify({
        states: [
          { name: 'Start', type: 'START', initial: true },
          { name: 'Review', role: 'Manager' },
        ],
      });

      const result = parseDSL(dsl);

      expect(result.nodes.length).toBe(2);
      expect(result.nodes[0].data.name).toBe('Start');
      expect(result.nodes[1].data.name).toBe('Review');
    });

    it('ควร parse DSL ที่มี states object', () => {
      const dsl = JSON.stringify({
        initialState: 'Start',
        states: {
          Start: { initial: true },
          End: { terminal: true },
        },
      });

      const result = parseDSL(dsl);

      expect(result.nodes.length).toBe(2);
      expect(result.nodes[0].data.name).toBe('Start');
      expect(result.nodes[1].data.name).toBe('End');
    });

    it('ควรสร้าง edges จาก transitions', () => {
      const dsl = JSON.stringify({
        states: [
          { name: 'Start', on: { SUBMIT: { to: 'Review' } } },
          { name: 'Review' },
        ],
      });

      const result = parseDSL(dsl);

      expect(result.edges.length).toBe(1);
      expect(result.edges[0].source).toBe('Start');
      expect(result.edges[0].target).toBe('Review');
    });

    it('ควร handle dslDefinition field', () => {
      const dsl = JSON.stringify({
        dslDefinition: JSON.stringify({
          states: [{ name: 'Start' }],
        }),
      });

      const result = parseDSL(dsl);

      expect(result.nodes.length).toBe(1);
    });

    it('ควร handle role จาก require.role', () => {
      const dsl = JSON.stringify({
        states: [
          { name: 'Review', on: { SUBMIT: { require: { role: 'Manager' } } } },
        ],
      });

      const result = parseDSL(dsl);

      expect(result.nodes[0].data.role).toBe('Manager');
    });

    it('ควร handle role array จาก require.role', () => {
      const dsl = JSON.stringify({
        states: [
          { name: 'Review', on: { SUBMIT: { require: { role: ['Manager', 'Lead'] } } } },
        ],
      });

      const result = parseDSL(dsl);

      expect(result.nodes[0].data.role).toBe('Manager, Lead');
    });
  });
});
