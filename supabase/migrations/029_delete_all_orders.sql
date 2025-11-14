-- Delete all orders and related events
-- This will cascade delete rider_events, asm_events, and deposit_orders

DELETE FROM public.deposit_orders;
DELETE FROM public.deposits;
DELETE FROM public.asm_events;
DELETE FROM public.rider_events;
DELETE FROM public.orders;

-- Reset any sequences if needed
-- Note: UUIDs don't use sequences, but if you have any serial columns, reset them here

