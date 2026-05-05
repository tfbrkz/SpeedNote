import { Profanity } from "@2toad/profanity";
import { randomUUID } from "node:crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

type LeaderboardEntry = {
  user_id: string;
  username: string;
  average_time_per_note_ms: number;
  accuracy: number;
  updated_at: string;
};

const profanity = new Profanity();
const MAX_ENTRIES = 100;
const NAME_MAX_LENGTH = 24;
const TABLE_NAME = "speednote_leaderboard";

function getSupabaseServerClient() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    return null;
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false
    }
  });
}

function validateUsername(username: string) {
  const trimmed = username.trim();
  if (!trimmed) {
    return "Please enter a name.";
  }

  if (trimmed.length > NAME_MAX_LENGTH) {
    return `Name must be ${NAME_MAX_LENGTH} characters or less.`;
  }

  const hasUrlPattern =
    /(https?:\/\/|www\.|[a-z0-9-]+\.(com|net|org|io|co|gg|app|dev|me|tv|xyz|uk|us|ca|de|fr|jp|au|nl|ru|ch|it|es|in)\b)/i.test(
      trimmed
    );
  if (hasUrlPattern) {
    return "Names cannot contain links or website addresses.";
  }

  if (profanity.exists(trimmed)) {
    return "Please choose a cleaner name.";
  }

  return null;
}

function parseEntryPayload(body: unknown) {
  if (typeof body !== "object" || body === null) {
    return null;
  }
  const payload = body as Record<string, unknown>;
  const username = typeof payload.username === "string" ? payload.username : "";
  const averageTimePerNoteMs = typeof payload.averageTimePerNoteMs === "number" ? payload.averageTimePerNoteMs : NaN;
  const accuracy = typeof payload.accuracy === "number" ? payload.accuracy : NaN;

  const nameError = validateUsername(username);
  if (nameError) {
    return { error: nameError } as const;
  }

  if (!Number.isFinite(averageTimePerNoteMs) || averageTimePerNoteMs <= 0) {
    return { error: "Average time is invalid." } as const;
  }
  if (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 1) {
    return { error: "Accuracy must be between 0 and 1." } as const;
  }

  return {
    username: username.trim(),
    averageTimePerNoteMs,
    accuracy
  } as const;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    res.status(500).json({ error: "Supabase is not configured." });
    return;
  }

  if (req.method === "GET") {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("user_id, username, average_time_per_note_ms, accuracy, updated_at")
      .order("accuracy", { ascending: false })
      .order("average_time_per_note_ms", { ascending: true })
      .limit(MAX_ENTRIES);

    if (error) {
      res.status(500).json({ error: "Failed to load leaderboard." });
      return;
    }
    const entries = (data ?? []) as LeaderboardEntry[];
    res.status(200).json({ entries });
    return;
  }

  if (req.method === "POST") {
    const payload = parseEntryPayload(req.body);
    if (!payload || "error" in payload) {
      res.status(400).json({ error: payload?.error ?? "Invalid leaderboard payload." });
      return;
    }

    const { error: insertError } = await supabase.from(TABLE_NAME).insert({
      user_id: randomUUID(),
      username: payload.username,
      average_time_per_note_ms: payload.averageTimePerNoteMs,
      accuracy: payload.accuracy
    });
    if (insertError) {
      res.status(500).json({ error: "Failed to save leaderboard entry.", details: insertError.message });
      return;
    }

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("user_id, username, average_time_per_note_ms, accuracy, updated_at")
      .order("accuracy", { ascending: false })
      .order("average_time_per_note_ms", { ascending: true })
      .limit(MAX_ENTRIES);
    if (error) {
      res.status(500).json({ error: "Failed to refresh leaderboard." });
      return;
    }

    res.status(201).json({ entries: data ?? [] });
    return;
  }

  res.status(405).json({ error: "Method not allowed" });
}
