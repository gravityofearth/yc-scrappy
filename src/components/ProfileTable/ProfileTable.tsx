"use client";
import Image from "next/image";
import { useState } from "react";
import { ProfileModel } from "@/types";

const ProfileTable = ({
  loading,
  profiles,
  handleOverview,
  onContacted,
}: {
  loading: boolean;
  profiles: ProfileModel[];
  handleOverview: (profile: ProfileModel) => void;
  onContacted?: (profile: ProfileModel) => void;
}) => {
  const [contactingId, setContactingId] = useState<string | null>(null);

  const handleMarkContacted = async (
    e: React.MouseEvent,
    profile: ProfileModel
  ) => {
    e.stopPropagation();
    if (profile.contact) return;
    setContactingId(profile.userId);
    try {
      const res = await fetch(`/api/profiles/${profile.userId}/contact`, {
        method: "PATCH",
      });
      if (res.ok) onContacted?.({ ...profile, contact: true });
    } finally {
      setContactingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-hidden">
      <div className="h-full overflow-auto scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-gray-100">
        <table className="min-w-full divide-y divide-gray-200 relative">
          <thead className="text-left bg-gray-50 dark:bg-gray-800 shadow-lg sticky top-0 z-10">
            <tr className="font-semibold text-gray-600 dark:text-gray-400 uppercase">
              <th className="p-4"></th>
              <th className="p-4">Name</th>
              <th className="p-4">Age</th>
              <th className="p-4">Location</th>
              <th className="p-4">Funding Status</th>
              <th className="p-4">Last Seen</th>
              <th className="p-4">Last Updated</th>
              <th className="p-4">Contacted</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading
              ? Array(12)
                  .fill(null)
                  .map((_, index) => (
                    <tr key={`loading-${index}`}>
                      <td colSpan={8} className="text-center p-4">
                        <div className="animate-pulse bg-gray-200 dark:bg-gray-700 h-4 rounded"></div>
                      </td>
                    </tr>
                  ))
              : profiles.map((profile, index) => (
                  <tr
                    key={profile.userId || index}
                    className={`hover:bg-gray-300 dark:hover:bg-gray-600 hover:cursor-pointer ${
                      profile.readAt
                        ? "bg-blue-500/30 dark:bg-sky-950/30"
                        : "even:bg-gray-100 dark:even:bg-gray-800"
                    }`}
                    onClick={handleOverview.bind(null, profile)}
                  >
                    <td className="p-2">
                      <Image
                        src={profile.avatar || "/cutestar.png"} // Use a static fallback image
                        alt="Profile"
                        width={72}
                        height={72}
                        className="rounded-full"
                      />
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {profile.name || "N/A"}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {profile.age || "N/A"}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {profile.location || "N/A"}
                    </td>
                    <td className="p-2 max-w-80 text-ellipsis overflow-hidden whitespace-nowrap">
                      {profile.startup?.funding || "N/A"}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {profile.lastSeen ? profile.lastSeen : "N/A"}
                    </td>
                    <td className="p-2 whitespace-nowrap">
                      {profile.updatedAt
                        ? new Date(profile.updatedAt).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="p-2 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      {profile.contact ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                          Yes
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleMarkContacted(e, profile)}
                          disabled={contactingId === profile.userId}
                          className="px-2 py-1 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded disabled:opacity-50"
                        >
                          {contactingId === profile.userId ? "..." : "Mark contacted"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProfileTable;
