import { useNavigate } from "react-router-dom";
import PageLayout from "../components/PageLayout";
import PageHeader from "../components/PageHeader";
import Button from "../screens/components/Button";

export default function TradePlanManager() {
  const navigate = useNavigate();

  return (
    <PageLayout>
      <PageHeader title="Trade plans" />

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
          Saved trade plans will appear here with their entry conditions, position
          size and current status. Start from a portfolio to build your first plan.
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
