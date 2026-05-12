// File: src/modules/delegation/services/circular-detection.service.ts
// ตรวจจับ Circular Delegation (A→B→C→A) ป้องกัน infinite loop (FR-012)
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Delegation } from '../entities/delegation.entity';

@Injectable()
export class CircularDetectionService {
  constructor(
    @InjectRepository(Delegation)
    private readonly delegationRepo: Repository<Delegation>,
  ) {}

  /**
   * ตรวจสอบ Circular Delegation ด้วย Depth-First Search
   * ตัวอย่าง: A→B→C→A จะถูกจับได้เมื่อ proposedFrom=A, proposedTo=B
   *
   * @param proposedFrom - delegatorUserId ที่กำลังจะสร้าง delegation
   * @param proposedTo   - delegateUserId ที่กำลังจะสร้าง delegation
   * @param today        - วันที่ตรวจสอบ (default: now)
   * @returns true ถ้าจะเกิด circular delegation
   */
  async wouldCreateCircle(
    proposedFrom: number,
    proposedTo: number,
    today: Date = new Date(),
  ): Promise<boolean> {
    // ถ้า A→B และ proposedFrom=B, proposedTo=A → circular ชัดเจน
    if (proposedFrom === proposedTo) return true;

    // ดึง delegations ที่ active ทั้งหมดในช่วงเวลานั้น
    const activeDelegations = await this.delegationRepo
      .createQueryBuilder('d')
      .where('d.is_active = 1')
      .andWhere('d.start_date <= :today', { today })
      .andWhere('d.end_date >= :today', { today })
      .select(['d.delegatorUserId', 'd.delegateUserId'])
      .getMany();

    // สร้าง adjacency list: from → [to, ...]
    const graph = new Map<number, number[]>();
    for (const d of activeDelegations) {
      if (!graph.has(d.delegatorUserId)) graph.set(d.delegatorUserId, []);
      graph.get(d.delegatorUserId)!.push(d.delegateUserId);
    }

    // เพิ่ม edge ที่กำลังจะสร้าง
    if (!graph.has(proposedFrom)) graph.set(proposedFrom, []);
    graph.get(proposedFrom)!.push(proposedTo);

    // DFS จาก proposedTo เพื่อหา path กลับมาที่ proposedFrom
    return this.dfsHasCycle(proposedTo, proposedFrom, graph, new Set());
  }

  private dfsHasCycle(
    current: number,
    target: number,
    graph: Map<number, number[]>,
    visited: Set<number>,
  ): boolean {
    if (current === target) return true;
    if (visited.has(current)) return false;

    visited.add(current);

    const neighbors = graph.get(current) ?? [];
    for (const neighbor of neighbors) {
      if (this.dfsHasCycle(neighbor, target, graph, visited)) {
        return true;
      }
    }

    return false;
  }
}
