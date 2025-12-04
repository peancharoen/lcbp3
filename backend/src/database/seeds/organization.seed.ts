import { DataSource } from 'typeorm';
import { Organization } from '../../modules/organizations/entities/organization.entity';

export async function seedOrganizations(dataSource: DataSource) {
  const repo = dataSource.getRepository(Organization);

  const orgs = [
    { organizationCode: 'กทท.', organizationName: 'การท่าเรือแห่งประเทศไทย' },
    {
      organizationCode: 'สคฉ.3',
      organizationName: 'โครงการพัฒนาท่าเรือแหลมฉบัง ระยะที่ 3',
    },
    {
      organizationCode: 'สคฉ.3-01',
      organizationName: 'ตรวจรับพัสดุ ที่ปรึกษาควบคุมงาน',
    },
    {
      organizationCode: 'สคฉ.3-02',
      organizationName: 'ตรวจรับพัสดุ งานทางทะเล',
    },
    {
      organizationCode: 'สคฉ.3-03',
      organizationName: 'ตรวจรับพัสดุ อาคารและระบบสาธารณูปโภค',
    },
    {
      organizationCode: 'สคฉ.3-04',
      organizationName: 'ตรวจรับพัสดุ ตรวจสอบผลกระทบสิ่งแวดล้อม',
    },
    {
      organizationCode: 'สคฉ.3-05',
      organizationName: 'ตรวจรับพัสดุ เยียวยาการประมง',
    },
    {
      organizationCode: 'สคฉ.3-06',
      organizationName: 'ตรวจรับพัสดุ งานก่อสร้าง ส่วนที่ 3',
    },
    {
      organizationCode: 'สคฉ.3-07',
      organizationName: 'ตรวจรับพัสดุ งานก่อสร้าง ส่วนที่ 4',
    },
    {
      organizationCode: 'สคฉ.3-xx',
      organizationName: 'ตรวจรับพัสดุ ที่ปรึกษาออกแบบ ส่วนที่ 4',
    },
    { organizationCode: 'TEAM', organizationName: 'Designer Consulting Ltd.' },
    {
      organizationCode: 'คคง.',
      organizationName: 'Construction Supervision Ltd.',
    },
    { organizationCode: 'ผรม.1', organizationName: 'Contractor งานทางทะเล' },
    { organizationCode: 'ผรม.2', organizationName: 'Contractor งานก่อสร้าง' },
    {
      organizationCode: 'ผรม.3',
      organizationName: 'Contractor งานก่อสร้าง ส่วนที่ 3',
    },
    {
      organizationCode: 'ผรม.4',
      organizationName: 'Contractor งานก่อสร้าง ส่วนที่ 4',
    },
    { organizationCode: 'EN', organizationName: 'Third Party Environment' },
    { organizationCode: 'CAR', organizationName: 'Third Party Fishery Care' },
  ];

  for (const org of orgs) {
    const exists = await repo.findOneBy({
      organizationCode: org.organizationCode,
    });
    if (!exists) {
      await repo.save(repo.create(org));
    }
  }
}
