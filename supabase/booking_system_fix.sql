-- ============================================================
-- SPORTSYNC BOOKING SYSTEM FIX
-- Run this ONCE in Supabase SQL Editor.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Prevent duplicate slot definitions
-- ------------------------------------------------------------
-- Your existing project already has a unique slot constraint from
-- earlier setup. This index is safe to run because IF NOT EXISTS is used.
CREATE UNIQUE INDEX IF NOT EXISTS slots_unique_time_idx
ON public.slots (date, start_time, end_time, court_number);

-- ------------------------------------------------------------
-- 2. Automatically create default slots for ANY future date
-- ------------------------------------------------------------
-- The booking page calls this function whenever a user selects a date.
-- It creates these default slots only if they do not already exist:
--   Court 1: 10:00-11:00
--   Court 1: 11:00-12:00
--   Court 1: 12:00-13:00
--   Court 1: 13:00-14:00
--
-- You can change these four values later if your court schedule differs.

CREATE OR REPLACE FUNCTION public.ensure_slots_for_date(p_date DATE)
RETURNS SETOF public.slots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in.';
  END IF;

  IF p_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Past dates cannot be booked.';
  END IF;

  INSERT INTO public.slots
    (date, start_time, end_time, court_number, is_available)
  VALUES
    (p_date, '10:00', '11:00', 1, true),
    (p_date, '11:00', '12:00', 1, true),
    (p_date, '12:00', '13:00', 1, true),
    (p_date, '13:00', '14:00', 1, true)
  ON CONFLICT (date, start_time, end_time, court_number)
  DO NOTHING;

  RETURN QUERY
  SELECT s.*
  FROM public.slots AS s
  WHERE s.date = p_date
  ORDER BY s.start_time, s.court_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_slots_for_date(DATE)
TO authenticated;

-- ------------------------------------------------------------
-- 3. Atomically create a booking request
-- ------------------------------------------------------------
-- This solves the important race condition where two users could
-- select the same available slot at nearly the same time.
-- The function:
--   - identifies the logged-in user
--   - locks the slot
--   - checks whether it is still available
--   - checks for an active booking
--   - creates a PENDING booking
--   - immediately makes the slot unavailable

CREATE OR REPLACE FUNCTION public.create_booking_request(p_slot_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_slot public.slots%ROWTYPE;
  v_booking public.bookings%ROWTYPE;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'You must be logged in.';
  END IF;

  SELECT *
  INTO v_slot
  FROM public.slots
  WHERE id = p_slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The selected slot does not exist.';
  END IF;

  IF v_slot.date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Past dates cannot be booked.';
  END IF;

  IF v_slot.is_available IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'This slot is no longer available.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.bookings b
    WHERE b.slot_id = p_slot_id
      AND b.booking_status IN ('pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'This slot already has an active booking request.';
  END IF;

  INSERT INTO public.bookings
    (slot_id, user_id, booking_status)
  VALUES
    (p_slot_id, v_user_id, 'pending')
  RETURNING * INTO v_booking;

  UPDATE public.slots
  SET is_available = false
  WHERE id = p_slot_id;

  RETURN jsonb_build_object(
    'booking_id', v_booking.id,
    'slot_id', v_booking.slot_id,
    'user_id', v_booking.user_id,
    'booking_status', v_booking.booking_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_booking_request(UUID)
TO authenticated;

-- ------------------------------------------------------------
-- 4. Admin confirmation/rejection function
-- ------------------------------------------------------------
-- confirmed -> slot stays unavailable
-- cancelled -> slot becomes available again

CREATE OR REPLACE FUNCTION public.admin_update_booking_status(
  p_booking_id UUID,
  p_status public.booking_status
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booking public.bookings%ROWTYPE;
  v_slot public.slots%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be logged in.';
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only administrators can update booking requests.';
  END IF;

  IF p_status NOT IN ('confirmed', 'cancelled') THEN
    RAISE EXCEPTION 'Admin can only confirm or cancel a booking request.';
  END IF;

  SELECT *
  INTO v_booking
  FROM public.bookings
  WHERE id = p_booking_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Booking request not found.';
  END IF;

  SELECT *
  INTO v_slot
  FROM public.slots
  WHERE id = v_booking.slot_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The booking slot no longer exists.';
  END IF;

  UPDATE public.bookings
  SET booking_status = p_status
  WHERE id = p_booking_id;

  UPDATE public.slots
  SET is_available = (p_status = 'cancelled')
  WHERE id = v_booking.slot_id;

  RETURN jsonb_build_object(
    'booking_id', p_booking_id,
    'booking_status', p_status,
    'slot_id', v_booking.slot_id,
    'slot_is_available', (p_status = 'cancelled')
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_booking_status(UUID, public.booking_status)
TO authenticated;

-- ------------------------------------------------------------
-- 5. Useful permissions for the RPC functions
-- ------------------------------------------------------------
-- These functions use auth.uid() and public.has_role() to enforce
-- access. They do NOT expose your Supabase service-role key.

-- ============================================================
-- DONE
-- ============================================================
