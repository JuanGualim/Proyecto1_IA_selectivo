// @vitest-environment node
import {
  asArray,
  asNumber,
  asString,
  buildUrl,
  fetchJson,
  HttpError,
  isRecord,
  type FetchLike,
} from './http.ts';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('fetchJson', () => {
  it('devuelve el JSON y envía las cabeceras', async () => {
    const fetchImpl = vi.fn<FetchLike>(async () => jsonResponse({ ok: true }));
    const data = await fetchJson('https://api.test/x', {
      fetchImpl,
      headers: { authorization: 'Bearer t' },
    });

    expect(data).toEqual({ ok: true });
    const init = fetchImpl.mock.calls[0]?.[1] as RequestInit;
    expect(init.headers).toMatchObject({ accept: 'application/json', authorization: 'Bearer t' });
  });

  it('lanza HttpError con el código si la respuesta no es 2xx', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 401));
    await expect(fetchJson('https://api.test/x', { fetchImpl })).rejects.toMatchObject({
      name: 'HttpError',
      status: 401,
    });
  });

  it('convierte fallos de red en HttpError 502', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError('network');
    });
    await expect(fetchJson('https://api.test/x', { fetchImpl })).rejects.toMatchObject({
      status: 502,
    });
  });

  it('aborta y lanza HttpError 504 si se agota el tiempo', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    const error = await fetchJson('https://api.test/x', { fetchImpl, timeoutMs: 5 }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(504);
  });
});

describe('utilidades', () => {
  it('buildUrl omite valores vacíos y codifica los parámetros', () => {
    const url = buildUrl('https://api.test/search', {
      q: 'el señor',
      page: 1,
      empty: '',
      no: undefined,
    });
    expect(url).toBe('https://api.test/search?q=el+se%C3%B1or&page=1');
  });

  it('validadores de tipos', () => {
    expect(isRecord({})).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(asString('')).toBeUndefined();
    expect(asString('a')).toBe('a');
    expect(asNumber(Number.NaN)).toBeUndefined();
    expect(asNumber(3)).toBe(3);
    expect(asArray('x')).toEqual([]);
    expect(asArray([1])).toEqual([1]);
  });
});
