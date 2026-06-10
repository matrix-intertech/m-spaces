"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { BrokerRatingModal } from "./BrokerRatingModal";
import { OwnerBrokerAssignModal } from "./OwnerBrokerAssignModal";
import { OwnerPropertyModal } from "./OwnerPropertyModal";
import { OwnerRequirementModal } from "./OwnerRequirementModal";
import { backendBaseUrl } from "@/lib/config";
import { getClientCsrfToken } from "@/lib/csrf-client";
import { assetPath, formatDateTime, formatIndianNumber, parsePhotos } from "@/lib/format";

export interface OwnerDashboardProps {
  properties?: any[];
  totalInquiries?: number;
  visits?: any[];
  myRequirements?: any[];
  requirementSuggestions?: any[];
  brokers?: any[];
  managementRequests?: any[];
  s3BaseUrl?: string;
}

export function OwnerDashboard({
  properties = [],
  totalInquiries = 0,
  visits = [],
  myRequirements = [],
  requirementSuggestions = [],
  brokers = [],
  managementRequests = [],
}: OwnerDashboardProps) {
  // Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isManageVisitModalOpen, setIsManageVisitModalOpen] = useState(false);
  const [isDeclareModalOpen, setIsDeclareModalOpen] = useState(false);
  const [isBrokerModalOpen, setIsBrokerModalOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [isRequirementModalOpen, setIsRequirementModalOpen] = useState(false);

  // Active Selection States
  const [selectedProperty, setSelectedProperty] = useState<any>(null);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [selectedBroker, setSelectedBroker] = useState<any>(null);
  const [csrfToken, setCsrfToken] = useState("");

  // Legacy add-modal state is kept only for the disabled EJS-style JSX below.
  const [addListingType, setAddListingType] = useState<string>("rent");
  const [addPropertyType, setAddPropertyType] = useState<string>("office");

  useEffect(() => {
    void getClientCsrfToken().then(setCsrfToken).catch(() => {});
  }, []);

  return (
    <>
      <div className="container py-8 pb-24">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Property Dashboard</h1>
            <p className="text-gray-500 mt-1">Manage your property listings, brokers, and inquiries.</p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="bg-red-600 text-white px-6 py-2.5 rounded-md font-bold hover:bg-red-700 hover:shadow-md hover:-translate-y-0.5 active:scale-95 transition-all shadow-sm flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            List New Property
          </button>
        </div>

        {/* Analytics Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-8">
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group cursor-pointer">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1 group-hover:text-red-600 transition-colors">
              Total Properties
            </div>
            <div className="text-3xl font-bold text-gray-900">{properties.length}</div>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group cursor-pointer">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1 group-hover:text-green-600 transition-colors">
              Active Listings
            </div>
            <div className="text-3xl font-bold text-gray-900">
              {properties.filter((p) => p.status === "listed").length}
            </div>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group cursor-pointer">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1 group-hover:text-blue-600 transition-colors">
              Total Inquiries
            </div>
            <div className="text-3xl font-bold text-gray-900">{totalInquiries}</div>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:-translate-y-1 transition-all duration-300 group cursor-pointer">
            <div className="text-gray-500 text-xs font-bold uppercase tracking-wider mb-1 group-hover:text-purple-600 transition-colors">
              Scheduled Visits
            </div>
            <div className="text-3xl font-bold text-gray-900">{visits ? visits.length : 0}</div>
          </div>
        </div>

        {managementRequests.length > 0 && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Management Requests</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {managementRequests.map((request, index) => (
                <div key={request.id ?? index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{request.property_title || "Property Request"}</p>
                      <p className="text-xs text-gray-500">{request.locality || "Unknown locality"}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded uppercase ${String(request.status || "").toLowerCase() === "accepted" ? "bg-green-100 text-green-700" : String(request.status || "").toLowerCase() === "rejected" ? "bg-red-100 text-red-700" : "bg-yellow-100 text-yellow-700"}`}>
                      {request.status || "pending"}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div><span className="font-bold text-gray-800">Agent:</span> {request.agent_name || "N/A"}</div>
                    <div><span className="font-bold text-gray-800">Price:</span> {formatIndianNumber(request.final_price || 0)}</div>
                    <div><span className="font-bold text-gray-800">Requested:</span> {formatDateTime(request.created_at)}</div>
                    <div><span className="font-bold text-gray-800">Responded:</span> {request.responded_at ? formatDateTime(request.responded_at) : "Pending"}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Properties List */}
        <div className="mb-10">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">My Properties</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {properties.map((prop, idx) => {
              const firstPhoto = assetPath(parsePhotos(prop.photos, prop.photo || prop.image_url)[0], "");

              return (
                <div key={idx} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col group relative hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                  <div className="h-48 bg-gray-200 relative overflow-hidden">
                    {firstPhoto ? (
                      <img src={firstPhoto} alt={prop.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                    ) : (
                      <div className="flex items-center justify-center h-full text-gray-400 text-sm">No Image</div>
                    )}
                    <div className="absolute top-4 left-4 bg-white px-2 py-1 rounded-md text-xs font-bold text-gray-900 shadow-sm uppercase">
                      {prop.listing_type || "Rent"}
                    </div>
                    <div className="absolute top-4 right-4 flex flex-col gap-1 items-end">
                      <div className={`bg-white px-2 py-1 rounded-md text-[10px] font-bold shadow-sm uppercase tracking-wide ${prop.status === "listed" ? "text-green-600 border border-green-200" : "text-gray-600 border border-gray-200"}`}>
                        {prop.status}
                      </div>
                      <div className={`bg-white px-2 py-1 rounded-md text-[10px] font-bold shadow-sm uppercase tracking-wide ${prop.verification_status === "Verified" || prop.verification_status === "Premium Verified" ? "text-blue-600 border border-blue-200" : prop.verification_status === "Rejected" ? "text-red-600 border border-red-200" : "text-yellow-600 border border-yellow-200"}`}>
                        {prop.verification_status || "Unverified"}
                      </div>
                    </div>
                  </div>
                  <div className="p-5 flex flex-col flex-1">
                    <h3 className="text-xl font-bold text-gray-900 mb-1 truncate" title={prop.title}>
                      {prop.title}
                    </h3>
                    <p className="text-gray-500 text-xs mb-4 truncate">
                      <i className="fas fa-map-marker-alt text-gray-400 mr-1"></i>
                      {prop.locality}
                    </p>

                    <div className="space-y-3 mb-4 flex-1">
                      {/* Ownership Verification Status */}
                      <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-md border border-gray-200">
                        <span className="text-xs font-bold text-gray-600">Ownership</span>
                        {prop.ownership_declaration ? (
                          <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                            <i className="fas fa-check-circle"></i> Declared
                          </span>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedProperty(prop);
                              setIsDeclareModalOpen(true);
                            }}
                            className="text-[10px] font-bold bg-white border border-orange-300 text-orange-700 px-2 py-0.5 rounded-md hover:bg-orange-50 active:scale-95 transition-all"
                          >
                            Declare Now
                          </button>
                        )}
                      </div>

                      {/* Broker Assignment */}
                      <div className="flex flex-col gap-1.5 bg-gray-50 p-2.5 rounded-md border border-gray-200">
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-bold text-gray-600">Assigned Brokers</span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProperty(prop);
                              setIsBrokerModalOpen(true);
                            }}
                            className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded font-bold hover:bg-red-200 transition-colors flex items-center gap-1"
                          >
                            <i className="fas fa-plus"></i> Assign
                          </button>
                        </div>

                        {(() => {
                          let assignedList: string[] = [];
                          if (prop.assigned_brokers && prop.assigned_brokers.length > 0) {
                            assignedList = prop.assigned_brokers;
                          } else if (prop.assigned_broker_id) {
                            assignedList = [prop.assigned_broker_id];
                          }

                          if (assignedList.length > 0 && brokers) {
                            return (
                              <div className="space-y-2 mt-1">
                                {assignedList.map((brokerId) => {
                                  const b = brokers.find((br) => br.id === brokerId);
                                  if (!b) return null;
                                  return (
                                    <div key={b.id} className="flex items-center justify-between bg-white border border-gray-200 p-2 rounded text-xs shadow-sm">
                                      <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 bg-red-50 text-red-600 rounded-full flex items-center justify-center font-bold uppercase flex-shrink-0">
                                          {b.username.charAt(0)}
                                        </div>
                                        <div>
                                          <div className="font-bold text-gray-800">{b.username}</div>
                                          <div className="text-[9px] text-gray-500 uppercase tracking-wider">
                                            {b.role === "external_sales" ? "Sales Agent" : b.role === "builder" ? "Builder" : "Broker"}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex gap-2 items-center">
                                        {b.phone && (
                                          <a href={`tel:${b.phone}`} className="text-green-600 hover:text-green-800 bg-green-50 w-6 h-6 rounded-full flex items-center justify-center transition-colors" title="Contact Broker">
                                            <i className="fas fa-phone-alt text-[10px]"></i>
                                          </a>
                                        )}
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setSelectedBroker(b);
                                            setIsRatingModalOpen(true);
                                          }}
                                          className="text-yellow-600 hover:text-yellow-800 bg-yellow-50 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                                          title="Rate Broker"
                                        >
                                          <i className="fas fa-star text-[10px]"></i>
                                        </button>
                                        <form action={`${backendBaseUrl}/owner/property/${prop.id}/remove-broker`} method="POST" className="inline m-0">
                                          <input type="hidden" name="broker_id" value={b.id} />
                                          <button type="submit" className="text-red-600 hover:text-red-800 bg-red-50 w-6 h-6 rounded-full flex items-center justify-center transition-colors" title="Remove Broker" onClick={(e) => { if (!confirm("Remove this broker from property?")) e.preventDefault(); }}>
                                            <i className="fas fa-times text-[10px]"></i>
                                          </button>
                                        </form>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            );
                          } else {
                            return <div className="text-xs text-gray-500 italic mt-1 bg-white p-2 border border-gray-200 rounded text-center">Self Managed</div>;
                          }
                        })()}
                      </div>

                      {/* Inquiry Tracking */}
                      <div className="flex items-center justify-between bg-gray-50 p-2.5 rounded-md border border-gray-200">
                        <span className="text-xs font-bold text-gray-600">Live Inquiries</span>
                        <Link
                          href="/messages"
                          className={`text-[10px] font-bold ${(prop.inquiry_count || 0) > 0 ? "bg-red-100 text-red-700 hover:bg-red-200 hover:shadow-sm" : "bg-gray-200 text-gray-600 hover:bg-gray-300"} px-2 py-0.5 rounded-md transition-all active:scale-95`}
                        >
                          {prop.inquiry_count || 0} Active Chats
                        </Link>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-gray-100 mt-auto">
                      <Link href={`/property/${prop.id}`} className="text-gray-700 bg-gray-100 border border-gray-200 px-4 py-1.5 rounded-md font-bold text-xs hover:bg-gray-200 active:scale-95 transition-all">
                        View Details
                      </Link>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProperty(prop);
                            setIsEditModalOpen(true);
                          }}
                          className="text-blue-600 font-bold text-xs hover:text-blue-800 transition-colors"
                        >
                          Edit
                        </button>
                        <form action={`${backendBaseUrl}/property/delete`} method="POST" onSubmit={(e) => { if (!confirm("Delete this property permanently?")) e.preventDefault(); }} className="m-0">
                          <input type="hidden" name="id" value={prop.id} />
                          <input type="hidden" name="_csrf" value={csrfToken} />
                          <button type="submit" className="text-red-600 font-bold text-xs hover:text-red-800 flex items-center gap-1 transition-colors">
                            Delete
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {properties.length === 0 && (
              <div className="col-span-full bg-white rounded-lg p-8 text-center shadow-sm border border-gray-200">
                <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <i className="fas fa-home text-2xl text-gray-300"></i>
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">No properties listed yet</h3>
                <p className="text-gray-500 mb-6">List your first property to start receiving inquiries from verified tenants and buyers.</p>
                <button onClick={() => setIsAddModalOpen(true)} className="bg-red-600 text-white px-6 py-2.5 rounded-md font-bold hover:bg-red-700 transition-colors shadow-sm">
                  List Your Property
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Inquiry & Visits Tracking */}
        {visits && visits.length > 0 && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Scheduled Visits & Tracking</h2>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-600">
                  <thead className="bg-gray-50 text-gray-900 font-bold border-b border-gray-200">
                    <tr>
                      <th className="p-4">Property</th>
                      <th className="p-4">Prospective Client</th>
                      <th className="p-4">Scheduled For</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {visits.map((v, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="p-4 font-bold text-gray-900">{v.property_title}</td>
                        <td className="p-4">{v.renter_name}</td>
                        <td className="p-4">{v.scheduled_at ? formatDateTime(v.scheduled_at) : "Pending Time"}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wide ${v.status === "completed" ? "bg-green-100 text-green-700" : v.status === "requested" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700"}`}>
                            {v.status}
                          </span>
                          {(v.status === "requested" || v.status === "approved") && (
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedVisit(v);
                                setIsManageVisitModalOpen(true);
                              }}
                              className="ml-2 bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold uppercase hover:bg-red-700 transition-colors"
                            >
                              Manage
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* My Requirements Section */}
        <div className="mt-8 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">My Posted Requirements & Matches</h2>
              <p className="text-xs text-slate-500">Manage your property requirements and view approved suggestions.</p>
            </div>
            <button onClick={() => setIsRequirementModalOpen(true)} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm whitespace-nowrap">
              + Post Requirement
            </button>
          </div>

          {myRequirements && myRequirements.length > 0 ? (
            <div className="overflow-x-auto border-b border-slate-100">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-slate-900 font-bold">
                  <tr>
                    <th className="p-4">Target Cities</th>
                    <th className="p-4">Property Type</th>
                    <th className="p-4">Min. Size</th>
                    <th className="p-4">Budget</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myRequirements.map((req, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-4 font-bold text-slate-800">{req.cities}</td>
                      <td className="p-4">{req.property_type}</td>
                      <td className="p-4">{req.min_size || "Flexible"} sq.ft</td>
                      <td className="p-4 font-mono font-bold">₹{req.budget}</td>
                      <td className="p-4">
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${req.status === "active" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-700"}`}>
                          {req.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <form action={`${backendBaseUrl}/requirements/user-delete`} method="POST" onSubmit={(e) => { if (!confirm("Are you sure you want to delete this requirement?")) e.preventDefault(); }} className="inline-block">
                          <input type="hidden" name="req_id" value={req.id} />
                          <button type="submit" className="text-red-600 hover:text-red-800 font-bold text-xs bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors border border-red-100">
                            Delete
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {/* Approved Suggestions */}
          {requirementSuggestions && requirementSuggestions.length > 0 ? (
            <>
              <div className="p-6 bg-slate-50 border-b border-slate-100">
                <h3 className="text-lg font-bold text-slate-900">Approved Property Suggestions</h3>
                <p className="text-xs text-slate-500">Properties vetted by Admins matching your requirements.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-slate-900 font-bold">
                    <tr>
                      <th className="p-4">Matched Requirement</th>
                      <th className="p-4">Property Suggested</th>
                      <th className="p-4">Key Details</th>
                      <th className="p-4">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {requirementSuggestions.map((sugg, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-4 text-xs">
                          <div className="font-bold text-slate-800">{sugg.req_cities}</div>
                          <div className="text-slate-500">{sugg.req_type}</div>
                        </td>
                        <td className="p-4 font-bold text-slate-900">
                          <a href={`/property/${sugg.property_id}`} target="_blank" rel="noreferrer" className="hover:text-blue-600 hover:underline">
                            {sugg.property_title}
                          </a>
                        </td>
                        <td className="p-4 text-xs">
                          {sugg.locality} • ₹{formatIndianNumber(sugg.final_price)} • {sugg.type}
                        </td>
                        <td className="p-4">
                          <a href={`/property/${sugg.property_id}`} target="_blank" rel="noreferrer" className="inline-block bg-slate-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-slate-800 shadow-sm">
                            View Property
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : myRequirements && myRequirements.length > 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">No approved property suggestions for your requirements yet.</div>
          ) : (
            <div className="p-6 text-center text-slate-500">You haven't posted any requirements yet.</div>
          )}
        </div>
      </div>

      {/* --- MODALS SECTION --- */}

      {/* Add Property Modal */}
      {isAddModalOpen && <OwnerPropertyModal mode="add" onClose={() => setIsAddModalOpen(false)} />}
      {isEditModalOpen && selectedProperty && <OwnerPropertyModal mode="edit" property={selectedProperty} onClose={() => setIsEditModalOpen(false)} />}

      {/* Disabled legacy placeholder modal retained only until the surrounding file is fully flattened. */}
      {false && (
        <>
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative custom-scrollbar">
            <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10 bg-white rounded-full p-1">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">List New Property</h2>
              <form action={`${backendBaseUrl}/property/add`} method="POST" encType="multipart/form-data" className="space-y-4">
                <input type="hidden" name="status" value="listed" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Title</label>
                    <input type="text" name="title" required className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Locality</label>
                    <input type="text" name="locality" required className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm" placeholder="e.g. Connaught Place, New Delhi" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">Listing Type</label>
                  <input type="hidden" name="listingType" value={addListingType} />
                  <div className="flex flex-wrap gap-2">
                    {["rent", "sale", "lease", "pg"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setAddListingType(type)}
                        className={`px-3 py-1.5 border rounded-full text-xs font-bold transition-all focus:outline-none ${addListingType === type ? "bg-red-50 border-red-500 text-red-700" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-red-500"}`}
                      >
                        {type === "pg" ? "PG / Co-living" : `For ${type.charAt(0).toUpperCase() + type.slice(1)}`}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">Property Type</label>
                  <input type="hidden" name="type" value={addPropertyType} />
                  <div className="flex flex-wrap gap-2">
                    {["office", "retail", "warehouse", "coworking"].map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setAddPropertyType(type)}
                        className={`px-3 py-1.5 border rounded-full text-xs font-bold transition-all focus:outline-none ${addPropertyType === type ? "bg-red-50 border-red-500 text-red-700" : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50 hover:border-red-500"}`}
                      >
                        {type.charAt(0).toUpperCase() + type.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Contact Details</label>
                    <input type="text" name="contact" required className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm" placeholder="Phone / Email" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Expected Price (₹)</label>
                    <input type="number" name="final_price" required className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm" placeholder="e.g. 50000" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-1">Property Size (sq.ft)</label>
                    <input type="text" name="size" required className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm" placeholder="e.g. 1200 sqft" />
                  </div>
                </div>
                <div className="md:col-span-2 border-t border-gray-200 pt-4 mt-2">
                   {/* Map/Location section would be integrated via Leaflet in a useEffect or separate MapComponent */}
                   <div className="bg-gray-100 p-4 text-center rounded-md border border-gray-200 text-sm text-gray-500 mb-4">
                     [Map Integration Component PlaceHolder]
                   </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Description</label>
                  <textarea name="condition" className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm min-h-24"></textarea>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Photos</label>
                  <input type="file" name="photos" accept="image/*" multiple className="w-full border border-gray-300 rounded-md px-3 py-2 bg-white focus:outline-none focus:border-red-500 shadow-sm" />
                </div>
                <div className="pt-4 border-t border-gray-200">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input type="checkbox" name="ownership_declaration" required className="mt-1 w-5 h-5 text-red-600 rounded border-gray-300 focus:ring-red-500 shadow-sm" />
                    <div>
                      <span className="font-bold text-gray-800">Ownership Declaration</span>
                      <p className="text-xs text-gray-600 mt-1">I hereby declare that I am the rightful owner of this property, or have been authorized by the owner to list it.</p>
                    </div>
                  </label>
                </div>
                <button type="submit" className="w-full bg-red-600 text-white py-3 rounded-md font-bold hover:bg-red-700 shadow-sm transition-all">
                  Submit Listing
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
        </>
      )}

      {/* Manage Visit Modal */}
      {isManageVisitModalOpen && selectedVisit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsManageVisitModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-xl font-bold mb-2 text-gray-900">Manage Visit Request</h2>
            <p className="text-sm text-gray-600 mb-4">
              Request from <span className="font-bold text-red-600">{selectedVisit.renter_name}</span> for <span className="font-bold text-slate-800">{selectedVisit.property_title}</span>
            </p>
            <form action={`${backendBaseUrl}/visits/manage`} method="POST" className="space-y-4">
              <input type="hidden" name="visit_id" value={selectedVisit.id} />
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Final Date</label>
                  <input type="date" name="finalDate" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-red-500" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Final Time</label>
                  <input type="time" name="finalTime" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-red-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Instructions / Notes to visitor (Optional)</label>
                <textarea name="managerNotes" className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm h-16 focus:outline-none focus:border-red-500" placeholder="e.g. Please arrive 10 mins early, contact security at gate"></textarea>
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button type="submit" name="action" value="approve" className="flex-1 bg-green-600 text-white py-2 rounded-md font-bold text-sm hover:bg-green-700 transition-colors shadow-sm">Approve</button>
                <button type="submit" name="action" value="complete" className="flex-1 bg-blue-600 text-white py-2 rounded-md font-bold text-sm hover:bg-blue-700 transition-colors shadow-sm">Complete</button>
                <button type="submit" name="action" value="reject" className="flex-1 bg-red-600 text-white py-2 rounded-md font-bold text-sm hover:bg-red-700 transition-colors shadow-sm">Reject</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Declare Ownership Modal */}
      {isDeclareModalOpen && selectedProperty && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 relative">
            <button onClick={() => setIsDeclareModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-xl font-bold mb-2 text-gray-900">Ownership Declaration</h2>
            <p className="text-sm text-gray-600 mb-6">Please confirm the following statement to proceed.</p>
            <form action={`${backendBaseUrl}/owner/property/${selectedProperty.id}/declare-ownership`} method="POST" className="space-y-4">
              <div className="p-4 border border-gray-200 rounded-md bg-gray-50">
                <p className="text-xs text-gray-700">
                  I hereby declare that I am the rightful owner of this property, or have been authorized by the owner to list it. I take full responsibility for the accuracy of this listing and confirm I have the legal right to rent out or sell this property.
                </p>
              </div>
              <button type="submit" className="w-full bg-red-600 text-white py-3 rounded-md font-bold hover:bg-red-700 transition-colors shadow-sm">
                I Agree & Declare Ownership
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Assign Broker Modal */}
      {isBrokerModalOpen && selectedProperty && (
        <OwnerBrokerAssignModal property={selectedProperty} brokers={brokers} onClose={() => setIsBrokerModalOpen(false)} />
      )}

      {isRatingModalOpen && selectedBroker && (
        <BrokerRatingModal broker={selectedBroker} onClose={() => setIsRatingModalOpen(false)} />
      )}

      {isRequirementModalOpen && <OwnerRequirementModal onClose={() => setIsRequirementModalOpen(false)} />}

      {/* Disabled legacy assign-broker shell. */}
      {false && (
        <>
      {isBrokerModalOpen && selectedProperty && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md p-6 relative flex flex-col max-h-[90vh]">
            <button onClick={() => setIsBrokerModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 z-10">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <h2 className="text-xl font-bold mb-2 text-gray-900">Assign Broker</h2>
            <p className="text-sm text-gray-600 mb-4">Select a broker to assign to this property.</p>
            <div className="flex-1 overflow-y-auto custom-scrollbar pt-2 space-y-2">
              <form action={`${backendBaseUrl}/owner/property/${selectedProperty.id}/assign-broker`} method="POST" className="m-0">
                <input type="hidden" name="broker_id" value="" />
                <button type="submit" className="w-full text-left px-3 py-2 text-sm font-bold text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors flex items-center justify-between">
                  <span>Revert to Self Managed (Remove All)</span>
                  <i className="fas fa-trash-alt"></i>
                </button>
              </form>
              {brokers.map((b) => (
                <form key={b.id} action={`${backendBaseUrl}/owner/property/${selectedProperty.id}/assign-broker`} method="POST" className="m-0">
                  <input type="hidden" name="broker_id" value={b.id} />
                  <button type="submit" className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded border border-gray-200 transition-colors flex justify-between items-center">
                    <span>{b.username} ({b.role === "external_sales" ? "Sales" : "Broker"})</span>
                    <i className="fas fa-plus text-gray-400"></i>
                  </button>
                </form>
              ))}
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </>
  );
}
