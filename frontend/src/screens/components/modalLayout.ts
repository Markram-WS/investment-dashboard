/**
 * Shared modal layout classes.
 *
 * ModalShell owns the height budget (`max-h-[calc(100dvh-48px)]`); every card
 * inside it is a column that never exceeds that budget. Only the body scrolls,
 * so the primary action in the footer stays visible at any viewport height.
 */
export const MODAL_CARD = 'flex max-h-full min-h-0 flex-col';

/** Non-scrolling header (title row). */
export const MODAL_HEADER = 'flex-none';

/** The only scroll region inside a modal. */
export const MODAL_BODY = 'min-h-0 flex-1 overflow-y-auto overscroll-contain';

/** Non-scrolling footer holding the action buttons. */
export const MODAL_FOOTER = 'flex-none';
