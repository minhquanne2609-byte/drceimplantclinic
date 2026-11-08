import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, Plus, RotateCcw, Trash2, Wand2, X } from "lucide-react";
import {
  loadRules,
  parseShorthand,
  resetRules,
  saveRules,
  type QtyMode,
  type Rule,
  type ShorthandDraft,
} from "@/lib/shorthand";

type Props = {
  catalogNames: string[];
  onApply: (draft: ShorthandDraft, mode: "replace" | "append") => void;
  /** Lets the button match the page's own (larger) button style where it is placed. */
  buttonClassName?: string;
  iconSize?: number;
};

const TEXT_KEY = "dci-shorthand-text";

const EXAMPLE = `Implant 14, 15 (ưu tiên Neodent)
Nhổ 26 -> imp nxk gx SSA
Cắt cầu 33 - 38 -> cắm im 34, 36, 37 gx đm2 1 đv
Cắt cầu 13 - 16 phục hình sứ
nhổ 47, cắm 47 , 46 dm2
tủy chốt sứ răng 22, 45

14 ngày - chuyến 1
14 ngày - chuyến 2`;

const QTY_LABEL: Record<QtyMode, string> = {
  teeth: "Theo số răng",
  regions: "1 vùng = 1 đơn vị",
  one: "Luôn 1",
};

export function ShorthandPlanButton({ catalogNames, onApply, buttonClassName, iconSize = 16 }: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"input" | "rules">("input");
  const [text, setText] = useState("");
  const [rules, setRules] = useState<Rule[]>([]);
  const [mode, setMode] = useState<"replace" | "append">("replace");

  useEffect(() => {
    if (!open) return;
    setRules(loadRules());
    try {
      setText(localStorage.getItem(TEXT_KEY) ?? "");
    } catch {
      /* ignore */
    }
  }, [open]);

  const updateText = (v: string) => {
    setText(v);
    try {
      localStorage.setItem(TEXT_KEY, v);
    } catch {
      /* ignore */
    }
  };

  const updateRules = (next: Rule[]) => {
    setRules(next);
    saveRules(next);
  };
  const patchRule = (id: string, patch: Partial<Rule>) =>
    updateRules(rules.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const draft = useMemo(() => parseShorthand(text, rules, catalogNames), [text, rules, catalogNames]);
  const phase1 = draft.rows.filter((r) => r.phase === 0);
  const phase2 = draft.rows.filter((r) => r.phase === 1);
  const hasAnything = draft.rows.length > 0 || Object.keys(draft.timelines).length > 0;

  const addRuleFor = (token: string) => {
    const id = `c-${Date.now().toString(36)}`;
    updateRules([
      ...rules,
      { id, kind: "service", label: token, triggers: [token.toLowerCase()], service: "", starts: false, qtyMode: "teeth", phase: 1 },
    ]);
    setTab("rules");
  };

  const PreviewTable = ({ title, rows }: { title: string; rows: typeof phase1 }) =>
    rows.length === 0 ? null : (
      <div className="rounded-lg border border-border overflow-hidden">
        <div className="bg-muted px-3 py-1.5 text-sm font-bold text-primary">{title}</div>
        <div className="divide-y divide-border">
          {rows.map((r, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-sm">
              <span className={`flex-1 min-w-0 truncate ${r.inCatalog ? "" : "text-amber-700"}`} title={r.name}>
                {r.name}
                {r.auto ? <span className="ml-1 text-[10px] text-muted-foreground">(tự động)</span> : null}
              </span>
              {!r.inCatalog && <span className="text-[10px] text-amber-700 shrink-0">không có trong catalog</span>}
              {r.priceLike && <span className="text-[10px] text-muted-foreground shrink-0">giá theo {r.priceLike}</span>}
              <span className="w-40 shrink-0 text-muted-foreground truncate" title={r.teeth}>
                {r.teeth || "—"}
              </span>
              <span className="w-8 shrink-0 text-right font-semibold">{r.qty}</span>
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={
          buttonClassName ??
          "no-print print:hidden px-4 py-2 rounded-full border border-border bg-card text-foreground text-base font-semibold hover:bg-muted transition flex items-center gap-1.5"
        }
        title="Gõ chữ viết tắt (nhổ, imp, nxk, gx…) để tự tạo kế hoạch"
      >
        <Wand2 size={iconSize} /> Quick plan
      </button>

      {open && typeof document !== "undefined" && createPortal((
        <div className="no-print print:hidden fixed inset-0 z-[80] bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
              <div>
                <h2 className="font-bold text-primary text-lg">Quick plan — chữ viết tắt thành kế hoạch</h2>
                <p className="text-xs text-muted-foreground">
                  Gõ mỗi ý một dòng. Không cần gõ dấu. Kết quả hiện ngay bên phải, kiểm tra rồi mới đưa vào plan.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex rounded-full border border-border overflow-hidden text-sm font-semibold">
                  <button
                    onClick={() => setTab("input")}
                    className={`px-4 py-1.5 ${tab === "input" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    Nhập
                  </button>
                  <button
                    onClick={() => setTab("rules")}
                    className={`px-4 py-1.5 ${tab === "rules" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                  >
                    Quy tắc
                  </button>
                </div>
                <button onClick={() => setOpen(false)} className="p-1.5 rounded-full hover:bg-muted" aria-label="Close">
                  <X size={18} />
                </button>
              </div>
            </div>

            {tab === "input" && (
              <>
                <div className="overflow-y-auto px-6 py-5 grid md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-semibold">Ghi chú của bác sĩ</label>
                      <button onClick={() => updateText(EXAMPLE)} className="text-xs text-primary underline">
                        Chèn ví dụ
                      </button>
                    </div>
                    <textarea
                      value={text}
                      onChange={(e) => updateText(e.target.value)}
                      rows={14}
                      spellCheck={false}
                      placeholder={"Implant 14, 15 (ưu tiên Neodent)\nNhổ 26 -> imp nxk gx\n…\n14 ngày - chuyến 1"}
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm leading-relaxed"
                    />
                    <div className="text-xs text-muted-foreground space-y-0.5">
                      <p>
                        <b>im / imp / implant / cắm</b> = Implant (mặc định Osstem, ghi “Neodent” để đổi) · <b>nhổ</b> = Extraction ·{" "}
                        <b>nxk</b> / <b>nxh</b> = nâng xoang kín / hở · <b>gx</b> = ghép xương (<b>1 đv</b> = 1 đơn vị) · <b>đm2</b> = Level II · <b>ssa</b> = Socket healing abutment
                      </p>
                      <p>
                        <b>tủy chốt sứ</b> = Root canal + Fiberglass post + Crown · <b>cắt cầu</b> = bỏ qua ·{" "}
                        <b>dự trù</b> = thêm (Provisional) · <b>14 ngày - chuyến 1</b> = thời gian Phase 1
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-semibold">Hiểu như sau</label>
                    {!hasAnything && <p className="text-sm text-muted-foreground">Chưa có gì để hiển thị. Hãy gõ vào ô bên trái.</p>}

                    {draft.lines.length > 0 && (
                      <div className="space-y-1">
                        {draft.lines.map((l, i) => (
                          <div key={i} className="text-xs rounded-md bg-muted/60 px-2.5 py-1.5">
                            <div className="text-muted-foreground truncate">{l.text}</div>
                            {l.items.length > 0 && <div className="font-medium">→ {l.items.join("  ·  ")}</div>}
                            {l.warnings.map((w, k) => (
                              <div key={k} className="text-amber-700 flex items-center gap-1">
                                <AlertTriangle size={11} /> {w}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}

                    {draft.unknown.length > 0 && (
                      <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
                        <div className="font-semibold text-amber-800 mb-1">Chưa hiểu các chữ này:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {draft.unknown.map((u) => (
                            <button
                              key={u}
                              onClick={() => addRuleFor(u)}
                              className="px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-900 text-xs hover:bg-amber-100"
                              title="Bấm để thêm quy tắc cho chữ này"
                            >
                              {u} <Plus size={10} className="inline" />
                            </button>
                          ))}
                        </div>
                        <p className="text-xs text-amber-800 mt-1">Bấm vào chữ để dạy app: chữ đó là dịch vụ nào.</p>
                      </div>
                    )}

                    <PreviewTable
                      title={`Phase 1${draft.timelines[0] ? ` — ${draft.timelines[0]}` : ""}`}
                      rows={phase1}
                    />
                    <PreviewTable
                      title={`Phase 2${draft.timelines[1] ? ` — ${draft.timelines[1]}` : ""}`}
                      rows={phase2}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-t border-border shrink-0">
                  <div className="flex flex-wrap items-center gap-5 text-sm">
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={mode === "replace"} onChange={() => setMode("replace")} />
                      Thay nội dung Phase 1 &amp; 2 (giữ Consultation / CT / Blood test)
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="radio" checked={mode === "append"} onChange={() => setMode("append")} />
                      Thêm vào plan hiện tại
                    </label>
                  </div>
                  <button
                    onClick={() => {
                      onApply(draft, mode);
                      setOpen(false);
                    }}
                    disabled={!hasAnything}
                    className="px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Check size={15} /> Đưa vào Treatment Plan
                  </button>
                </div>
              </>
            )}

            {tab === "rules" && (
              <div className="overflow-y-auto px-6 py-5 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Mỗi dòng là một quy tắc. Ô “Chữ viết tắt” ngăn cách bằng dấu phẩy, không phân biệt dấu hay chữ hoa. Thay đổi lưu ngay trên máy này.
                </p>
                <datalist id="shorthand-catalog">
                  {catalogNames.map((n) => (
                    <option key={n} value={n} />
                  ))}
                </datalist>
                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="hidden md:grid grid-cols-[2rem_1.2fr_1.6fr_1.5fr_9rem_5rem_2rem] gap-2 bg-muted px-3 py-2 text-xs font-bold text-muted-foreground">
                    <span />
                    <span>Tên quy tắc</span>
                    <span>Chữ viết tắt</span>
                    <span>Dịch vụ (trong catalog)</span>
                    <span>Số lượng</span>
                    <span>Chuyến</span>
                    <span />
                  </div>
                  <div className="divide-y divide-border">
                    {rules.map((r) => {
                      const takesService = r.kind === "service" || r.kind === "implant" || r.kind === "brand";
                      return (
                        <div
                          key={r.id}
                          className={`grid md:grid-cols-[2rem_1.2fr_1.6fr_1.5fr_9rem_5rem_2rem] gap-2 items-center px-3 py-2 ${
                            r.enabled === false ? "opacity-50" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={r.enabled !== false}
                            onChange={(e) => patchRule(r.id, { enabled: e.target.checked })}
                            title="Bật / tắt quy tắc"
                          />
                          <div className="space-y-1">
                            <input
                              value={r.label}
                              onChange={(e) => patchRule(r.id, { label: e.target.value })}
                              className="w-full rounded-md border border-border bg-background px-2 py-1 text-sm"
                            />
                            {!r.builtin && r.kind === "service" && (
                              <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <input
                                  type="checkbox"
                                  checked={!!r.starts}
                                  onChange={(e) => patchRule(r.id, { starts: e.target.checked })}
                                />
                                Việc chính (như nhổ, cắm) — bỏ tick nếu là đi kèm (như gx, nxk)
                              </label>
                            )}
                          </div>
                          <input
                            value={r.triggers.join(", ")}
                            onChange={(e) =>
                              patchRule(r.id, {
                                triggers: e.target.value
                                  .split(",")
                                  .map((t) => t.trim())
                                  .filter(Boolean),
                              })
                            }
                            className="rounded-md border border-border bg-background px-2 py-1 text-sm"
                          />
                          {takesService ? (
                            <input
                              list="shorthand-catalog"
                              value={r.service ?? ""}
                              onChange={(e) => patchRule(r.id, { service: e.target.value })}
                              placeholder="Tên dịch vụ"
                              className={`rounded-md border px-2 py-1 text-sm ${
                                !r.service || catalogNames.includes(r.service) ? "border-border bg-background" : "border-amber-400 bg-amber-50"
                              }`}
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {r.kind === "ignore"
                                ? "Không ghi vào kế hoạch"
                                : r.kind === "rct"
                                  ? `Root canal${r.post ? " + Post" : ""}${r.crown ? " + Crown" : ""}`
                                  : "Thêm (Provisional)"}
                            </span>
                          )}
                          {r.kind === "service" ? (
                            <select
                              value={r.qtyMode ?? "teeth"}
                              onChange={(e) => patchRule(r.id, { qtyMode: e.target.value as QtyMode })}
                              className="rounded-md border border-border bg-background px-1.5 py-1 text-sm"
                            >
                              {(Object.keys(QTY_LABEL) as QtyMode[]).map((q) => (
                                <option key={q} value={q}>
                                  {QTY_LABEL[q]}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span />
                          )}
                          {r.kind === "service" ? (
                            <select
                              value={r.phase ?? 1}
                              onChange={(e) => patchRule(r.id, { phase: Number(e.target.value) as 1 | 2 })}
                              className="rounded-md border border-border bg-background px-1.5 py-1 text-sm"
                            >
                              <option value={1}>1</option>
                              <option value={2}>2</option>
                            </select>
                          ) : (
                            <span />
                          )}
                          {!r.builtin ? (
                            <button
                              onClick={() => updateRules(rules.filter((x) => x.id !== r.id))}
                              className="p-1 rounded-full hover:bg-destructive/10 text-destructive"
                              aria-label="Xóa quy tắc"
                            >
                              <Trash2 size={14} />
                            </button>
                          ) : (
                            <span />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={() =>
                      updateRules([
                        ...rules,
                        {
                          id: `c-${Date.now().toString(36)}`,
                          kind: "service",
                          label: "Quy tắc mới",
                          triggers: [],
                          service: "",
                          starts: false,
                          qtyMode: "teeth",
                          phase: 1,
                        },
                      ])
                    }
                    className="px-4 py-2 rounded-full border border-primary text-primary text-sm font-semibold hover:bg-primary hover:text-primary-foreground flex items-center gap-1.5"
                  >
                    <Plus size={14} /> Thêm quy tắc
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm("Đưa tất cả quy tắc về mặc định? Các quy tắc bạn tự thêm sẽ bị xóa.")) setRules(resetRules());
                    }}
                    className="px-4 py-2 rounded-full border border-border text-sm font-semibold hover:bg-muted flex items-center gap-1.5"
                  >
                    <RotateCcw size={14} /> Về mặc định
                  </button>
                  <button onClick={() => setTab("input")} className="ml-auto px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold">
                    Xong, quay lại
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ), document.body)}
    </>
  );
}
