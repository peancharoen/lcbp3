import * as crypto from 'crypto';

// Configuration
const JWT_SECRET =
  'eebc122aa65adde8c76c6a0847d9649b2b67a06db1504693e6c912e51499b76e';
const API_URL = 'http://localhost:3000/api';

// Helper to sign JWT
function signJwt(payload: any) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString(
    'base64url',
  );
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
    'base64url',
  );

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(encodedHeader + '.' + encodedPayload)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function main() {
  // 1. Generate Token for Editor01 (ID 3)
  const token = signJwt({ username: 'editor01', sub: 3 });
  console.log('Generated Token:', token);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  try {
    // 1.5 Check Permissions
    console.log('\nChecking Permissions...');
    const permRes = await fetch(`${API_URL}/users/me/permissions`, { headers });
    if (permRes.ok) {
      const perms = await permRes.json();
      console.log('My Permissions:', perms);
    } else {
      console.error(
        'Failed to get permissions:',
        permRes.status,
        await permRes.text(),
      );
    }

    // 2. Create Correspondence
    console.log('\nCreating Correspondence...');
    const createRes = await fetch(`${API_URL}/correspondences`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        projectId: 1,
        typeId: 1, // Assuming ID 1 exists (e.g., RFA or Memo)
        // originatorId: 1, // Removed for Admin user
        title: 'Manual Verification Doc',
        details: { note: 'Created via script' },
      }),
    });

    if (!createRes.ok) {
      throw new Error(
        `Create failed: ${createRes.status} ${await createRes.text()}`,
      );
    }

    const doc: any = await createRes.json();
    console.log('Created Document:', doc.id, doc.correspondenceNumber);

    // 3. Submit Workflow
    console.log('\nSubmitting Workflow...');
    const submitRes = await fetch(
      `${API_URL}/correspondences/${doc.id}/submit`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          templateId: 1, // Assuming Template ID 1 exists
        }),
      },
    );

    if (!submitRes.ok) {
      const text = await submitRes.text();
      console.error(`Submit failed: ${submitRes.status} ${text}`);
      if (text.includes('template')) {
        console.warn(
          '⚠️ Template ID 1 not found. Please ensure a Routing Template exists.',
        );
      }
      return;
    }

    console.log('Workflow Submitted Successfully');

    // 4. Approve Workflow (as same user for simplicity, assuming logic allows or user has permission)
    console.log('\nApproving Workflow...');
    const approveRes = await fetch(
      `${API_URL}/correspondences/${doc.id}/workflow/action`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          action: 'APPROVE',
          comment: 'Approved via script',
        }),
      },
    );

    if (!approveRes.ok) {
      throw new Error(
        `Approve failed: ${approveRes.status} ${await approveRes.text()}`,
      );
    }

    console.log('Workflow Approved Successfully');
  } catch (error: any) {
    console.error('Error:', error.message);
  }
}

main().catch((err) => console.error(err));
