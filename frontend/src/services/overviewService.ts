const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api/v1";

export const fetchOverviewData = async () => {
  const response = await fetch(`${API_BASE_URL}/analytics/overview`);
  return response.json();
};