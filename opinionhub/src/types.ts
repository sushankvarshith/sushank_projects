export interface User {
  id: number;
  username: string;
  avatar?: string;
  bio?: string;
}

export interface Choice {
  id: number;
  text: string;
  vote_count: number;
}

export interface Poll {
  id: number;
  title: string;
  description: string;
  creator_id: number;
  creator_name: string;
  creator_avatar: string;
  created_at: string;
  choices: Choice[];
  hasVoted: boolean;
  totalVotes: number;
  isSaved?: boolean;
}

export interface Comment {
  id: number;
  poll_id: number;
  user_id: number;
  username: string;
  avatar: string;
  text: string;
  created_at: string;
}

export interface Community {
  id: number;
  name: string;
  description: string;
  image: string;
}
