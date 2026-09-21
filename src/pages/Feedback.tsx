import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Star, Send } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const feedbackSchema = z.object({
  rating: z.number().min(1, "Please select a rating").max(5),
  comments: z.string().min(10, "Please provide at least 10 characters of feedback").max(1000),
});

const Feedback = () => {
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState("");
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    setUser(session.user);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      feedbackSchema.parse({ rating, comments });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    if (!user) return;

    setLoading(true);

    const { error } = await supabase
      .from("feedback")
      .insert({
        user_id: user.id,
        rating,
        comments,
      });

    if (error) {
      toast.error("Failed to submit feedback");
      console.error(error);
    } else {
      toast.success("Thank you for your feedback!");
      setRating(0);
      setComments("");
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Feedback</h1>
            <p className="text-sm text-muted-foreground">Share your experience with us</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle>How was your experience?</CardTitle>
              <CardDescription>
                Your feedback helps us improve SportSynk
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Rating</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRating(value)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`h-10 w-10 ${
                            value <= rating
                              ? "fill-secondary text-secondary"
                              : "text-muted stroke-muted-foreground"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="comments" className="text-sm font-medium">
                    Comments
                  </label>
                  <Textarea
                    id="comments"
                    placeholder="Tell us about your experience..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={6}
                    required
                  />
                </div>

                <Button type="submit" disabled={loading} className="w-full">
                  <Send className="h-4 w-4 mr-2" />
                  {loading ? "Submitting..." : "Submit Feedback"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Feedback;
