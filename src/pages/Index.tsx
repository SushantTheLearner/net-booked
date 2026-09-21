import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calendar, Users, Trophy, Star, Clock, Award } from "lucide-react";
import Navbar from "@/components/Navbar";
import heroImage from "@/assets/hero-tennis-court.jpg";

const Index = () => {
  const features = [
    {
      icon: Calendar,
      title: "Easy Booking",
      description: "Book lawn tennis court slots instantly with our intuitive calendar interface"
    },
    {
      icon: Users,
      title: "Multi-Role Access",
      description: "Separate dashboards for players, coaches, and administrators"
    },
    {
      icon: Trophy,
      title: "Player Rankings",
      description: "Track your performance and climb the leaderboard"
    },
    {
      icon: Clock,
      title: "Flexible Slots",
      description: "Choose from available time slots that fit your schedule"
    },
    {
      icon: Award,
      title: "Subscriptions",
      description: "Daily, weekly, monthly, or yearly plans for regular players"
    },
    {
      icon: Star,
      title: "Feedback System",
      description: "Rate and review court conditions and services"
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-secondary/5 to-background z-0" />
        <div className="container mx-auto px-4 py-20 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h1 className="text-5xl lg:text-6xl font-bold leading-tight">
                Manage Your Tennis Court{" "}
                <span className="text-primary">Bookings</span> Effortlessly
              </h1>
              <p className="text-xl text-muted-foreground">
                SportSynk streamlines lawn tennis court management with easy booking, 
                subscriptions, player rankings, and more.
              </p>
              <div className="flex gap-4 pt-4">
                <Link to="/auth?mode=register">
                  <Button size="lg" className="bg-gradient-to-r from-primary to-primary/90">
                    Get Started Free
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="lg" variant="outline">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute -inset-4 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-3xl blur-2xl" />
              <img 
                src={heroImage} 
                alt="Tennis court aerial view" 
                className="relative rounded-2xl shadow-elevated w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything You Need</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A comprehensive platform for managing lawn tennis activities
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card key={index} className="border-border bg-card hover:shadow-court transition-all">
                <CardContent className="pt-6">
                  <div className="rounded-full w-12 h-12 bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <Card className="bg-gradient-to-br from-primary to-primary/80 border-0 text-primary-foreground">
            <CardContent className="py-16 text-center">
              <h2 className="text-4xl font-bold mb-4">Ready to Get Started?</h2>
              <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
                Join SportSynk today and experience seamless tennis court management
              </p>
              <Link to="/auth?mode=register">
                <Button size="lg" variant="secondary" className="shadow-lg">
                  Create Your Account
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2025 SportSynk. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
