import { describe, expect, it } from 'vitest';
import { isAuthorized } from './basicAuth';

const header = (credentials: string) => `Basic ${Buffer.from(credentials).toString('base64')}`;

describe('isAuthorized (Basic Auth)', () => {
  it('to\'g\'ri login va parol', () => {
    expect(isAuthorized(header('admin:s3cret'), 'admin', 's3cret')).toBe(true);
  });

  it('parolda ":" bo\'lishi mumkin', () => {
    expect(isAuthorized(header('admin:a:b:c'), 'admin', 'a:b:c')).toBe(true);
  });

  it('xato parol, xato login, uzunligi farqli qiymatlar', () => {
    expect(isAuthorized(header('admin:wrong'), 'admin', 's3cret')).toBe(false);
    expect(isAuthorized(header('root:s3cret'), 'admin', 's3cret')).toBe(false);
    expect(isAuthorized(header('admin:s3cretX'), 'admin', 's3cret')).toBe(false);
  });

  it('sarlavha yo\'q yoki noto\'g\'ri formatda', () => {
    expect(isAuthorized(null, 'admin', 's3cret')).toBe(false);
    expect(isAuthorized('Bearer s3cret', 'admin', 's3cret')).toBe(false);
    expect(isAuthorized(header('admins3cret'), 'admin', 's3cret')).toBe(false);
    expect(isAuthorized('Basic %%%', 'admin', 's3cret')).toBe(false);
  });
});
