import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

import i18n from "@/i18n";
import { ActivationResult, CreateProfileInput, Profile, UpdateProfileInput } from "@/types";

interface ProfileStore {
  profiles: Profile[];
  activeProfileId: string | null;
  selectedProfileId: string | null;
  loading: boolean;
  submitting: boolean;
  activatingProfileId: string | null;
  errorMessage: string | null;

  fetchProfiles: () => Promise<void>;
  createProfile: (input: CreateProfileInput) => Promise<Profile | null>;
  updateProfile: (id: string, input: UpdateProfileInput) => Promise<Profile | null>;
  deleteProfile: (id: string) => Promise<void>;
  activateProfile: (id: string, targetPath?: string) => Promise<void>;
  selectProfile: (id: string | null) => void;
  clearError: () => void;
}

export const useProfileStore = create<ProfileStore>((set, get) => ({
  profiles: [],
  activeProfileId: null,
  selectedProfileId: null,
  loading: false,
  submitting: false,
  activatingProfileId: null,
  errorMessage: null,

  fetchProfiles: async () => {
    set({ loading: true, errorMessage: null });
    try {
      const profiles = await invoke<Profile[]>("list_profiles");
      const activeProfile = profiles.find((profile) => profile.active);
      const currentSelected = get().selectedProfileId;
      const fallbackSelected =
        profiles.find((profile) => profile.id === currentSelected)?.id ??
        activeProfile?.id ??
        profiles[0]?.id ??
        null;

      set({
        profiles,
        activeProfileId: activeProfile?.id || null,
        selectedProfileId: fallbackSelected,
      });
    } catch (error) {
      set({ errorMessage: extractErrorMessage(error) });
    } finally {
      set({ loading: false });
    }
  },

  createProfile: async (input) => {
    set({ submitting: true, errorMessage: null });
    try {
      const created = await invoke<Profile>("create_profile", { input });
      set((state) => ({
        profiles: [created, ...state.profiles],
        selectedProfileId: created.id,
      }));
      return created;
    } catch (error) {
      set({ errorMessage: extractErrorMessage(error) });
      return null;
    } finally {
      set({ submitting: false });
    }
  },

  updateProfile: async (id, input) => {
    set({ submitting: true, errorMessage: null });
    try {
      const updated = await invoke<Profile>("update_profile", { id, input });
      set((state) => ({
        profiles: state.profiles.map((profile) => (profile.id === id ? updated : profile)),
      }));
      return updated;
    } catch (error) {
      set({ errorMessage: extractErrorMessage(error) });
      return null;
    } finally {
      set({ submitting: false });
    }
  },

  deleteProfile: async (id) => {
    set({ submitting: true, errorMessage: null });
    try {
      await invoke("delete_profile", { id });
      set((state) => {
        const nextProfiles = state.profiles.filter((profile) => profile.id !== id);
        const nextSelected =
          state.selectedProfileId === id
            ? nextProfiles.find((profile) => profile.id === state.activeProfileId)?.id ||
              nextProfiles[0]?.id ||
              null
            : state.selectedProfileId;

        return {
          profiles: nextProfiles,
          selectedProfileId: nextSelected,
          activeProfileId: state.activeProfileId === id ? null : state.activeProfileId,
        };
      });
    } catch (error) {
      set({ errorMessage: extractErrorMessage(error) });
    } finally {
      set({ submitting: false });
    }
  },

  activateProfile: async (id, targetPath) => {
    const previousState = {
      profiles: get().profiles,
      activeProfileId: get().activeProfileId,
      selectedProfileId: get().selectedProfileId,
    };

    set({ activatingProfileId: id, errorMessage: null });
    set((state) => ({
      profiles: state.profiles.map((profile) => {
        if (profile.id === id) {
          return profile.active ? profile : { ...profile, active: true };
        }
        if (!profile.active) {
          return profile;
        }
        return { ...profile, active: false };
      }),
      activeProfileId: id,
      selectedProfileId: id,
    }));

    try {
      await invoke<ActivationResult>("activate_profile", { id, targetPath });
      const profiles = await invoke<Profile[]>("list_profiles");
      const activeProfile = profiles.find((profile) => profile.active);
      set({
        profiles,
        activeProfileId: activeProfile?.id || id,
        selectedProfileId: id,
      });
    } catch (error) {
      set({
        profiles: previousState.profiles,
        activeProfileId: previousState.activeProfileId,
        selectedProfileId: previousState.selectedProfileId,
        errorMessage: extractErrorMessage(error),
      });
    } finally {
      set({ activatingProfileId: null });
    }
  },

  selectProfile: (id) => set({ selectedProfileId: id }),

  clearError: () => set({ errorMessage: null }),
}));

function extractErrorMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error && typeof error === "object" && "message" in error) {
    return String(error.message);
  }
  return i18n.t("profiles.errorUnknown");
}
