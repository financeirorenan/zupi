import { useState } from "react";
import { Minus, Plus, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCart } from "@/context/CartContext";
import { fmtBRL } from "@/lib/api";
import { toast } from "sonner";

export default function ProductModal({ product, restaurant, open, onClose }) {
  const { addItem, clear } = useCart();
  const [qty, setQty] = useState(1);
  const [selected, setSelected] = useState([]);
  const [notes, setNotes] = useState("");
  const [conflict, setConflict] = useState(false);

  if (!product) return null;
  const base = product.promo_price || product.price;
  const addonsTotal = selected.reduce((s, a) => s + a.price, 0);
  const total = (base + addonsTotal) * qty;

  const toggleAddon = (a) => {
    setSelected((prev) => (prev.find((x) => x.id === a.id) ? prev.filter((x) => x.id !== a.id) : [...prev, a]));
  };

  const doAdd = (force = false) => {
    if (force) clear();
    const res = addItem(restaurant, product, selected, qty, notes);
    if (res === "conflict" && !force) {
      setConflict(true);
      return;
    }
    toast.success(`${product.name} adicionado ao carrinho`);
    setQty(1); setSelected([]); setNotes(""); setConflict(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { setConflict(false); onClose(); } }}>
      <DialogContent className="max-w-md p-0 overflow-hidden rounded-t-3xl sm:rounded-2xl max-h-[90vh] overflow-y-auto" data-testid="product-modal">
        {product.image && (
          <div className="h-44 bg-slate-100">
            <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="p-5 space-y-4">
          <div>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-display font-bold text-lg text-slate-900">{product.name}</h3>
              <div className="text-right shrink-0">
                {product.promo_price && <span className="block text-xs text-slate-400 line-through">{fmtBRL(product.price)}</span>}
                <span className="font-display font-extrabold text-orange-600">{fmtBRL(base)}</span>
              </div>
            </div>
            {product.description && <p className="text-sm text-slate-500 mt-1">{product.description}</p>}
          </div>

          {product.addons?.length > 0 && (
            <div>
              <p className="text-sm font-bold text-slate-800 mb-2">Turbine seu pedido</p>
              <div className="space-y-2">
                {product.addons.map((a) => {
                  const active = !!selected.find((x) => x.id === a.id);
                  return (
                    <button
                      key={a.id}
                      type="button"
                      data-testid={`addon-${a.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`}
                      onClick={() => toggleAddon(a)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm transition-colors ${active ? "border-orange-500 bg-orange-50" : "border-slate-200 bg-white"}`}
                    >
                      <span className="flex items-center gap-2.5">
                        <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center ${active ? "bg-orange-600 border-orange-600" : "border-slate-300"}`}>
                          {active && <Plus className="w-3 h-3 text-white rotate-45" />}
                        </span>
                        <span className="font-medium text-slate-700">{a.name}</span>
                      </span>
                      <span className="font-bold text-slate-600">+ {fmtBRL(a.price)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <p className="text-sm font-bold text-slate-800 mb-2">Alguma observação?</p>
            <Textarea
              data-testid="product-notes-input"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ex: sem cebola, ponto da carne..."
              className="resize-none"
              rows={2}
            />
          </div>

          {conflict && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3" data-testid="cart-conflict-warning">
              <p className="text-sm text-amber-800 flex gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />Seu carrinho tem itens de outro restaurante. Deseja limpar e adicionar este item?</p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setConflict(false)} data-testid="cart-conflict-cancel">Manter carrinho</Button>
                <Button size="sm" onClick={() => doAdd(true)} data-testid="cart-conflict-confirm">Limpar e adicionar</Button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <div className="flex items-center border rounded-xl">
              <button type="button" data-testid="qty-minus" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-11 h-11 flex items-center justify-center text-orange-600"><Minus className="w-4 h-4" /></button>
              <span className="w-8 text-center font-bold" data-testid="qty-value">{qty}</span>
              <button type="button" data-testid="qty-plus" onClick={() => setQty((q) => Math.min(50, q + 1))} className="w-11 h-11 flex items-center justify-center text-orange-600"><Plus className="w-4 h-4" /></button>
            </div>
            <Button data-testid="add-to-cart-button" onClick={() => doAdd(false)} className="flex-1 h-11 rounded-xl font-bold text-base">
              Adicionar • {fmtBRL(total)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
