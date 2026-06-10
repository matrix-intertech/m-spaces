"use client";

import { useEffect, useState } from "react";
import { backendBaseUrl } from "@/lib/config";

type BrokerRecord = Record<string, any>;

export function BrokerRatingModal({
  broker,
  onClose
}: {
  broker: BrokerRecord;
  onClose: () => void;
}) {
  const [rating, setRating] = useState(5);

  useEffect(() => {
    setRating(5);
  }, [broker?.id]);

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-7 relative border border-gray-200">
        <button onClick={onClose} type="button" className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 p-1.5 rounded-full transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-2xl font-bold text-gray-900 mb-1">
          Rate Broker: <span className="text-red-600">{broker?.username || "Broker"}</span>
        </h2>
        <p className="text-sm text-gray-500 mb-6">Your feedback helps maintain platform quality.</p>

        <form action={`${backendBaseUrl}/owner/rate-broker`} method="POST" className="space-y-5">
          <input type="hidden" name="broker_id" value={broker?.id ?? ""} />
          <input type="hidden" name="rating" value={rating} />
          <div className="flex items-center gap-2 mb-2">
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setRating(value)}
                className={`h-9 w-9 cursor-pointer transition-all duration-200 hover:scale-110 ${value <= rating ? "text-yellow-400" : "text-gray-300"}`}
                aria-label={`Rate ${value} star${value === 1 ? "" : "s"}`}
              >
                <svg aria-hidden="true" xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118L3.077 10.1c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              </button>
            ))}
          </div>
          <label className="block">
            <span className="block text-sm font-bold text-gray-700 mb-2">Review (Optional)</span>
            <textarea name="comment" placeholder="Share your experience working with this broker..." className="w-full border border-gray-300 rounded-md px-4 py-3 bg-white focus:outline-none focus:ring-4 focus:ring-red-500/20 focus:border-red-500 transition-all shadow-sm h-24" />
          </label>
          <button type="submit" className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 rounded-md transition-all active:scale-95 shadow-sm flex items-center justify-center">
            Submit Rating
          </button>
        </form>
      </div>
    </div>
  );
}
