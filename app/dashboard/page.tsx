// app/dashboard/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  if (loading) {
    return <p className="p-4">Checking session...</p>;
  }

  if (!user) {
    // Not logged in → redirect to login
    if (typeof window !== "undefined") {
      router.push("/login");
    }
    return <p className="p-4">Redirecting...</p>;
  }

  async function handleLogout() {
    await signOut(auth);
    router.push("/login");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center">
      <div className="border rounded-lg p-6 shadow-sm min-w-[300px] text-center">
        <h1 className="text-xl font-semibold mb-2">
          Welcome, {user.displayName || user.email}
        </h1>
        <p className="text-sm mb-4">You are logged in.</p>

        <button
          onClick={handleLogout}
          className="bg-gray-800 text-white px-4 py-2 rounded text-sm"
        >
          Log out
        </button>
      </div>
    </main>
  );
}
