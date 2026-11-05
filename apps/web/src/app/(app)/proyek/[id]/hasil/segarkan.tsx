"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Muat ulang halaman tiap 2 detik sampai hasil keluar. */
export function Segarkan() {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), 2000);
    return () => clearInterval(t);
  }, [router]);
  return null;
}
