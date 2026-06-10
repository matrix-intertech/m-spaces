import React from "react";
import Link from "next/link";

export interface DashboardShellProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function DashboardShell({ title, subtitle, children }: DashboardShellProps) {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <span className="text-xl font-bold text-blue-600">MatrixSpaces</span>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          <Link href="/owner" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-900 hover:bg-gray-100">Owner Dashboard</Link>
          <Link href="/builder" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">Builder Hub</Link>
          <Link href="/visits" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">My Visits</Link>
          <Link href="/my-chats" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">My Chats</Link>
          <Link href="/vault" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">My Vault</Link>
          <Link href="/profile" className="block px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-100">Profile Settings</Link>
        </nav>
        <div className="p-4 border-t border-gray-200">
          <Link href="/list-property" className="w-full flex justify-center items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors">
            List a Property
          </Link>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="h-16 flex items-center justify-between px-5 bg-white border-b border-gray-200 shadow-sm z-10">
          <h1 className="text-2xl font-semibold text-gray-800">{title}</h1>
          <div className="flex items-center space-x-4">
            <button className="text-gray-400 hover:text-gray-600 relative">
              <span className="sr-only">Notifications</span>
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {/* Notification Badge */}
              <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-500 ring-2 ring-white"></span>
            </button>
            <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold border border-blue-200 cursor-pointer">
              U
            </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-gray-50">
          {children ? children : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 text-center text-gray-500">
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Data Available</h3>
              <p>The UI content for this section is currently being migrated to Next.js.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
