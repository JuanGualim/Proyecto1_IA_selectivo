/**
 * Punto de entrada del bundle IIFE (`<script src="agichat-widget.iife.js">`).
 * Expone todo en `window.AGIChat`.
 */
export { mountChatWidget } from './sdk/mountChatWidget';
export { MockTransport, WebSocketTransport, createTransport } from './transports';
