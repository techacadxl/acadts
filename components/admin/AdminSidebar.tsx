"use client";

import { useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

interface AdminSidebarProps {
  onNavigate?: () => void;
}

export default function AdminSidebar({ onNavigate }: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = useCallback(async () => {
    console.log("[AdminSidebar] Logout initiated");
    try {
      // Clear login time
      if (typeof window !== "undefined") {
        localStorage.removeItem("user_login_time");
      }
      await signOut(auth);
      console.log("[AdminSidebar] Sign out successful, redirecting");
      router.replace("/login");
    } catch (err) {
      console.error("[AdminSidebar] Logout error:", err);
    }
  }, [router]);

  const isActive = (path: string) => {
    if (path === "/admin") {
      return pathname === "/admin";
    }
    return pathname.startsWith(path);
  };

  const navItems = [
    { path: "/admin", label: "Dashboard", icon: "📊" },
    { path: "/admin/test-series", label: "Test Series", icon: "📚" },
    { path: "/admin/tests", label: "Tests", icon: "📝" },
    { path: "/admin/questions", label: "Questions", icon: "❓" },
    { path: "/admin/orders", label: "Orders", icon: "🛒" },
  ];

  const handleNavigation = useCallback(
    (path: string) => {
      router.push(path);
      if (onNavigate) {
        onNavigate();
      }
    },
    [router, onNavigate]
  );

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-full flex flex-col overflow-y-auto">
      {/* Navigation */}
      <nav className="flex-1 p-4 pt-6">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.path}>
              <button
                onClick={() => handleNavigation(item.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  isActive(item.path)
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
        >
          <span className="text-lg">🚪</span>
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

