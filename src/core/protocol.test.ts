import { parseClientEvent, parseServerEvent, safeJsonParse } from './protocol';

describe('parseServerEvent', () => {
  it.each([
    [
      { type: 'message_start', id: 'a' },
      { type: 'message_start', id: 'a' },
    ],
    [
      { type: 'message_start', id: 'a', replyTo: 'u' },
      { type: 'message_start', id: 'a', replyTo: 'u' },
    ],
    [
      { type: 'message_delta', id: 'a', delta: 'hi' },
      { type: 'message_delta', id: 'a', delta: 'hi' },
    ],
    [
      { type: 'message_end', id: 'a' },
      { type: 'message_end', id: 'a' },
    ],
    [
      { type: 'error', message: 'x' },
      { type: 'error', message: 'x' },
    ],
    [
      { type: 'error', message: 'x', id: 'a' },
      { type: 'error', message: 'x', id: 'a' },
    ],
  ])('acepta eventos válidos %j', (input, expected) => {
    expect(parseServerEvent(input)).toEqual(expected);
  });

  it('descarta campos extra', () => {
    expect(parseServerEvent({ type: 'message_end', id: 'a', extra: true })).toEqual({
      type: 'message_end',
      id: 'a',
    });
  });

  it.each([
    null,
    'texto',
    42,
    [],
    {},
    { type: 1 },
    { type: 'desconocido', id: 'a' },
    { type: 'message_start' },
    { type: 'message_delta', id: 'a' },
    { type: 'message_delta', id: 'a', delta: 3 },
    { type: 'message_end' },
    { type: 'error' },
  ])('rechaza eventos inválidos %j', (input) => {
    expect(parseServerEvent(input)).toBeNull();
  });
});

describe('parseClientEvent', () => {
  it('acepta un user_message válido', () => {
    expect(parseClientEvent({ type: 'user_message', id: '1', content: 'hola' })).toEqual({
      type: 'user_message',
      id: '1',
      content: 'hola',
    });
  });

  it.each([null, {}, { type: 'otro' }, { type: 'user_message', id: 1, content: 'x' }])(
    'rechaza %j',
    (input) => {
      expect(parseClientEvent(input)).toBeNull();
    },
  );
});

describe('safeJsonParse', () => {
  it('parsea JSON válido', () => {
    expect(safeJsonParse('{"a":1}')).toEqual({ a: 1 });
  });

  it('devuelve null con JSON inválido', () => {
    expect(safeJsonParse('{no json')).toBeNull();
  });
});
