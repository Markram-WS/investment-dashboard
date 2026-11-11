import { useNavigate } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import PageHeader from "../components/PageHeader";
import Button from "../screens/components/Button";

export default function ActiveOrders() {
  const navigate = useNavigate();

  return (
    <PageLayout>
      <PageHeader title="Active orders" />

      <div style={{ marginTop: 48 }}>
        <p
          style={{
            fontSize: 15,
            lineHeight: 1.6,
            color: "var(--color-slate)",
            margin: 0,
            maxWidth: 560,
          }}
        >
          Open orders will appear here with their side, quantity, fill price and
          time in force. Start from a portfolio to see its live trading activity.
        </p>
        <div style={{ marginTop: 20 }}>
          <Button variant="primary" onClick={() => navigate("/")}>
            Go to portfolios
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
