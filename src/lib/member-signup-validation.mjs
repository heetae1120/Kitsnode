/** Pure input validation for the proposed ordinary member signup flow.
 * This does not reserve a username, persist consent, or create an account.
 * The server must perform the same checks and enforce uniqueness itself.
 */
const USERNAME = /^[a-z0-9][a-z0-9_-]{3,19}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeMemberUsername(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

export function validateMemberSignup(input) {
  const value = input && typeof input === 'object' ? input : {};
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  const username = normalizeMemberUsername(value.username);
  const email = typeof value.email === 'string' ? value.email.trim() : '';
  const phone = typeof value.phone === 'string' ? value.phone : '';
  const password = typeof value.password === 'string' ? value.password : '';
  const confirmation = typeof value.passwordConfirmation === 'string' ? value.passwordConfirmation : '';
  const errors = {};

  if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) errors.name = 'invalid_name';
  if (!USERNAME.test(username)) errors.username = 'invalid_username';
  if (password.length < 8 || password.length > 72) errors.password = 'invalid_password';
  if (!confirmation || password !== confirmation) errors.passwordConfirmation = 'password_mismatch';
  if (email.length > 254 || !EMAIL.test(email)) errors.email = 'invalid_email';
  // Format check only; this neither verifies ownership nor requires SMS.
  if (!/^[0-9 -]+$/.test(phone) || !/^01[016789]\d{7,8}$/.test(phone.replace(/[ -]/g, ''))) errors.phone = 'invalid_phone';
  if (value.termsAccepted !== true) errors.terms = 'required';
  if (value.privacyAccepted !== true) errors.privacy = 'required';
  if (value.ageConfirmed !== true) errors.age = 'required';

  return { valid: Object.keys(errors).length === 0, errors };
}
