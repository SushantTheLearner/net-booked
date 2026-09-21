import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ArrowLeft,
  Check,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from "lucide-react";

const AdminSlots = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [slots, setSlots] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  const [formData, setFormData] = useState({
    date: "",
    start_time: "",
    end_time: "",
    court_number: 1,
  });

  const pendingBookings = useMemo(
    () => bookings.filter((booking) => booking.booking_status === "pending"),
    [bookings]
  );

  useEffect(() => {
    const initialize = async () => {
      const allowed = await checkAdminAccess();
      if (!allowed) return;

      await Promise.all([fetchSlots(), fetchBookings()]);
    };

    initialize();
  }, []);

  const checkAdminAccess = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      navigate("/auth");
      return false;
    }

    const { data, error } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    if (error || !data) {
      toast({
        title: "Access Denied",
        description: "You don't have admin privileges.",
        variant: "destructive",
      });
      navigate("/dashboard");
      return false;
    }

    return true;
  };

  const fetchSlots = async () => {
    const { data, error } = await supabase
      .from("slots")
      .select("*")
      .order("date", { ascending: true })
      .order("start_time", { ascending: true });

    if (error) {
      toast({
        title: "Error",
        description: `Failed to fetch slots: ${error.message}`,
        variant: "destructive",
      });
      return;
    }

    setSlots(data || []);
  };

  const fetchBookings = async () => {
    setLoadingBookings(true);

    try {
      // Fetch bookings first. We fetch slots/profiles separately so this
      // page does not depend on generated Supabase relationship types.
      const { data: bookingData, error: bookingError } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false });

      if (bookingError) {
        throw bookingError;
      }

      const bookingRows = bookingData || [];

      const slotIds = [...new Set(bookingRows.map((b) => b.slot_id))];
      const userIds = [...new Set(bookingRows.map((b) => b.user_id))];

      let slotRows: any[] = [];
      let profileRows: any[] = [];

      if (slotIds.length > 0) {
        const { data, error } = await supabase
          .from("slots")
          .select("id, date, start_time, end_time, court_number, is_available")
          .in("id", slotIds);

        if (error) throw error;
        slotRows = data || [];
      }

      if (userIds.length > 0) {
        const { data, error } = await supabase
          .from("profiles")
          .select("id, full_name, email, mobile, roll_no")
          .in("id", userIds);

        if (error) throw error;
        profileRows = data || [];
      }

      const slotMap = new Map(slotRows.map((slot) => [slot.id, slot]));
      const profileMap = new Map(profileRows.map((profile) => [profile.id, profile]));

      const combined = bookingRows.map((booking) => ({
        ...booking,
        slot: slotMap.get(booking.slot_id) || null,
        profile: profileMap.get(booking.user_id) || null,
      }));

      setBookings(combined);
    } catch (error: any) {
      console.error("Fetch bookings error:", error);
      toast({
        title: "Error",
        description: `Failed to fetch booking requests: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setLoadingBookings(false);
    }
  };

  const refreshAll = async () => {
    await Promise.all([fetchSlots(), fetchBookings()]);
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.from("slots").insert({
      date: formData.date,
      start_time: formData.start_time,
      end_time: formData.end_time,
      court_number: formData.court_number,
      is_available: true,
    });

    if (error) {
      toast({
        title: "Error",
        description: `Failed to add slot: ${error.message}`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Slot added successfully!",
      });
      setFormData({ date: "", start_time: "", end_time: "", court_number: 1 });
      await fetchSlots();
    }

    setLoading(false);
  };

  const handleDeleteSlot = async (slotId: string) => {
    const hasBooking = bookings.some((booking) => booking.slot_id === slotId);

    if (hasBooking) {
      toast({
        title: "Cannot delete slot",
        description: "This slot has a booking/request. Cancel the request first.",
        variant: "destructive",
      });
      return;
    }

    const { error } = await supabase
      .from("slots")
      .delete()
      .eq("id", slotId);

    if (error) {
      toast({
        title: "Error",
        description: `Failed to delete slot: ${error.message}`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Slot deleted successfully!",
      });
      await fetchSlots();
    }
  };

  const updateBookingStatus = async (
    booking: any,
    newStatus: "confirmed" | "cancelled"
  ) => {
    const slot = booking.slot;

    if (!slot) {
      toast({
        title: "Error",
        description: "The slot connected to this request could not be found.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.rpc(
        "admin_update_booking_status",
        {
          p_booking_id: booking.id,
          p_status: newStatus,
        }
      );

      if (error) throw error;

      toast({
        title: newStatus === "confirmed" ? "Booking Confirmed" : "Request Rejected",
        description:
          newStatus === "confirmed"
            ? "The user booking has been confirmed."
            : "The request was cancelled and the slot is available again.",
      });

      await refreshAll();
    } catch (error: any) {
      console.error("Update booking status error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update booking.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex items-center justify-between gap-4">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          <Button
            variant="outline"
            onClick={refreshAll}
            disabled={loadingBookings}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loadingBookings ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>

        <div>
          <h1 className="text-4xl font-bold text-primary">
            Admin Control Panel
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage slots and booking requests.
          </p>
        </div>

        {/* ======================================================
            BOOKING REQUESTS
        ====================================================== */}
        <Card>
          <CardHeader>
            <CardTitle>
              Booking Requests ({pendingBookings.length} pending / {bookings.length} total)
            </CardTitle>
          </CardHeader>

          <CardContent>
            {loadingBookings ? (
              <div className="py-10 text-center">
                <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3" />
                <p className="text-muted-foreground">Loading requests...</p>
              </div>
            ) : bookings.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                No booking requests yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Court</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {bookings.map((booking) => {
                      const slot = booking.slot;
                      const profile = booking.profile;
                      const pending = booking.booking_status === "pending";

                      return (
                        <TableRow key={booking.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">
                                {profile?.full_name || "Unknown user"}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {profile?.email || booking.user_id}
                              </p>
                            </div>
                          </TableCell>

                          <TableCell>{slot?.date || "-"}</TableCell>
                          <TableCell>
                            {slot
                              ? `${slot.start_time} - ${slot.end_time}`
                              : "-"}
                          </TableCell>
                          <TableCell>
                            {slot ? `Court ${slot.court_number}` : "-"}
                          </TableCell>

                          <TableCell>
                            <span
                              className={
                                booking.booking_status === "confirmed"
                                  ? "text-green-600 font-medium"
                                  : booking.booking_status === "cancelled"
                                    ? "text-red-500 font-medium"
                                    : "text-yellow-600 font-medium"
                              }
                            >
                              {booking.booking_status}
                            </span>
                          </TableCell>

                          <TableCell>
                            {pending ? (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    updateBookingStatus(booking, "confirmed")
                                  }
                                >
                                  <Check className="mr-1 h-4 w-4" />
                                  Confirm
                                </Button>

                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() =>
                                    updateBookingStatus(booking, "cancelled")
                                  }
                                >
                                  <X className="mr-1 h-4 w-4" />
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                No action
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ======================================================
            SLOT MANAGEMENT
        ====================================================== */}
        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                Add New Slot
              </CardTitle>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleAddSlot} className="space-y-4">
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="start_time">Start Time</Label>
                  <Input
                    id="start_time"
                    type="time"
                    value={formData.start_time}
                    onChange={(e) =>
                      setFormData({ ...formData, start_time: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="end_time">End Time</Label>
                  <Input
                    id="end_time"
                    type="time"
                    value={formData.end_time}
                    onChange={(e) =>
                      setFormData({ ...formData, end_time: e.target.value })
                    }
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="court_number">Court Number</Label>
                  <Input
                    id="court_number"
                    type="number"
                    min="1"
                    value={formData.court_number}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        court_number: Number(e.target.value),
                      })
                    }
                    required
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? "Adding..." : "Add Slot"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing Slots ({slots.length})</CardTitle>
            </CardHeader>

            <CardContent>
              <div className="max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Court</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Action</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {slots.map((slot) => (
                      <TableRow key={slot.id}>
                        <TableCell>{slot.date}</TableCell>
                        <TableCell>
                          {slot.start_time} - {slot.end_time}
                        </TableCell>
                        <TableCell>Court {slot.court_number}</TableCell>
                        <TableCell>
                          <span
                            className={
                              slot.is_available
                                ? "text-green-600"
                                : "text-red-500"
                            }
                          >
                            {slot.is_available ? "Available" : "Booked"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteSlot(slot.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AdminSlots;
