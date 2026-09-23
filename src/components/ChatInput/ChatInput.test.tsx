import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from './ChatInput';

function setup(props: Partial<Parameters<typeof ChatInput>[0]> = {}) {
  const onSend = vi.fn();
  const user = userEvent.setup();
  render(<ChatInput onSend={onSend} {...props} />);
  const field = screen.getByRole('textbox', { name: 'Mensaje' });
  const button = screen.getByRole('button', { name: 'Enviar mensaje' });
  return { onSend, user, field, button };
}

describe('ChatInput', () => {
  it('envía con Enter y limpia el campo', async () => {
    const { onSend, user, field } = setup();
    await user.type(field, '  hola  {Enter}');
    expect(onSend).toHaveBeenCalledWith('hola');
    expect(field).toHaveValue('');
  });

  it('inserta salto de línea con Shift+Enter', async () => {
    const { onSend, user, field } = setup();
    await user.type(field, 'uno{Shift>}{Enter}{/Shift}dos');
    expect(onSend).not.toHaveBeenCalled();
    expect(field).toHaveValue('uno\ndos');
  });

  it('envía con el botón', async () => {
    const { onSend, user, field, button } = setup();
    expect(button).toBeDisabled();
    await user.type(field, 'hola');
    expect(button).toBeEnabled();
    await user.click(button);
    expect(onSend).toHaveBeenCalledWith('hola');
  });

  it('no envía texto vacío', async () => {
    const { onSend, user, field } = setup();
    await user.type(field, '   {Enter}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('no envía mientras está deshabilitado', async () => {
    const { onSend, user, field, button } = setup({ disabled: true });
    await user.type(field, 'hola{Enter}');
    expect(onSend).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  it('usa el placeholder y el límite de caracteres', () => {
    const { field } = setup({ placeholder: 'Pregunta algo', maxLength: 10 });
    expect(field).toHaveAttribute('placeholder', 'Pregunta algo');
    expect(field).toHaveAttribute('maxLength', '10');
  });
});
