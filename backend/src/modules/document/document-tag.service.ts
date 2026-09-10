// File: backend/src/modules/document/document-tag.service.ts
// Change Log:
// - 2026-09-09: เพิ่มการจัดการ Bulk Tag แบบ polymorphic สำหรับ Feature 253

import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  NotFoundException,
  ValidationException,
} from '../../common/exceptions/base.exception';

/** บริการจัดการแท็กของเอกสารที่มี root table ต่างกัน */
@Injectable()
export class DocumentTagService {
  constructor(private readonly dataSource: DataSource) {}

  /** เพิ่มหรือลบแท็กของเอกสารหนึ่งรายการด้วย publicId */
  public async apply(
    publicId: string,
    documentType: string,
    addTags: number[],
    removeTags: number[],
    userId: number
  ): Promise<void> {
    const rootQueries: Record<string, string> = {
      RFA: 'SELECT c.id FROM correspondences c INNER JOIN rfas r ON r.id = c.id WHERE c.uuid = ?',
      TRANSMITTAL:
        'SELECT c.id FROM correspondences c INNER JOIN transmittals t ON t.correspondence_id = c.id WHERE c.uuid = ?',
      DRAWING: 'SELECT id FROM contract_drawings WHERE uuid = ?',
      CIRCULATION: 'SELECT id FROM circulations WHERE uuid = ?',
    };
    const query = rootQueries[documentType];
    if (!query) {
      throw new ValidationException('Unsupported document type for bulk tag', [
        {
          field: 'documentType',
          message: 'ไม่รองรับประเภทเอกสารสำหรับการแก้ไขแท็กเป็นชุด',
        },
      ]);
    }
    const rows = await this.dataSource.query<Array<{ id: number }>>(query, [
      publicId,
    ]);
    const root = rows[0];
    if (!root) throw new NotFoundException(documentType, publicId);
    for (const tagId of addTags) {
      await this.dataSource.query(
        'INSERT IGNORE INTO document_tags (document_type, document_id, tag_id, created_by) VALUES (?, ?, ?, ?)',
        [documentType, root.id, tagId, userId]
      );
    }
    for (const tagId of removeTags) {
      await this.dataSource.query(
        'DELETE FROM document_tags WHERE document_type = ? AND document_id = ? AND tag_id = ?',
        [documentType, root.id, tagId]
      );
    }
  }
}
