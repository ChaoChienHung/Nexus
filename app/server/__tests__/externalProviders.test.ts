import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { askNexusVault } from '../ask';
import { buildNexusIndex } from '../indexer';

const index = buildNexusIndex(path.resolve(__dirname, '../../../knowledge'), { includeDrafts: true });
afterEach(() => vi.unstubAllGlobals());

describe('external LLM providers', () => {
  it('sends Anthropic messages and extracts text', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({content: [{type:'text', text:'Claude answer'}]}), {status: 200}));
    vi.stubGlobal('fetch', fetchMock);
    const result = await askNexusVault(index, {question:'hello', scope:'vault', provider:'anthropic', model:'claude-test', apiKey:'test-key', history:[{role:'assistant', content:'earlier'}]});
    expect(result.answer).toBe('Claude answer');
    expect(result.providerUsed).toBe('anthropic');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(options.headers['x-api-key']).toBe('test-key');
    expect(JSON.parse(options.body)).toMatchObject({model:'claude-test', max_tokens:2048, messages:[{role:'assistant',content:'earlier'},{role:'user',content:'hello'}]});
  });
  it('sends Gemini contents and extracts response without thought parts', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({candidates:[{content:{parts:[{text:'private',thought:true},{text:'Gemini answer'}]}}]}), {status:200}));
    vi.stubGlobal('fetch', fetchMock);
    const result = await askNexusVault(index, {question:'hello', scope:'vault', provider:'gemini', model:'gemini-test', apiKey:'test-key', history:[{role:'assistant',content:'earlier'}]});
    expect(result.answer).toBe('Gemini answer');
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent');
    expect(options.headers['x-goog-api-key']).toBe('test-key');
    expect(JSON.parse(options.body).contents).toEqual([{role:'model',parts:[{text:'earlier'}]},{role:'user',parts:[{text:'hello'}]}]);
  });
  it('reports an external provider error and returns local retrieval', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', {status:401})));
    const result = await askNexusVault(index, {question:'hello',scope:'vault',provider:'anthropic',apiKey:'bad',lang:'en'});
    expect(result.providerUsed).toBe('retrieval');
    expect(result.warning).toContain('401');
  });
});
