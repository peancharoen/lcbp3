const axios = require('axios');

async function test() {
  try {
    // Need to login first to get a token for superadmin
    const loginRes = await axios.post('http://127.0.0.1:3001/api/auth/login', {
      email: 'admin@lcbp3.com',
      password: 'password123!', // Using common seed password
    });

    const token = loginRes.data.data.access_token;
    console.log('Got token');

    // Recreate the preview request
    const previewRes = await axios.post(
      'http://127.0.0.1:3001/api/document-numbering/preview',
      {
        projectId: 1, // fallback
        originatorOrganizationId: '0',
        recipientOrganizationId: '0',
        correspondenceTypeId: 0,
        disciplineId: 0,
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    console.log('Status:', previewRes.status);
    console.log('Body:', JSON.stringify(previewRes.data, null, 2));
  } catch (err) {
    if (err.response) {
      console.log('Error Status:', err.response.status);
      console.log('Error Body:', JSON.stringify(err.response.data, null, 2));
    } else {
      console.error(err);
    }
  }
}

test();
