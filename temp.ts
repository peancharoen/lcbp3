// ใน function submit()
      // 2.1 สร้าง Routing Record แรก
      const routing = queryRunner.manager.create(CorrespondenceRouting, {
        correspondenceId: currentRevision.id,
        templateId: template.id, // ✅ บันทึก templateId ไว้ใช้อ้างอิง
        sequence: 1,
        fromOrganizationId: user.primaryOrganizationId,
        toOrganizationId: firstStep.toOrganizationId,
        stepPurpose: firstStep.stepPurpose,
        status: 'SENT',
        dueDate: new Date(
          Date.now() + (firstStep.expectedDays || 7) * 24 * 60 * 60 * 1000,
        ),
        processedByUserId: user.user_id,
        processedAt: new Date(),
      });