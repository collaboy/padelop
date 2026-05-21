export type Session = {
  id: string;
  user_id: string;
  date: string;
  type: "match" | "training" | "drill";
  duration_minutes: number | null;
  location: string | null;
  notes: string | null;
  created_at: string;
};

export type MatchResult = {
  id: string;
  session_id: string;
  user_id: string;
  partner_name: string | null;
  opponent1_name: string | null;
  opponent2_name: string | null;
  score: string | null;
  result: "win" | "loss" | "unfinished";
  created_at: string;
};

export type FitnessMetric = {
  id: string;
  user_id: string;
  date: string;
  metric_type: "strength" | "endurance" | "recovery" | "speed";
  value: number | null;
  unit: string | null;
  notes: string | null;
  created_at: string;
};

export type WellbeingLog = {
  id: string;
  user_id: string;
  date: string;
  sleep_hours: number | null;
  sleep_quality: number | null;
  hrv: number | null;
  energy_level: number | null;
  nutrition_quality: number | null;
  hydration_liters: number | null;
  notes: string | null;
  created_at: string;
};

export type GameDay = {
  id: string;
  user_id: string;
  date: string;
  notes: string | null;
  created_at: string;
};

export type EloRating = {
  id: string;
  user_id: string;
  rating: number;
  date: string;
  created_at: string;
};

export type Profile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  level: string;
  created_at: string;
};

export type Recommendation = {
  category: "training" | "game" | "nutrition" | "recovery" | "tip";
  title: string;
  subtitle: string;
  detail?: string;
  badge?: string;
};
