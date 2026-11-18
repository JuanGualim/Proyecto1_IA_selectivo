// @vitest-environment node
import { LlmError, type LlmProvider } from './LlmProvider.ts';
import { RetryingProvider } from './RetryingProvider.ts';
import { textResponse } from './ScriptedProvider.ts';

function flaky(...outcomes: Array<Error | 'ok'>): LlmProvider & { calls: number } {
  return {
    name: 'flaky',
    calls: 0,
    async complete() {
      this.calls += 1;
      const next = outcomes.shift();
      if (next instanceof Error) throw next;
      return textResponse('ok');
    },
  };
}

const request = { system: 's', messages: [] };

describe('RetryingProvider', () => {
  it('reintenta errores recuperables con backoff y respeta retry-after', async () => {
    const inner = flaky(
      new LlmError('límite', true),
      new LlmError('límite', true, 5000),
      new LlmError('caída', true),
      'ok',
    );
    const sleep = vi.fn(async (_ms: number) => undefined);
    const onRetry = vi.fn();
    const provider = new RetryingProvider(inner, { sleep, onRetry, baseDelayMs: 100 });

    expect((await provider.complete(request)).text).toBe('ok');
    expect(provider.name).toBe('flaky');
    expect(inner.calls).toBe(4);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([100, 5000, 400]);
    expect(onRetry).toHaveBeenCalledTimes(3);
  });

  it('limita la espera máxima y el número de reintentos', async () => {
    const inner = flaky(
      new LlmError('límite', true, 999_000),
      new LlmError('límite', true),
      new LlmError('límite', true),
    );
    const sleep = vi.fn(async (_ms: number) => undefined);
    const provider = new RetryingProvider(inner, { sleep, maxRetries: 2, maxDelayMs: 1000 });

    await expect(provider.complete(request)).rejects.toThrow('límite');
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 1000]);
    expect(inner.calls).toBe(3);
  });

  it('no reintenta errores no recuperables ni errores desconocidos', async () => {
    const sleep = vi.fn(async (_ms: number) => undefined);
    await expect(
      new RetryingProvider(flaky(new LlmError('credenciales')), { sleep }).complete(request),
    ).rejects.toThrow('credenciales');
    await expect(
      new RetryingProvider(flaky(new Error('bug')), { sleep }).complete(request),
    ).rejects.toThrow('bug');
    expect(sleep).not.toHaveBeenCalled();
  });

  it('usa una espera real por defecto', async () => {
    vi.useFakeTimers();
    const provider = new RetryingProvider(flaky(new LlmError('x', true), 'ok'), {
      baseDelayMs: 10,
    });
    const pending = provider.complete(request);
    await vi.advanceTimersByTimeAsync(10);
    expect((await pending).text).toBe('ok');
    vi.useRealTimers();
  });
});
