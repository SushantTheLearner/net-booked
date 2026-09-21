import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { ArrowLeft, CheckCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const Bookings = () => {
  const navigate = useNavigate();

  const [date, setDate] = useState<Date | undefined>(new Date());
  const [slots, setSlots] = useState<any[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<any>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [user, setUser] = useState<any>(null);

  const checkUser = async () => {
    const {
      data: { user: currentUser },
      error,
    } = await supabase.auth.getUser();

    if (error || !currentUser) {
      navigate("/auth");
      return;
    }

    setUser(currentUser);
  };

  const fetchSlots = async () => {
    if (!date) {
      setSlots([]);
      return;
    }

    setLoadingSlots(true);
    setSelectedSlot(null);

    const formattedDate = format(date, "yyyy-MM-dd");

    try {
      // Automatically create the standard slots for a future date if
      // the administrator has not created them yet.
      const { error: ensureError } = await supabase.rpc(
        "ensure_slots_for_date",
        { p_date: formattedDate }
      );

      if (ensureError) {
        console.error("Ensure slots error:", ensureError);
        toast.error(`Unable to prepare slots: ${ensureError.message}`);
        setSlots([]);
        return;
      }

      const { data, error } = await supabase
        .from("slots")
        .select("*")
        .eq("date", formattedDate)
        .order("start_time", { ascending: true })
        .order("court_number", { ascending: true });

      if (error) {
        console.error("Fetch slots error:", error);
        toast.error(`Unable to load slots: ${error.message}`);
        setSlots([]);
        return;
      }

      setSlots(data || []);
    } catch (error: any) {
      console.error("Unexpected slot error:", error);
      toast.error(error?.message || "Unable to load slots.");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  };

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    if (date) fetchSlots();
  }, [date]);

  const selectSlot = (slot: any) => {
    if (!slot || slot.is_available !== true) {
      toast.error("This slot is not available.");
      return;
    }

    setSelectedSlot(slot);
  };

  const sendBookingRequest = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!selectedSlot) {
      toast.error("Please select a slot first.");
      return;
    }

    setSendingRequest(true);

    try {
      // The database function performs the availability check, inserts
      // the pending booking and locks the slot atomically.
      const { data, error } = await supabase.rpc(
        "create_booking_request",
        { p_slot_id: selectedSlot.id }
      );

      if (error) {
        console.error("Booking request error:", error);
        toast.error(error.message);
        await fetchSlots();
        return;
      }

      console.log("Booking request created:", data);

      toast.success("Booking request sent successfully!");
      setSelectedSlot(null);
      await fetchSlots();
    } catch (error: any) {
      console.error("Unexpected booking error:", error);
      toast.error(error?.message || "Unable to send booking request.");
    } finally {
      setSendingRequest(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Book a Slot</h1>
            <p className="text-sm text-muted-foreground">
              Reserve your tennis court
            </p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>Select Date</CardTitle>
              <CardDescription>
                Choose any future date to view available slots
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center">
              <Calendar
                mode="single"
                selected={date}
                onSelect={(selectedDate) => {
                  if (selectedDate) setDate(selectedDate);
                }}
                disabled={(calendarDate) => {
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  return calendarDate < today;
                }}
                className="rounded-md border"
              />
              {date && (
                <p className="mt-3 text-sm text-muted-foreground">
                  Selected date: {format(date, "dd MMMM yyyy")}
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle>Available Slots</CardTitle>
                  <CardDescription>
                    {date
                      ? format(date, "EEEE, MMMM d, yyyy")
                      : "Select a date"}
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchSlots}
                  disabled={loadingSlots}
                >
                  <RefreshCw
                    className={`h-4 w-4 ${loadingSlots ? "animate-spin" : ""}`}
                  />
                </Button>
              </div>
            </CardHeader>

            <CardContent>
              {loadingSlots && (
                <div className="text-center py-10">
                  <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3" />
                  <p className="text-muted-foreground">Loading slots...</p>
                </div>
              )}

              {!loadingSlots && slots.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-muted-foreground">
                    No slots are available for this date.
                  </p>
                </div>
              )}

              {!loadingSlots && slots.length > 0 && (
                <div className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-4">
                    {slots.map((slot) => {
                      const isSelected = selectedSlot?.id === slot.id;
                      const isAvailable = slot.is_available === true;

                      return (
                        <div
                          key={slot.id}
                          onClick={() => {
                            if (isAvailable && !sendingRequest) {
                              selectSlot(slot);
                            }
                          }}
                          className={`p-5 border rounded-xl transition-all duration-200 ${
                            isSelected
                              ? "border-primary bg-primary/10 ring-2 ring-primary"
                              : isAvailable
                                ? "border-border hover:border-primary hover:bg-primary/5 cursor-pointer"
                                : "border-border opacity-50 cursor-not-allowed"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-lg">
                                Court {slot.court_number}
                              </p>
                              <p className="text-sm text-muted-foreground mt-1">
                                {slot.start_time} - {slot.end_time}
                              </p>
                            </div>
                            {isSelected && (
                              <CheckCircle className="h-6 w-6 text-primary" />
                            )}
                          </div>

                          <div className="mt-3">
                            <span
                              className={`text-sm font-medium ${
                                isAvailable ? "text-green-600" : "text-red-500"
                              }`}
                            >
                              {isAvailable
                                ? isSelected
                                  ? "✓ Selected"
                                  : "✓ Available"
                                : "✕ Booked"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedSlot && (
                    <div className="border-t pt-6">
                      <div className="rounded-xl border bg-card p-5">
                        <h3 className="font-semibold text-lg">Selected Slot</h3>

                        <div className="mt-2 space-y-1">
                          <p className="text-sm">
                            <strong>Court:</strong> {selectedSlot.court_number}
                          </p>
                          <p className="text-sm">
                            <strong>Time:</strong> {selectedSlot.start_time} - {selectedSlot.end_time}
                          </p>
                          <p className="text-sm">
                            <strong>Date:</strong>{" "}
                            {date && format(date, "EEEE, MMMM d, yyyy")}
                          </p>
                        </div>

                        <Button
                          onClick={sendBookingRequest}
                          disabled={sendingRequest}
                          className="w-full mt-5"
                          size="lg"
                        >
                          {sendingRequest
                            ? "Sending Request..."
                            : "Send Booking Request"}
                        </Button>

                        <p className="text-xs text-muted-foreground text-center mt-3">
                          Your request will remain pending until the administrator confirms it.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Bookings;
