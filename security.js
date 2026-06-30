/**
 * Utilidades de seguridad — hash de contraseñas (SHA-256)
 */
const Security = {
  async hashPassword(password) {
    const data = new TextEncoder().encode(String(password));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  },

  async verifyPassword(password, storedHash) {
    if (!storedHash) return false;
    const hash = await this.hashPassword(password);
    return hash === storedHash;
  },

  validatePasswordStrength(password) {
    if (!password || password.length < 6) {
      return { ok: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
    }
    if (password.length > 64) {
      return { ok: false, error: 'La contraseña no puede superar 64 caracteres.' };
    }
    return { ok: true };
  },

  generateTempPassword(length = 8) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    const arr = new Uint8Array(length);
    crypto.getRandomValues(arr);
    for (let i = 0; i < length; i++) {
      result += chars[arr[i] % chars.length];
    }
    return result;
  }
};
