const privateKeyJwk = {
  key_ops: ['sign'],
  ext: true,
  kty: 'EC',
  x: 'aRJeddpDoYu5s720rS5oXGwGbXSYKgdsSNUdj5SwDiA',
  y: '6jC0CNfPrnywmxr_owgO-r2mDTN_3sKWT6Q39x6BrIk',
  crv: 'P-256',
  d: 'hYrem2pqrgT6Hn2OGViO3wZzmehDowDxeN8sX_-Oi_A'
};

const VAPID_PUBLIC_KEY = 'BGkSXnXaQ6GLubO9tK0uaFxsBm10mCoHbEjVHY-UsA4g6jC0CNfPrnywmxr_owgO-r2mDTN_3sKWT6Q39x6BrIk';

function b64Url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function testSign() {
  const key = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  );

  const header = { typ: 'JWT', alg: 'ES256' };
  const claims = {
    aud: 'https://fcm.googleapis.com',
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: 'mailto:soporte@tay-audit.pages.dev'
  };

  const headerB64 = b64Url(Buffer.from(JSON.stringify(header)));
  const claimsB64 = b64Url(Buffer.from(JSON.stringify(claims)));
  const message = Buffer.from(headerB64 + '.' + claimsB64);

  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    key,
    message
  );

  const jwt = headerB64 + '.' + claimsB64 + '.' + b64Url(signature);
  console.log('JWT generated successfully! Length:', jwt.length);
  console.log('Authorization: vapid t=' + jwt + ', k=' + VAPID_PUBLIC_KEY);
}

testSign().catch(console.error);
