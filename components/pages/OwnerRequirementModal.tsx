"use client";

import { backendBaseUrl } from "@/lib/config";

const propertyTypeOptions = ["Office", "Warehouse", "Retail", "Coworking", "Bank Space", "Gym Space", "Villa", "Mansion", "Luxury Flat", "House", "Others"];

export function OwnerRequirementModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-lg p-6 relative">
        <button onClick={onClose} type="button" className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <h2 className="text-xl font-bold mb-2 text-gray-900">Post Requirement</h2>
        <p className="text-sm text-gray-600 mb-5">Share what kind of commercial space you need so admins can suggest matching properties.</p>

        <form action={`${backendBaseUrl}/requirements/add`} method="POST" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label>
              <span className="block text-xs font-bold text-gray-700 mb-1">Target Cities</span>
              <input name="cities" required className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm" placeholder="Noida, Delhi, Gurugram" />
            </label>
            <label>
              <span className="block text-xs font-bold text-gray-700 mb-1">Locality</span>
              <input name="locality" className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm" placeholder="Sector 62, Connaught Place..." />
            </label>
            <label>
              <span className="block text-xs font-bold text-gray-700 mb-1">Property Type</span>
              <select name="property_type" required className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm">
                {propertyTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="block text-xs font-bold text-gray-700 mb-1">Requirement Type</span>
              <select name="requirement_type" defaultValue="Buy" className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm">
                <option value="Buy">Buy</option>
                <option value="Rent">Rent</option>
                <option value="Lease">Lease</option>
              </select>
            </label>
            <label>
              <span className="block text-xs font-bold text-gray-700 mb-1">Min. Size</span>
              <input name="min_size" className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm" placeholder="e.g. 2000 sq.ft" />
            </label>
            <label>
              <span className="block text-xs font-bold text-gray-700 mb-1">Budget</span>
              <input name="budget" className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm" placeholder="e.g. 1.5 Cr or 2 L/month" />
            </label>
          </div>
          <label>
            <span className="block text-xs font-bold text-gray-700 mb-1">Description</span>
            <textarea name="description" rows={4} className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm" placeholder="Add floor preference, frontage, parking, handover timeline, or other must-haves." />
          </label>
          <button type="submit" className="w-full bg-slate-900 text-white py-3 rounded-md font-bold hover:bg-slate-800 shadow-sm transition-all">
            Post Requirement
          </button>
        </form>
      </div>
    </div>
  );
}
