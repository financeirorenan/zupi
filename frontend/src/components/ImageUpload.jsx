import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { api, apiError } from "@/lib/api";
import { toast } from "sonner";

export default function ImageUpload({ value, onChange, label = "Foto", aspect = "aspect-video", testid = "image-upload" }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/uploads/image", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange(data.url);
      toast.success("Imagem enviada");
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-testid={testid}>
      <p className="text-xs font-semibold text-slate-600 mb-1">{label}</p>
      <div className={`relative ${aspect} w-full rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden`}>
        {value && <img src={value} alt="" className="absolute inset-0 w-full h-full object-cover" />}
        <button
          type="button"
          data-testid={`${testid}-button`}
          disabled={busy}
          onClick={() => ref.current?.click()}
          className={`absolute inset-0 flex flex-col items-center justify-center gap-1 text-xs font-bold transition-colors ${value ? "bg-black/0 hover:bg-black/40 text-transparent hover:text-white" : "text-slate-500 hover:bg-slate-100"}`}
        >
          {busy ? <Loader2 className="w-6 h-6 animate-spin text-orange-600" /> : <ImagePlus className="w-6 h-6" />}
          {busy ? "Enviando..." : value ? "Trocar foto" : "Toque para enviar foto"}
        </button>
        {value && !busy && (
          <button type="button" data-testid={`${testid}-remove`} onClick={() => onChange("")} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/90 text-slate-700 flex items-center justify-center shadow">
            <X className="w-4 h-4" />
          </button>
        )}
        <input ref={ref} type="file" accept="image/*" className="hidden" onChange={pick} data-testid={`${testid}-input`} />
      </div>
    </div>
  );
}
