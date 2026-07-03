"use client";
import React, { useState } from "react";
import { toast } from "react-toastify";

export default function ProfileScraper() {
  const [ssoKey, setSsoKey] = useState("");
  const [susSession, setSusSession] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [scrapedCount, setScrapedCount] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [markAsRead, setMarkAsRead] = useState(false);
  const [markAllLoading, setMarkAllLoading] = useState(false);
  const [updateLoading, setUpdateLoading] = useState(false);

  const handleUpdateUncontacted = async () => {
    setUpdateLoading(true);
    setError("");
    try {
      const response = await fetch("/api/profiles/refresh-uncontacted", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssoKey, susSession }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Update failed");
      toast.success(
        `Updated ${data.updated} profile(s). Failed: ${data.failed}. Total processed: ${data.total}.`
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      setError(msg);
      toast.error(msg);
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!confirm("Mark all existing profiles as read? (Use this if you've already contacted them.)")) return;
    setMarkAllLoading(true);
    try {
      const response = await fetch("/api/profiles/mark-read", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAll: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed");
      toast.success(data.message || "All profiles marked as read.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to mark all as read");
    } finally {
      setMarkAllLoading(false);
    }
  };

  const handleScrapeOne = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/scrape-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, ssoKey, susSession, markAsRead }),
      });
      const data = await response.json();

      if (!response.ok) toast.error(data.error || "Failed to fetch profile");
      else if (data.skipped) toast.info("Profile already exists in DB, skipped");
      else toast.success("Profile fetched successfully");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleScrape = async () => {
    setLoading(true);
    setScrapedCount(0);
    setError("");
    try {
      const response = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ssoKey, susSession, markAsRead }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to start scrape");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as {
              type?: string;
              scrapedCount?: number;
              message?: string;
              error?: string;
            };
            if (event.type === "progress" && typeof event.scrapedCount === "number") {
              setScrapedCount(event.scrapedCount);
            } else if (event.type === "done") {
              setScrapedCount(event.scrapedCount ?? null);
              toast.success(event.message || "Scrape completed (existing profiles skipped)");
            } else if (event.type === "error" && event.error) {
              throw new Error(event.error);
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer) as { type?: string; scrapedCount?: number; message?: string; error?: string };
          if (event.type === "done") {
            setScrapedCount(event.scrapedCount ?? null);
            toast.success(event.message || "Scrape completed");
          } else if (event.type === "error" && event.error) {
            throw new Error(event.error);
          }
        } catch (parseErr) {
          if (!(parseErr instanceof SyntaxError)) throw parseErr;
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="flex flex-col gap-4 mb-8">
        <input
          type="text"
          value={ssoKey}
          onChange={(e) => setSsoKey(e.target.value)}
          placeholder="Enter SSO Key"
          className="flex-1 p-2 border rounded"
        />
        <input
          type="text"
          value={susSession}
          onChange={(e) => setSusSession(e.target.value)}
          placeholder="Enter SUS Session"
          className="flex-1 p-2 border rounded"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter Startup School profile URL"
          className="flex-1 p-2 border rounded"
        />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={markAsRead}
            onChange={(e) => setMarkAsRead(e.target.checked)}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Mark as read (I&apos;ve already contacted these candidates)
          </span>
        </label>
      </div>
      <div className="flex flex-row justify-center items-center gap-4 mb-8">
        <button
          onClick={handleScrapeOne}
          disabled={loading || url === ""}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {loading ? "Loading..." : "Scrape One"}
        </button>
        <button
          onClick={handleScrape}
          disabled={loading}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          {loading ? "Scraping..." : "Scrape Many"}
        </button>
        {loading && scrapedCount !== null && (
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400" aria-live="polite">
            Profiles saved so far: {scrapedCount}
          </span>
        )}
        <button
          type="button"
          onClick={handleMarkAllAsRead}
          disabled={markAllLoading}
          className="px-4 py-2 bg-gray-600 text-white rounded disabled:opacity-50"
        >
          {markAllLoading ? "..." : "Mark all as read"}
        </button>
        <button
          type="button"
          onClick={handleUpdateUncontacted}
          disabled={updateLoading}
          className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-50"
        >
          {updateLoading ? "Updating..." : "Update uncontacted"}
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
        Use &quot;Mark as read&quot; when scraping URLs you&apos;ve already contacted. Use &quot;Mark all as read&quot; to mark every profile in the DB as read. Use &quot;Update uncontacted&quot; to fetch all profiles, skip contacted ones, and scrape + update each uncontacted profile.
      </p>
      {error && <div className="text-red-500 mb-4">{error}</div>}
    </div>
  );
}
