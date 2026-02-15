export type AppPage = "profiles" | "path" | "settings";
export type ThemeMode = "system" | "light" | "dark";
export type AccentTheme = "violet" | "teal" | "amber";

export interface Profile {
  id: string;
  name: string;
  description: string;
  tags: string[];
  opencodeConfig: string;
  ohmyocEnabled: boolean;
  ohmyocConfig: string;
  targetPath: string;
  statsEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  lastActivatedAt?: string | null;
  active: boolean;
}

export interface CreateProfileInput {
  name: string;
  description?: string;
  tags?: string[];
  opencodeConfig: string;
  ohmyocEnabled?: boolean;
  ohmyocConfig?: string;
  targetPath?: string;
  statsEnabled?: boolean;
}

export interface UpdateProfileInput {
  name?: string;
  description?: string;
  tags?: string[];
  opencodeConfig?: string;
  ohmyocEnabled?: boolean;
  ohmyocConfig?: string;
  targetPath?: string;
  statsEnabled?: boolean;
}

export interface ActivationResult {
  profileId: string;
  targetPath: string;
  writtenFiles: string[];
  activatedAt: string;
}
