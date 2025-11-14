-- Add payment screenshot support for COD orders
-- ASMs can upload payment proof for QR code orders

-- Add columns to orders table for payment screenshot
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT,
ADD COLUMN IF NOT EXISTS payment_screenshot_uploaded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS payment_screenshot_uploaded_by UUID REFERENCES auth.users(id);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_orders_payment_screenshot 
ON public.orders(payment_screenshot_url) 
WHERE payment_screenshot_url IS NOT NULL;

-- Add comment
COMMENT ON COLUMN public.orders.payment_screenshot_url IS 'URL to payment screenshot uploaded by ASM for QR code payments';
COMMENT ON COLUMN public.orders.payment_screenshot_uploaded_at IS 'Timestamp when payment screenshot was uploaded';
COMMENT ON COLUMN public.orders.payment_screenshot_uploaded_by IS 'User ID who uploaded the payment screenshot';

