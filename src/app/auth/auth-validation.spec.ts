import {
  errorDetail,
  isValidConfirmationCode,
  isValidEmail,
  isValidUsername,
  normalizeEmail,
} from './auth-validation';

describe('auth-validation', () => {
  it('accepts valid usernames', () => {
    expect(isValidUsername('harry')).toBeTrue();
    expect(isValidUsername('user_123')).toBeTrue();
    expect(isValidUsername('a'.repeat(50))).toBeTrue();
  });

  it('rejects invalid usernames', () => {
    expect(isValidUsername('ab')).toBeFalse();
    expect(isValidUsername('a'.repeat(51))).toBeFalse();
    expect(isValidUsername('иван')).toBeFalse();
    expect(isValidUsername('user name')).toBeFalse();
    expect(isValidUsername('')).toBeFalse();
  });

  it('normalizes emails like the server does', () => {
    expect(normalizeEmail('  Harry@Example.COM ')).toBe('harry@example.com');
  });

  it('checks the basic email shape', () => {
    expect(isValidEmail('harry@example.com')).toBeTrue();
    expect(isValidEmail('harry@example')).toBeFalse();
    expect(isValidEmail('example.com')).toBeFalse();
    expect(isValidEmail('')).toBeFalse();
  });

  it('accepts only 6-digit confirmation codes', () => {
    expect(isValidConfirmationCode('123456')).toBeTrue();
    expect(isValidConfirmationCode('12345')).toBeFalse();
    expect(isValidConfirmationCode('1234567')).toBeFalse();
    expect(isValidConfirmationCode('12345a')).toBeFalse();
  });

  it('extracts the string detail from backend errors', () => {
    expect(errorDetail({error: {detail: 'email already exists'}})).toBe('email already exists');
    expect(errorDetail({error: {detail: [{msg: 'boom'}]}})).toBe('');
    expect(errorDetail({error: null})).toBe('');
    expect(errorDetail(undefined)).toBe('');
  });
});
