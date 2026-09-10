import { describe, expect, it } from 'vitest';
import { buildCorsOrigin } from './cors';

function check(patterns: string[], origin: string | undefined): boolean {
  let result = false;
  buildCorsOrigin(patterns)(origin, (_e, allow) => {
    result = allow ?? false;
  });
  return result;
}

describe('buildCorsOrigin', () => {
  it('permite localhost e Capacitor sem configuração', () => {
    expect(check([], 'http://localhost:8100')).toBe(true);
    expect(check([], 'http://localhost:4200')).toBe(true);
    expect(check([], 'capacitor://localhost')).toBe(true);
    expect(check([], 'https://localhost')).toBe(true);
  });

  it('sem Origin (curl / server-to-server) passa', () => {
    expect(check([], undefined)).toBe(true);
  });

  it('casa origem exata da env', () => {
    expect(check(['https://junto.app'], 'https://junto.app')).toBe(true);
    expect(check(['https://junto.app'], 'https://outro.app')).toBe(false);
  });

  it('suporta curinga *', () => {
    const p = ['https://*.vercel.app'];
    expect(check(p, 'https://junto-abc123.vercel.app')).toBe(true);
    expect(check(p, 'https://junto.vercel.app')).toBe(true);
    expect(check(p, 'https://junto.vercel.app.evil.com')).toBe(false);
    expect(check(p, 'http://junto.vercel.app')).toBe(false);
  });

  it('bloqueia origem desconhecida', () => {
    expect(check(['https://junto.app'], 'https://evil.example')).toBe(false);
  });
});
