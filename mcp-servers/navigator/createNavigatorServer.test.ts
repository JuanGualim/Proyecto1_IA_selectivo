// @vitest-environment node
import { callJson, connectInMemory } from '../shared/testing.ts';
import { createNavigatorServer } from './createNavigatorServer.ts';

describe('servidor MCP de navegación', () => {
  it('devuelve la acción open_url para la ficha de IMDb', async () => {
    const client = await connectInMemory(createNavigatorServer());
    const { data } = await callJson(client, 'open_reference', { site: 'imdb', id: 'tt1160419' });
    expect(data).toEqual({
      action: 'open_url',
      site: 'imdb',
      url: 'https://www.imdb.com/title/tt1160419/',
      label: 'IMDb',
      openedOnHost: false,
    });
    await client.close();
  });

  it('abre en la máquina anfitriona si se configuró', async () => {
    const openOnHost = vi.fn(async () => undefined);
    const client = await connectInMemory(createNavigatorServer({ openOnHost }));
    const { data } = await callJson(client, 'open_reference', {
      site: 'google_books',
      query: 'Dune Frank Herbert',
    });
    expect(openOnHost).toHaveBeenCalledWith(
      'https://www.google.com/search?tbm=bks&q=Dune%20Frank%20Herbert',
    );
    expect(data).toMatchObject({ openedOnHost: true });
    await client.close();
  });

  it('rechaza sitios fuera de la lista y peticiones sin datos', async () => {
    const openOnHost = vi.fn(async () => undefined);
    const client = await connectInMemory(createNavigatorServer({ openOnHost }));

    const evil = await callJson(client, 'open_reference', { site: 'evil', query: 'x' });
    expect(evil.result.isError).toBe(true);
    const empty = await callJson(client, 'open_reference', { site: 'imdb', id: 'javascript:x' });
    expect(empty.result.isError).toBe(true);
    expect(openOnHost).not.toHaveBeenCalled();
    await client.close();
  });
});
