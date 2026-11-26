import { describe, expect, it } from 'vitest';
import { probeMentorion, type FetchLike } from '../integrations/mentorion';

describe('probeMentorion capability detection', () => {
  it('returns unconfigured immediately when apiUrl is null', async () => {
    let called = false;
    const mockFetch: FetchLike = async () => {
      called = true;
      return { ok: true, status: 200 };
    };
    const cap = await probeMentorion(null, { fetchImpl: mockFetch });
    expect(called).toBe(false);
    expect(cap.configured).toBe(false);
    expect(cap.online).toBe(false);
    expect(cap.apiUrl).toBeNull();
  });

  it('reports online when /health succeeds', async () => {
    const urls: string[] = [];
    const mockFetch: FetchLike = async (url) => {
      urls.push(url);
      return { ok: true, status: 200 };
    };
    const cap = await probeMentorion('http://localhost:8000/', { fetchImpl: mockFetch });
    expect(urls).toEqual(['http://localhost:8000/health']);
    expect(cap.configured).toBe(true);
    expect(cap.online).toBe(true);
    expect(cap.apiUrl).toBe('http://localhost:8000');
  });

  it('falls back to root / when /health returns 404', async () => {
    const urls: string[] = [];
    const mockFetch: FetchLike = async (url) => {
      urls.push(url);
      if (url.endsWith('/health')) return { ok: false, status: 404 };
      return { ok: true, status: 200 };
    };
    const cap = await probeMentorion('http://localhost:8000', { fetchImpl: mockFetch });
    expect(urls).toEqual(['http://localhost:8000/health', 'http://localhost:8000/']);
    expect(cap.configured).toBe(true);
    expect(cap.online).toBe(true);
  });

  it('reports offline cleanly when unreachable', async () => {
    const mockFetch: FetchLike = async () => {
      throw new Error('ECONNREFUSED');
    };
    const cap = await probeMentorion('http://localhost:8000', { fetchImpl: mockFetch });
    expect(cap.configured).toBe(true);
    expect(cap.online).toBe(false);
    expect(cap.error).toContain('ECONNREFUSED');
  });
});
