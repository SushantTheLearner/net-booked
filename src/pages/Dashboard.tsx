import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Trophy, Star, User, LogOut, Calendar as CalendarIcon, Settings } from "lucide-react";
import { toast } from "sonner";
import type { User as SupabaseUser } from "@supabase/supabase-js";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);

  useEffect(() => {
    checkUser();
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        navigate("/auth");
      }
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    
    // Fetch profile
    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();
    
    setProfile(profileData);
    
    // Fetch roles
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id);
    
    setRoles(rolesData?.map((r) => r.role) || []);
    
    // Fetch recent bookings
    const { data: bookingsData } = await supabase
      .from("bookings")
      .select(`
        *,
        slots (
          date,
          start_time,
          end_time,
          court_number
        )
      `)
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(5);
    
    setBookings(bookingsData || []);
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error("Error signing out");
    } else {
      toast.success("Signed out successfully");
      navigate("/");
    }
  };

  const quickActions = [
    {
      title: "Book a Slot",
      description: "Reserve a tennis court",
      icon: Calendar,
      href: "/bookings",
      color: "from-primary to-primary/80"
    },
    {
      title: "View Rankings",
      description: "Check leaderboard",
      icon: Trophy,
      href: "/rankings",
      color: "from-secondary to-accent"
    },
    {
      title: "My Profile",
      description: "Update your info",
      icon: User,
      href: "/profile",
      color: "from-accent to-secondary"
    },
    {
      title: "Give Feedback",
      description: "Share your thoughts",
      icon: Star,
      href: "/feedback",
      color: "from-primary/80 to-primary/60"
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primary">SportSynk Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Welcome back, {profile?.full_name || "User"}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Admin Section */}
        {roles.includes('admin') && (
          <Card className="mb-8 border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Admin Controls
              </CardTitle>
              <CardDescription>Manage the SportSynk system</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={() => navigate("/admin/slots")}
                className="w-full sm:w-auto"
              >
                Manage Slots
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {quickActions.map((action) => (
            <Card 
              key={action.title}
              className="cursor-pointer hover:shadow-court transition-all"
              onClick={() => navigate(action.href)}
            >
              <CardContent className="pt-6">
                <div className={`rounded-full w-12 h-12 bg-gradient-to-r ${action.color} flex items-center justify-center mb-4`}>
                  <action.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="font-semibold mb-1">{action.title}</h3>
                <p className="text-sm text-muted-foreground">{action.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Bookings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Recent Bookings
            </CardTitle>
            <CardDescription>Your latest court reservations</CardDescription>
          </CardHeader>
          <CardContent>
            {bookings.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No bookings yet. Book your first slot!
              </p>
            ) : (
              <div className="space-y-4">
                {bookings.map((booking) => (
                  <div 
                    key={booking.id}
                    className="flex items-center justify-between p-4 border border-border rounded-lg"
                  >
                    <div>
                      <p className="font-medium">
                        Court {booking.slots.court_number}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(booking.slots.date).toLocaleDateString()} • {booking.slots.start_time} - {booking.slots.end_time}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      booking.booking_status === 'confirmed' 
                        ? 'bg-primary/10 text-primary' 
                        : booking.booking_status === 'pending'
                        ? 'bg-secondary/20 text-secondary-foreground'
                        : 'bg-destructive/10 text-destructive'
                    }`}>
                      {booking.booking_status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
