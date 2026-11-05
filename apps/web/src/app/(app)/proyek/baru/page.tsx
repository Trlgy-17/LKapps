import { wajibMasuk } from "@/lib/sesi";
import { UnggahForm } from "./unggah-form";

export default async function ProyekBaru() {
  await wajibMasuk("proyek.ubah");
  return (
    <>
      <div className="kepala"><h1>Proyek Baru</h1></div>
      <UnggahForm />
    </>
  );
}
