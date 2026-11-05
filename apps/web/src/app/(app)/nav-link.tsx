"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const path = usePathname();
  const aktif = path === href || path.startsWith(href + "/");
  return (
    <Link href={href} aria-current={aktif ? "page" : undefined}>
      {children}
    </Link>
  );
}
