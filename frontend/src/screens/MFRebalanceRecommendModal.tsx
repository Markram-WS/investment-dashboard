import { MFRebalanceRecommendation } from "../types";
import Button from "./components/Button";

interface MFRebalanceRecommendModalProps {
  show: boolean;
  loading: boolean;
  recommendations: MFRebalanceRecommendation[];
  onClose: () => void;
  onCreateOrders: (recs: MFRebalanceRecommendation[]) => void;
}

export default function MFRebalanceRecommendModal({
  show, loading, recommendations, onClose, onCreateOrders,
}: MFRebalanceRecommendModalProps) {
  if (!show) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-canvas rounded-lg shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-y-auto">
        <h3 className="text-lg font-bold mb-4">Rebalance Recommendations</h3>

        {loading ? (
          <div className="text-center py-8 text-slate">Calculating rebalance...</div>
        ) : recommendations.length === 0 ? (
          <div className="text-center py-8 text-green-600 font-medium">
            Portfolio is already balanced! No adjustments needed.
          </div>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="text-left py-2 font-medium text-slate">Asset</th>
                  <th className="text-left py-2 font-medium text-slate">Side</th>
                  <th className="text-right py-2 font-medium text-slate">Qty</th>
                  <th className="text-right py-2 font-medium text-slate">Est. Price</th>
                  <th className="text-right py-2 font-medium text-slate">Current</th>
                  <th className="text-right py-2 font-medium text-slate">Target</th>
                  <th className="text-right py-2 font-medium text-slate">Drift</th>
                </tr>
              </thead>
              <tbody>
                {recommendations.map((r, i) => (
                  <tr key={i} className="border-b border-hairline">
                    <td className="py-2 font-medium">{r.symbol}</td>
                    <td className="py-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        r.side === "Buy" ? "bg-teal-light text-brand-teal" : "bg-coral-light text-brand-coral"
                      }`}>
                        {r.side}
                      </span>
                    </td>
                    <td className="py-2 text-right">{r.qty.toFixed(4)}</td>
                    <td className="py-2 text-right">${r.estimated_price.toFixed(2) || "—"}</td>
                    <td className="py-2 text-right">{r.current_allocation.toFixed(1)}%</td>
                    <td className="py-2 text-right">{r.target_allocation.toFixed(1)}%</td>
                    <td className="py-2 text-right">
                      <span className={`text-xs font-bold ${
                        r.drift > 15 ? "text-brand-coral" : r.drift > 5 ? "text-brand-yellow" : "text-success"
                      }`}>
                        {r.drift.toFixed(1)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-4 p-3 bg-surface rounded-lg text-sm">
              <span className="text-slate">Total drift: </span>
              <span className="font-bold text-ink">
                {recommendations.reduce((s, r) => s + r.drift, 0).toFixed(1)}%
              </span>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {recommendations.length > 0 && (
            <Button variant="primary" onClick={() => onCreateOrders(recommendations)}>
              Create {recommendations.length} Orders
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
