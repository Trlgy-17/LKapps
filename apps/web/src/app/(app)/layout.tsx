import { redirect } from "next/navigation";
import { boleh, NAMA_PERAN } from "@/lib/permissions";
import { akhiriSesi, wajibMasuk } from "@/lib/sesi";
import { NavLink } from "./nav-link";

async function keluar() {
  "use server";
  await akhiriSesi();
  redirect("/masuk");
}

export default async function TataLetakApp({ children }: { children: React.ReactNode }) {
  const p = await wajibMasuk();
  return (
    <div className="rangka">
      <nav className="sidebar" aria-label="Navigasi utama">
        <div className="merek"><span className="logo" aria-hidden="true" />Estimasi Material</div>
        {boleh(p.peran, "proyek.baca") && <NavLink href="/proyek">Proyek</NavLink>}
        {boleh(p.peran, "katalog.baca") && <NavLink href="/katalog">Katalog material</NavLink>}
        {boleh(p.peran, "aturan.baca") && <NavLink href="/aturan">Pustaka aturan</NavLink>}
        <div className="pengguna">
          <div>{p.nama}</div>
          <div>{NAMA_PERAN[p.peran]}</div>
          <form action={keluar}><button className="tombol sekunder" style={{ marginTop: 8 }}>Keluar</button></form>
        </div>
      </nav>
      <main className="konten">{children}</main>
    </div>
  );
}
