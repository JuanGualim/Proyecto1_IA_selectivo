import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { SendIcon } from '../icons/icons';

export interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
}

const MAX_HEIGHT_PX = 120;

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = 'Escribe un mensaje…',
  maxLength = 2000,
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend = !disabled && value.trim().length > 0;

  const resize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    // Con box-sizing: border-box, scrollHeight no incluye el borde; se suma para evitar el scroll.
    const border = el.offsetHeight - el.clientHeight;
    el.style.height = `${Math.min(el.scrollHeight + border, MAX_HEIGHT_PX)}px`;
  };

  const submit = () => {
    if (!canSend) return;
    onSend(value.trim());
    setValue('');
    requestAnimationFrame(resize);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    submit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter envía; Shift+Enter inserta salto de línea. Se respeta la composición IME.
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };

  return (
    <form className="agichat-input" onSubmit={handleSubmit}>
      <textarea
        ref={textareaRef}
        className="agichat-input__field"
        value={value}
        rows={1}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label="Mensaje"
        onChange={(event) => {
          setValue(event.target.value);
          resize();
        }}
        onKeyDown={handleKeyDown}
      />
      <button
        type="submit"
        className="agichat-input__send"
        disabled={!canSend}
        aria-label="Enviar mensaje"
      >
        <SendIcon />
      </button>
    </form>
  );
}
