"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";
import { BsSend } from "react-icons/bs";
import { FaRegCopy } from "react-icons/fa6";
import { WiCloudRefresh } from "react-icons/wi";
import { ProfileModel } from "@/types";
import { toast } from "react-toastify";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL;

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success("Link copied to clipboard");
};

const ProfileOverview = ({
  profile,
  show,
  handleClose,
  handleUpdate,
}: {
  profile: ProfileModel | null;
  show: boolean;
  handleClose: () => void;
  handleUpdate: (profile: ProfileModel) => void;
}) => {
  const updateProfile = async (url: string) => {
    const response = await fetch("/api/scrape-one", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) toast.error("Failed to fetch profile");
    else {
      const data = await response.json();
      handleUpdate(data.profile);
      toast.success("Profile fetched successfully");
    }
  };

  return (
    <div
      className={`absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 overflow-auto flex flex-row z-50 ${
        show ? "" : "hidden"
      }`}
    >
      <div className="w-1/2" onClick={handleClose}></div>
      <div className="w-1/2 overflow-auto">
        {profile && (
          <div className="bg-white dark:bg-gray-900 rounded-l-lg shadow-lg p-6">
            <div className="flex items-center gap-6 mb-6">
              {profile.avatar && (
                <Image
                  src={profile.avatar}
                  alt={profile.name}
                  width={160}
                  height={160}
                  className="rounded-full"
                />
              )}
              <div>
                <div className="flex flex-row gap-4">
                  <h1 className="text-2xl font-bold">{profile.name}</h1>
                  <button
                    className="p-1.5 text-xs rounded-md border text-white dark:text-gray-900 bg-blue-400 hover:bg-blue-500"
                    onClick={() => copyToClipboard(SITE_URL + profile.userId)}
                  >
                    <FaRegCopy className="w-4 h-4" />
                  </button>
                  <button
                    className="p-0.5 text-xs rounded-md border text-white dark:text-gray-900 bg-blue-400 hover:bg-blue-500"
                    onClick={() => updateProfile(SITE_URL + profile.userId)}
                  >
                    <WiCloudRefresh className="w-6 h-6" />
                  </button>
                  <Link
                    target="_blank"
                    href={SITE_URL + profile.userId}
                    className="p-1.5 text-xs rounded-md border text-white dark:text-gray-900 bg-green-400 hover:bg-green-500"
                  >
                    <BsSend className="w-4 h-4" />
                  </Link>
                </div>
                <p>{profile.location}</p>
                <p>{profile?.age} years old</p>
                <p>Last seen {profile.lastSeen}</p>
                <p>LinkedIn: {profile?.linkedIn}</p>
              </div>
            </div>

            <div className="grid gap-6">
              {(profile.statusLine || profile.sumary) && (
                <section>
                  <h2 className="text-xl font-semibold mb-2">Status</h2>
                  <p className="whitespace-pre-line text-gray-700 dark:text-gray-300">{profile.statusLine || profile.sumary}</p>
                </section>
              )}

              {profile.lookingFor && (
                <section>
                  <h2 className="text-xl font-semibold mb-4">What I&apos;m looking for in a co-founder</h2>
                  <p className="whitespace-pre-line text-gray-700 dark:text-gray-300">{profile.lookingFor}</p>
                </section>
              )}

              <section>
                <h2 className="text-xl font-semibold mb-4">About Me</h2>
                {profile.intro && (
                  <>
                    <h3 className="font-semibold my-1">Intro</h3>
                    <p className="whitespace-pre-line text-gray-700 dark:text-gray-300">{profile.intro}</p>
                  </>
                )}
                <h3 className="font-semibold my-1">Life Story</h3>
                <p>{profile.lifeStory}</p>
                <h3 className="font-semibold my-1">Free Time</h3>
                <p>{profile.freeTime}</p>
                <h3 className="font-semibold my-1">Other</h3>
                <p>{profile.other}</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">My Background</h2>
                <h3 className="font-semibold my-1">
                  Impressive accomplishment
                </h3>
                <p className="text-gray-700 dark:text-gray-300">{profile.accomplishments}</p>

                {profile.education?.length ? (
                  <div className="mt-4">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Education</h3>
                    <ul className="list-disc pl-6 space-y-1.5 text-gray-700 dark:text-gray-300">
                      {profile.education.map((item, idx) => (
                        <li key={idx} className="leading-snug">{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {profile.employment?.length ? (
                  <div className="mt-4">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Employment</h3>
                    <ul className="list-disc pl-6 space-y-1.5 text-gray-700 dark:text-gray-300">
                      {profile.employment.map((item, idx) => (
                        <li key={idx} className="leading-snug">{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">
                  {profile.startup?.name}
                </h2>
                <h3 className="font-semibold my-1">{profile.startup?.name}</h3>
                <p>{profile.startup?.description}</p>
                <h3 className="font-semibold my-1">Progress</h3>
                <p>{profile.startup?.progress}</p>
                <h3 className="font-semibold my-1">Funding Status</h3>
                <p>{profile.startup?.funding}</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold mb-4">
                  Co-founder Preferences
                </h2>
                <ul className="list-disc pl-5">
                  {profile.cofounderPreferences?.requirements?.map((req, i) => (
                    <li key={i}>{req}</li>
                  ))}
                </ul>
                <h3 className="font-semibold my-1">Ideal co-founder</h3>
                <p>{profile.cofounderPreferences?.idealPersonality}</p>
                <h3 className="font-semibold my-1">Equity expectations</h3>
                <p>{profile.cofounderPreferences?.equity}</p>
              </section>

              {(profile.interests?.shared?.length || profile.interests?.personal?.length) ? (
                <section>
                  <h2 className="text-xl font-semibold mb-4">Interests</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {profile.interests?.shared?.length ? (
                      <div>
                        <h3 className="font-semibold my-1 mb-2">Our shared interests</h3>
                        <div className="flex flex-wrap gap-2">
                          {profile.interests.shared.map((interest, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-full bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200 px-3 py-1 text-sm"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {profile.interests?.personal?.length ? (
                      <div>
                        <h3 className="font-semibold my-1 mb-2">My interests</h3>
                        <div className="flex flex-wrap gap-2">
                          {profile.interests.personal.map((interest, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200 px-3 py-1 text-sm"
                            >
                              {interest}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </section>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfileOverview;
