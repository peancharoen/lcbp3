// File: backend/src/common/clamav/clamav.service.spec.ts
// Change Log:
// - 2026-08-26: สร้าง unit test สำหรับ ClamAVService ครอบคลุม scanFile, parseResponse, isAvailable (ADR-016 SEV-002)

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EventEmitter } from 'events';
import { ClamAVService } from './clamav.service';

jest.mock('net');
jest.mock('fs');

import * as net from 'net';
import * as fs from 'fs';

/** Mock Socket จำลองพฤติกรรมของ net.Socket ผ่าน EventEmitter */
class MockSocket extends EventEmitter {
  setTimeout = jest.fn();
  write = jest.fn();
  destroy = jest.fn();
  connect = jest.fn();
}

describe('ClamAVService', () => {
  let service: ClamAVService;
  let mockSocket: MockSocket;

  const configValues: Record<string, unknown> = {
    CLAMAV_ENABLED: 'true',
    CLAMAV_HOST: 'clamav-host',
    CLAMAV_PORT: 3310,
  };

  const mockConfigService = {
    get: jest.fn(<T>(key: string, defaultValue?: T): T | undefined => {
      return (configValues[key] as T | undefined) ?? defaultValue;
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSocket = new MockSocket();
    jest
      .mocked(net.Socket)
      .mockImplementation(() => mockSocket as unknown as net.Socket);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClamAVService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();
    service = module.get<ClamAVService>(ClamAVService);
  });

  describe('scanFile() - disabled / not found', () => {
    it('ควรข้ามการสแกนเมื่อ CLAMAV_ENABLED=false', async () => {
      const disabledConfig = {
        get: jest.fn(<T>(key: string, defaultValue?: T): T | undefined => {
          const vals: Record<string, unknown> = {
            CLAMAV_ENABLED: 'false',
            CLAMAV_HOST: 'clamav-host',
            CLAMAV_PORT: 3310,
          };
          return (vals[key] as T | undefined) ?? defaultValue;
        }),
      };
      const mod = await Test.createTestingModule({
        providers: [
          ClamAVService,
          { provide: ConfigService, useValue: disabledConfig },
        ],
      }).compile();
      const svc = mod.get<ClamAVService>(ClamAVService);
      const result = await svc.scanFile('/tmp/test.pdf');
      expect(result.scanned).toBe(false);
      expect(result.isInfected).toBe(false);
    });

    it('ควรข้ามการสแกนเมื่อไฟล์ไม่มีอยู่จริง', async () => {
      jest.mocked(fs.existsSync).mockReturnValueOnce(false);
      const result = await service.scanFile('/tmp/missing.pdf');
      expect(result.scanned).toBe(false);
      expect(result.isInfected).toBe(false);
    });
  });

  describe('scanFile() - INSTREAM protocol', () => {
    beforeEach(() => {
      jest.mocked(fs.existsSync).mockReturnValue(true);
    });

    it('คืน isInfected=false scanned=true เมื่อ ClamAV ตอบ stream OK', async () => {
      const readStream = new EventEmitter();
      jest
        .mocked(fs.createReadStream)
        .mockReturnValueOnce(readStream as unknown as fs.ReadStream);

      const promise = service.scanFile('/tmp/clean.pdf');
      mockSocket.emit('connect');
      readStream.emit('data', Buffer.from('file content'));
      readStream.emit('end');
      mockSocket.emit('data', Buffer.from('stream: OK'));
      mockSocket.emit('close');

      const result = await promise;
      expect(result.isInfected).toBe(false);
      expect(result.scanned).toBe(true);
      expect(mockSocket.write).toHaveBeenCalledWith('zINSTREAM\0');
    });

    it('คืน isInfected=true พร้อม viruses เมื่อ ClamAV ตอบ INFECTED', async () => {
      const readStream = new EventEmitter();
      jest
        .mocked(fs.createReadStream)
        .mockReturnValueOnce(readStream as unknown as fs.ReadStream);

      const promise = service.scanFile('/tmp/infected.pdf');
      mockSocket.emit('connect');
      readStream.emit('data', Buffer.from('malware'));
      readStream.emit('end');
      mockSocket.emit('data', Buffer.from('stream: INFECTED: Eicar-Test'));
      mockSocket.emit('close');

      const result = await promise;
      expect(result.isInfected).toBe(true);
      expect(result.scanned).toBe(true);
      expect(result.viruses).toContain('Eicar-Test');
    });

    it('คืน viruses UNKNOWN เมื่อ INFECTED ไม่มีชื่อ virus', async () => {
      const readStream = new EventEmitter();
      jest
        .mocked(fs.createReadStream)
        .mockReturnValueOnce(readStream as unknown as fs.ReadStream);

      const promise = service.scanFile('/tmp/infected2.pdf');
      mockSocket.emit('connect');
      readStream.emit('data', Buffer.from('malware'));
      readStream.emit('end');
      mockSocket.emit('data', Buffer.from('stream: INFECTED'));
      mockSocket.emit('close');

      const result = await promise;
      expect(result.isInfected).toBe(true);
      expect(result.viruses).toEqual(['UNKNOWN']);
    });

    it('คืน scanned=false เมื่อ response ว่างเปล่า', async () => {
      const readStream = new EventEmitter();
      jest
        .mocked(fs.createReadStream)
        .mockReturnValueOnce(readStream as unknown as fs.ReadStream);

      const promise = service.scanFile('/tmp/empty.pdf');
      mockSocket.emit('connect');
      readStream.emit('end');
      mockSocket.emit('data', Buffer.from(''));
      mockSocket.emit('close');

      const result = await promise;
      expect(result.scanned).toBe(false);
      expect(result.isInfected).toBe(false);
    });

    it('คืน scanned=false เมื่อ response เป็น ERROR อื่น ๆ', async () => {
      const readStream = new EventEmitter();
      jest
        .mocked(fs.createReadStream)
        .mockReturnValueOnce(readStream as unknown as fs.ReadStream);

      const promise = service.scanFile('/tmp/error.pdf');
      mockSocket.emit('connect');
      readStream.emit('end');
      mockSocket.emit('data', Buffer.from('ERROR: some error'));
      mockSocket.emit('close');

      const result = await promise;
      expect(result.scanned).toBe(false);
      expect(result.isInfected).toBe(false);
    });

    it('คืน scanned=false เมื่อ readStream error', async () => {
      const readStream = new EventEmitter();
      jest
        .mocked(fs.createReadStream)
        .mockReturnValueOnce(readStream as unknown as fs.ReadStream);

      const promise = service.scanFile('/tmp/readerror.pdf');
      mockSocket.emit('connect');
      readStream.emit('error', new Error('read failed'));

      const result = await promise;
      expect(result.scanned).toBe(false);
      expect(result.isInfected).toBe(false);
      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    it('คืน scanned=false เมื่อ socket timeout', async () => {
      const readStream = new EventEmitter();
      jest
        .mocked(fs.createReadStream)
        .mockReturnValueOnce(readStream as unknown as fs.ReadStream);

      const promise = service.scanFile('/tmp/slow.pdf');
      mockSocket.emit('connect');
      readStream.emit('data', Buffer.from('partial'));
      mockSocket.emit('timeout');

      const result = await promise;
      expect(result.scanned).toBe(false);
      expect(result.isInfected).toBe(false);
      expect(mockSocket.destroy).toHaveBeenCalled();
    });

    it('คืน scanned=false เมื่อ socket error', async () => {
      const readStream = new EventEmitter();
      jest
        .mocked(fs.createReadStream)
        .mockReturnValueOnce(readStream as unknown as fs.ReadStream);

      const promise = service.scanFile('/tmp/connfail.pdf');
      mockSocket.emit('error', new Error('ECONNREFUSED'));

      const result = await promise;
      expect(result.scanned).toBe(false);
      expect(result.isInfected).toBe(false);
      expect(mockSocket.destroy).toHaveBeenCalled();
    });
  });

  describe('isAvailable()', () => {
    it('คืน false เมื่อ CLAMAV_ENABLED=false', async () => {
      const disabledConfig = {
        get: jest.fn(<T>(key: string, defaultValue?: T): T | undefined => {
          const vals: Record<string, unknown> = {
            CLAMAV_ENABLED: 'false',
            CLAMAV_HOST: 'clamav-host',
            CLAMAV_PORT: 3310,
          };
          return (vals[key] as T | undefined) ?? defaultValue;
        }),
      };
      const mod = await Test.createTestingModule({
        providers: [
          ClamAVService,
          { provide: ConfigService, useValue: disabledConfig },
        ],
      }).compile();
      const svc = mod.get<ClamAVService>(ClamAVService);
      const result = await svc.isAvailable();
      expect(result).toBe(false);
    });

    it('คืน true เมื่อเชื่อมต่อ ClamAV สำเร็จ', async () => {
      const freshSocket = new MockSocket();
      jest
        .mocked(net.Socket)
        .mockImplementation(() => freshSocket as unknown as net.Socket);
      const promise = service.isAvailable();
      freshSocket.emit('connect');
      const result = await promise;
      expect(result).toBe(true);
      expect(freshSocket.destroy).toHaveBeenCalled();
    });

    it('คืน false เมื่อ socket error', async () => {
      const freshSocket = new MockSocket();
      jest
        .mocked(net.Socket)
        .mockImplementation(() => freshSocket as unknown as net.Socket);
      const promise = service.isAvailable();
      freshSocket.emit('error', new Error('Connection refused'));
      const result = await promise;
      expect(result).toBe(false);
    });

    it('คืน false เมื่อ socket timeout', async () => {
      const freshSocket = new MockSocket();
      jest
        .mocked(net.Socket)
        .mockImplementation(() => freshSocket as unknown as net.Socket);
      const promise = service.isAvailable();
      freshSocket.emit('timeout');
      const result = await promise;
      expect(result).toBe(false);
    });
  });
});
