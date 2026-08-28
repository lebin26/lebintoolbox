/**
 * Cloudflare Worker Authentication & Crypto Module for OmniBox
 * Web Crypto API compliant: PBKDF2 Password Hashing, HMAC-SHA256 Token Signing, User Auth Middleware
 */

const JWT_SECRET_DEFAULT = 'omnibox-secret-key-salt-production-2026';

// Base64Url Helpers
function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) str += '=';
  return atob(str);
}

// Generate random hex salt
export function generateSalt(length = 16) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

// PBKDF2 Password Hash with Salt (Web Crypto API)
export async function hashPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(salt),
      iterations: 10000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    true,
    ['sign']
  );
  const exported = await crypto.subtle.exportKey('raw', key);
  return Array.from(new Uint8Array(exported)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Sign HMAC-SHA256 Token (JWT)
export async function createToken(payload, secret = JWT_SECRET_DEFAULT, expiresInSeconds = 86400 * 30) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const body = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds
  };

  const enc = new TextEncoder();
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedBody = base64UrlEncode(JSON.stringify(body));
  const message = `${encodedHeader}.${encodedBody}`;

  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const signatureBytes = Array.from(new Uint8Array(signature)).map(b => String.fromCharCode(b)).join('');
  const encodedSignature = base64UrlEncode(signatureBytes);

  return `${message}.${encodedSignature}`;
}

// Verify HMAC-SHA256 Token (JWT)
export async function verifyToken(token, secret = JWT_SECRET_DEFAULT) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  const [encodedHeader, encodedBody, encodedSignature] = parts;
  const message = `${encodedHeader}.${encodedBody}`;
  const enc = new TextEncoder();

  try {
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const sigStr = base64UrlDecode(encodedSignature);
    const sigBytes = new Uint8Array(sigStr.length);
    for (let i = 0; i < sigStr.length; i++) {
      sigBytes[i] = sigStr.charCodeAt(i);
    }

    const isValid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(message));
    if (!isValid) return null;

    const payload = JSON.parse(base64UrlDecode(encodedBody));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null; // Expired
    }
    return payload;
  } catch (e) {
    return null;
  }
}

// Extract Authenticated User from Request
export async function getAuthenticatedUser(request, env) {
  const authHeader = request.headers.get('Authorization') || request.headers.get('X-Auth-Token') || '';
  let token = '';

  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else {
    token = authHeader.trim();
  }

  if (!token) return null;

  const secret = env.JWT_SECRET || JWT_SECRET_DEFAULT;
  const payload = await verifyToken(token, secret);
  if (!payload || !payload.id) return null;

  try {
    const user = await env.DB.prepare(
      'SELECT id, username, role, status, nickname, avatar_url AS avatarUrl, allowed_apps AS allowedApps, app_permissions AS appPermissions FROM users WHERE id = ? AND status = "active"'
    ).bind(payload.id).first();

    if (!user) return null;

    return {
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status,
      nickname: user.nickname || user.username,
      avatarUrl: user.avatarUrl || null,
      allowedApps: user.allowedApps ? (typeof user.allowedApps === 'string' ? JSON.parse(user.allowedApps) : user.allowedApps) : ['courtledger', 'financial'],
      appPermissions: user.appPermissions ? (typeof user.appPermissions === 'string' ? JSON.parse(user.appPermissions) : user.appPermissions) : []
    };
  } catch (err) {
    console.error('getAuthenticatedUser DB error:', err);
    return null;
  }
}

// Log Admin Action
export async function logAdminAction(env, adminId, action, targetUserId, details) {
  try {
    await env.DB.prepare(
      'INSERT INTO admin_logs (admin_id, action, target_user_id, details) VALUES (?, ?, ?, ?)'
    ).bind(
      adminId,
      action,
      targetUserId || null,
      typeof details === 'object' ? JSON.stringify(details) : String(details)
    ).run();
  } catch (err) {
    console.error('Failed to log admin action:', err);
  }
}
