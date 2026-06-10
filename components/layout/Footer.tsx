import Image from "next/image";
import Link from "next/link";
import { AppearanceToggle } from "@/components/layout/AppearanceToggle";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-slate-200 text-slate-600 py-4 pb-16 md:pb-4 mt-auto border-t border-slate-300">
      <div className="container mx-auto px-2 md:px-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div className="flex flex-col items-center text-center">
            <Link href="/" className="flex items-center justify-center gap-2 mb-0 group">
              <Image
                src="/assets/logo.png"
                alt="MatrixSpaces"
                width={256}
                height={256}
                className="w-28 h-28 object-contain opacity-80 group-hover:opacity-100 transition-opacity"
              />
            </Link>
            <p className="mt-1 text-[11px] font-black uppercase tracking-[0.16em] text-slate-500">
              Spaces That Hits, Different
            </p>
          </div>

          <div>
            <h4 className="text-slate-900 font-bold mb-2 text-sm">Quick Links</h4>
            <ul className="space-y-1.5 text-xs">
              <li><Link href="/" className="hover:text-red-500 transition-colors">Home</Link></li>
              <li><Link href="/about" className="hover:text-red-500 transition-colors">About Us</Link></li>
              <li><Link href="/privacy-policy" className="hover:text-red-500 transition-colors">Privacy Policy</Link></li>
              <li><Link href="/terms-conditions" className="hover:text-red-500 transition-colors">Terms & Conditions</Link></li>
              <li><Link href="/?viewAll=true" className="hover:text-red-500 transition-colors">All Properties</Link></li>
              <li><Link href="/contact" className="hover:text-red-500 transition-colors">Contact Us</Link></li>
              <li><Link href="/report" className="hover:text-red-500 transition-colors">Report an Issue</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-900 font-bold mb-2 text-sm">Contact Us</h4>
            <ul className="space-y-1.5 text-xs">
              <li className="flex items-start gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>G-68 Kalkaji,<br />New Delhi, India 110019</span>
              </li>
              <li className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 12.284 3 6V5z" />
                </svg>
                <span>+91 9217676115</span>
              </li>
              <li className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <a href="mailto:support@matrixspaces.com" className="hover:text-slate-900 transition-colors">support@matrixspaces.com</a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-slate-900 font-bold mb-2 text-sm">Follow Us</h4>
            <div className="flex gap-3 mb-3">
              <a href="https://facebook.com/matrixspacex" target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors" aria-label="Facebook">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                </svg>
              </a>
              <a href="https://x.com/matrix_spaces" target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors" aria-label="X">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </a>
              <a href="https://www.instagram.com/matrixspaces/" target="_blank" rel="noopener noreferrer" className="w-7 h-7 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-600 hover:bg-red-600 hover:text-white hover:border-red-600 transition-colors" aria-label="Instagram">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M7.5 2h9A5.5 5.5 0 0122 7.5v9a5.5 5.5 0 01-5.5 5.5h-9A5.5 5.5 0 012 16.5v-9A5.5 5.5 0 017.5 2zm0 1.8A3.7 3.7 0 003.8 7.5v9a3.7 3.7 0 003.7 3.7h9a3.7 3.7 0 003.7-3.7v-9a3.7 3.7 0 00-3.7-3.7h-9zm4.5 3.4a4.8 4.8 0 110 9.6 4.8 4.8 0 010-9.6zm0 1.8a3 3 0 100 6 3 3 0 000-6zm5.1-2.2a1.15 1.15 0 110 2.3 1.15 1.15 0 010-2.3z" />
                </svg>
              </a>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-slate-500">
              <AppearanceToggle />
            </div>
          </div>
        </div>

        <div className="pt-3 text-right text-[11px] text-slate-500">
          <p>&copy; {year} MatrixSpaces. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
