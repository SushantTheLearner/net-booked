import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Trophy, Medal } from "lucide-react";

interface PlayerRanking {
  id: string;
  full_name: string;
  profile_picture_url: string | null;
  wins: number;
  losses: number;
  total_matches: number;
  win_rate: number;
}

const Rankings = () => {
  const navigate = useNavigate();
  const [rankings, setRankings] = useState<PlayerRanking[]>([]);

  useEffect(() => {
    checkUser();
    fetchRankings();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const fetchRankings = async () => {
    // Fetch all players with their match records
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, profile_picture_url");
    
    if (!profiles) return;

    const rankingsData: PlayerRanking[] = await Promise.all(
      profiles.map(async (profile) => {
        const { data: matches } = await supabase
          .from("match_records")
          .select("result")
          .eq("player_id", profile.id);
        
        const wins = matches?.filter((m) => m.result === "win").length || 0;
        const losses = matches?.filter((m) => m.result === "loss").length || 0;
        const total = matches?.length || 0;
        const winRate = total > 0 ? (wins / total) * 100 : 0;

        return {
          id: profile.id,
          full_name: profile.full_name,
          profile_picture_url: profile.profile_picture_url,
          wins,
          losses,
          total_matches: total,
          win_rate: winRate,
        };
      })
    );

    // Sort by wins and win rate
    const sorted = rankingsData.sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.win_rate - a.win_rate;
    });

    setRankings(sorted);
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Trophy className="h-6 w-6 text-yellow-500" />;
    if (index === 1) return <Medal className="h-6 w-6 text-gray-400" />;
    if (index === 2) return <Medal className="h-6 w-6 text-amber-700" />;
    return <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>;
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-primary">Player Rankings</h1>
            <p className="text-sm text-muted-foreground">Leaderboard and statistics</p>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Leaderboard</CardTitle>
            <CardDescription>Top players ranked by performance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {rankings.map((player, index) => (
                <div
                  key={player.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border ${
                    index < 3 ? 'border-primary/30 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center justify-center w-12">
                    {getRankIcon(index)}
                  </div>
                  
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={player.profile_picture_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {player.full_name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <p className="font-semibold">{player.full_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {player.total_matches} matches played
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-lg font-bold text-primary">{player.wins}W - {player.losses}L</p>
                    <p className="text-sm text-muted-foreground">
                      {player.win_rate.toFixed(1)}% win rate
                    </p>
                  </div>
                </div>
              ))}
              
              {rankings.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No rankings data available yet
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Rankings;
