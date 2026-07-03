export type AuthContextProps = {
  isLoading: boolean;
  isAuthenticated: boolean;
  token: string | null;
  setToken: (token: string | null) => void;
};

export type ProfileModel = {
  userId: string;
  name: string;
  location: string;
  age: number | null;
  lastSeen: string;
  lastSeenDays?: number | null;
  readAt?: Date | null;
  contact?: boolean;
  videoUrl?: string;
  avatar?: string;
  statusLine?: string;
  sumary: string;
  lookingFor?: string;
  intro: string;
  lifeStory: string;
  freeTime: string;
  other: string;
  accomplishments: string;
  education: string[];
  employment: string[];
  startup?: {
    name?: string;
    description?: string;
    progress?: string;
    funding?: string;
  };
  cofounderPreferences: {
    requirements: string[];
    idealPersonality: string;
    equity: string;
  };
  interests: {
    shared: string[];
    personal: string[];
  };
  linkedIn?: string;
  updatedAt: Date;
};

export type FilterModel = {
  name: string;
  age: number;
  location: string;
  funding: string;
  lastSeen: string;
}
